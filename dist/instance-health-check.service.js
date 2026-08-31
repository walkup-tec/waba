"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInstanceHealth = checkInstanceHealth;
const evo_http_client_1 = require("./evo-http.client");
const evo_instance_key_1 = require("./instances/evo-instance-key");
const EVO_API_BASE = String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080").replace(/\/$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const EVO_INSTANCES_URL = String(process.env.EVO_INSTANCES_URL || "").trim() ||
    `${EVO_API_BASE}/instance/fetchInstances`;
const STATUS_REASON_LABELS = {
    200: "Conexão estável com o WhatsApp.",
    401: "Sessão encerrada no aparelho — escaneie o QR novamente.",
    403: "WhatsApp sinalizou restrição ou banimento neste número.",
    428: "Conexão expirou — verifique rede e tente de novo.",
    500: "Erro temporário nos servidores do WhatsApp.",
    503: "Serviço WhatsApp indisponível no momento.",
};
function normalizeDigits(num) {
    const digits = String(num || "").replace(/\D/g, "");
    if (!digits)
        return "";
    if (digits.length >= 12 && digits.startsWith("55"))
        return digits;
    if (digits.length >= 10 && digits.length <= 11 && /^[1-9]\d/.test(digits)) {
        return `55${digits}`;
    }
    return digits;
}
function pickStatusReason(payload) {
    if (!payload || typeof payload !== "object")
        return null;
    const root = payload;
    const candidates = [
        root.statusReason,
        root.instance?.statusReason,
        root.code,
    ];
    for (const value of candidates) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0)
            return Math.floor(n);
    }
    return null;
}
function pickConnectionState(payload) {
    if (!payload || typeof payload !== "object")
        return "";
    const root = payload;
    const inst = root.instance ?? root;
    const raw = inst.state ??
        inst.connectionStatus ??
        inst.status ??
        root.state ??
        root.connectionStatus ??
        "";
    return String(raw || "").trim().toLowerCase();
}
function extractInstanceRow(list, instanceName) {
    const needle = instanceName.trim().toLowerCase();
    for (const item of list) {
        const inst = (item?.instance ?? item);
        const name = (0, evo_instance_key_1.resolveEvoInstanceKey)(inst).toLowerCase();
        if (name === needle)
            return inst;
    }
    return null;
}
function extractOwnerDigits(inst) {
    const raw = inst?.owner ??
        inst?.number ??
        inst?.phone ??
        inst?.ownerNumber ??
        inst?.profile?.owner ??
        "";
    const s = String(raw).trim();
    if (!s)
        return "";
    const base = s.includes("@") ? s.split("@")[0] || s : s;
    return normalizeDigits(base);
}
function pickProfileName(payload) {
    if (!payload || typeof payload !== "object")
        return "";
    const root = payload;
    const candidates = [
        root.name,
        root.pushName,
        root.profileName,
        root.profile?.name,
        root.response?.name,
    ];
    for (const value of candidates) {
        const s = String(value || "").trim();
        if (s)
            return s;
    }
    return "";
}
async function evoGet(url) {
    const result = await (0, evo_http_client_1.evoHttpRequest)(url, "GET", { apiKey: EVO_API_KEY, timeoutMs: 12000 });
    return { ok: result.ok, status: result.status, json: result.json };
}
async function evoPost(url, body) {
    const result = await (0, evo_http_client_1.evoHttpRequest)(url, "POST", { apiKey: EVO_API_KEY, body, timeoutMs: 12000 });
    return { ok: result.ok, status: result.status, json: result.json };
}
function resolveLevel(input) {
    if (input.statusReason === 403) {
        return { level: "restricted", restrictionSuspected: true, safeToUse: false };
    }
    if (input.connectionState && !input.connectionState.includes("open")) {
        return { level: "warning", restrictionSuspected: false, safeToUse: false };
    }
    const failed = input.checks.filter((c) => !c.ok);
    if (failed.length === 0) {
        return { level: "healthy", restrictionSuspected: false, safeToUse: true };
    }
    if (failed.length >= 2) {
        return { level: "warning", restrictionSuspected: false, safeToUse: false };
    }
    return { level: "unknown", restrictionSuspected: false, safeToUse: false };
}
function buildRecommendation(level, statusReason) {
    if (statusReason === 403) {
        return "Não use este número em campanhas. Tente outro chip ou aguarde revisão junto ao suporte WhatsApp.";
    }
    if (level === "healthy") {
        return "Número conectado sem sinais de restrição. Aguarde alguns minutos antes do primeiro envio em massa.";
    }
    if (level === "warning") {
        return "Conexão instável ou incompleta. Reconecte o QR e repita a verificação antes de usar em disparos.";
    }
    return "Não foi possível confirmar a saúde do número. Verifique manualmente no aparelho antes de disparar.";
}
async function checkInstanceHealth(input) {
    const instanceName = String(input.instanceName || "").trim();
    const expectedNumber = normalizeDigits(String(input.expectedNumber || ""));
    const checks = [];
    let connectionState = "";
    let statusReason = null;
    const stateUrls = [
        `${EVO_API_BASE}/instance/connectionState/${encodeURIComponent(instanceName)}`,
        `${EVO_API_BASE}/instance/connection-state/${encodeURIComponent(instanceName)}`,
    ];
    for (const url of stateUrls) {
        const stateRes = await evoGet(url);
        if (!stateRes.ok && stateRes.status === 404)
            continue;
        connectionState = pickConnectionState(stateRes.json) || connectionState;
        statusReason = pickStatusReason(stateRes.json) ?? statusReason;
        const reasonLabel = statusReason != null ? STATUS_REASON_LABELS[statusReason] || `Código ${statusReason}` : "";
        checks.push({
            id: "connection_state",
            ok: connectionState.includes("open") && statusReason !== 403,
            label: "Estado da conexão",
            detail: connectionState
                ? `Estado: ${connectionState}${reasonLabel ? ` — ${reasonLabel}` : ""}`
                : `Não foi possível ler connectionState (HTTP ${stateRes.status}).`,
        });
        break;
    }
    if (!checks.some((c) => c.id === "connection_state")) {
        checks.push({
            id: "connection_state",
            ok: false,
            label: "Estado da conexão",
            detail: "Endpoint connectionState indisponível no sistema WABA - Drax.",
        });
    }
    const instancesRes = await evoGet(EVO_INSTANCES_URL);
    let listedNumber = "";
    if (instancesRes.ok) {
        const raw = instancesRes.json;
        const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.response)
                ? raw.response
                : Array.isArray(raw?.data)
                    ? raw.data
                    : [];
        const row = extractInstanceRow(list, instanceName);
        if (row) {
            listedNumber = extractOwnerDigits(row);
            const listedStatus = String(row.connectionStatus ?? row.status ?? "").toLowerCase();
            connectionState = connectionState || listedStatus;
            const numberMatches = !expectedNumber || !listedNumber || listedNumber.endsWith(expectedNumber.slice(-11));
            checks.push({
                id: "instance_listed",
                ok: listedStatus.includes("open") && numberMatches,
                label: "Instância no sistema WABA - Drax",
                detail: listedStatus.includes("open")
                    ? `Conectada como ${listedNumber || "número não informado"}.`
                    : `Status atual: ${listedStatus || "desconhecido"}.`,
            });
        }
        else {
            checks.push({
                id: "instance_listed",
                ok: false,
                label: "Instância no sistema WABA - Drax",
                detail: "Instância não encontrada na listagem.",
            });
        }
    }
    else {
        checks.push({
            id: "instance_listed",
            ok: false,
            label: "Instância no sistema WABA - Drax",
            detail: `Falha ao listar instâncias (HTTP ${instancesRes.status}).`,
        });
    }
    const profileNumber = expectedNumber || listedNumber;
    const profileUrls = [
        `${EVO_API_BASE}/profile/fetchProfile/${encodeURIComponent(instanceName)}`,
        `${EVO_API_BASE}/instance/fetchProfile/${encodeURIComponent(instanceName)}`,
    ];
    let profileOk = false;
    let profileDetail = "Perfil não consultado.";
    for (const url of profileUrls) {
        const profileRes = await evoGet(url);
        if (!profileRes.ok)
            continue;
        const profileName = pickProfileName(profileRes.json);
        if (profileName) {
            profileOk = true;
            profileDetail = `Perfil acessível (${profileName}).`;
            break;
        }
    }
    if (!profileOk && profileNumber) {
        const picUrl = `${EVO_API_BASE}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`;
        const picRes = await evoPost(picUrl, { number: profileNumber });
        if (picRes.ok) {
            profileOk = true;
            profileDetail = "Perfil/foto acessível via API.";
        }
        else {
            profileDetail = `Perfil não confirmado (HTTP ${picRes.status}). Isso pode ser normal em contas novas.`;
        }
    }
    checks.push({
        id: "profile",
        ok: profileOk,
        label: "Perfil WhatsApp",
        detail: profileDetail,
    });
    const { level, restrictionSuspected, safeToUse } = resolveLevel({
        checks,
        statusReason,
        connectionState,
    });
    return {
        instanceName,
        number: profileNumber || expectedNumber || listedNumber,
        level,
        safeToUse,
        restrictionSuspected,
        statusReason,
        connectionState,
        checks,
        recommendation: buildRecommendation(level, statusReason),
    };
}
