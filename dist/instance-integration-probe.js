"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setIntegrationProbeFinishedHandler = setIntegrationProbeFinishedHandler;
exports.handleEvolutionWebhookPayload = handleEvolutionWebhookPayload;
exports.getIntegrationProbeStatus = getIntegrationProbeStatus;
exports.startIntegrationProbe = startIntegrationProbe;
exports.pruneIntegrationProbes = pruneIntegrationProbes;
const crypto_1 = __importDefault(require("crypto"));
const evo_instance_key_1 = require("./instances/evo-instance-key");
const EVO_API_BASE = String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080")
    .replace(/\/$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const EVO_INSTANCES_URL = String(process.env.EVO_INSTANCES_URL || "").trim() ||
    `${EVO_API_BASE}/instance/fetchInstances`;
const EVO_SEND_TEXT_URL_TEMPLATE = String(process.env.EVO_SEND_TEXT_URL_TEMPLATE || "").trim() ||
    `${EVO_API_BASE}/message/sendText/{instance}`;
const EVO_SEND_TEXT_V1 = process.env.EVO_SEND_TEXT_V1 === "1" || process.env.EVO_SEND_TEXT_V1 === "true";
const WABA_PUBLIC_BASE_URL = String(process.env.WABA_PUBLIC_BASE_URL || process.env.WABA_WEBHOOK_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
const PROBE_TIMEOUT_MS = Math.max(15000, Math.min(90000, Number(process.env.INTEGRATION_PROBE_TIMEOUT_MS || 45000) || 45000));
const PROBE_POLL_MS = Math.max(1500, Math.min(10000, Number(process.env.INTEGRATION_PROBE_POLL_MS || 2500) || 2500));
/** Bloqueio global: INTEGRATION_PROBE_DISABLE_MESSAGE_SEND=1 impede envio mesmo com opt-in. */
const INTEGRATION_PROBE_MESSAGE_SEND_DISABLED = process.env.INTEGRATION_PROBE_DISABLE_MESSAGE_SEND === "1" ||
    process.env.INTEGRATION_PROBE_DISABLE_MESSAGE_SEND === "true";
const probes = new Map();
const markerIndex = new Map();
let onProbeFinished = null;
function setIntegrationProbeFinishedHandler(handler) {
    onProbeFinished = handler;
}
function notifyProbeFinished(record) {
    if (!onProbeFinished)
        return;
    try {
        onProbeFinished(publicProbeStatus(record));
    }
    catch (e) {
        console.error("[probe-integracao] onFinished:", e);
    }
}
function normalizeWhatsAppNumber(num) {
    const raw = String(num || "").trim();
    const digits = raw.replace(/\D/g, "");
    if (!digits)
        return raw;
    if (digits.length >= 12 && digits.startsWith("55"))
        return digits;
    if (digits.length >= 10 && digits.length <= 11 && /^[1-9]\d/.test(digits)) {
        return "55" + digits;
    }
    return digits;
}
function toRemoteJid(num) {
    const digits = normalizeWhatsAppNumber(num);
    return digits ? `${digits}@s.whatsapp.net` : "";
}
async function callEvo(url, method, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetch(url, {
            method,
            headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
            signal: controller.signal,
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await response.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        }
        catch {
            json = null;
        }
        return { ok: response.ok, status: response.status, body: text, json };
    }
    finally {
        clearTimeout(timeoutId);
    }
}
function buildTemplateUrl(template, instanceName) {
    return template
        .replace("{instance}", encodeURIComponent(instanceName))
        .replace("{name}", encodeURIComponent(instanceName));
}
function extractInstanceNumber(inst) {
    const raw = inst?.ownerJid ??
        inst?.owner ??
        inst?.number ??
        inst?.phone ??
        inst?.ownerNumber ??
        inst?.profile?.owner ??
        "";
    const s = String(raw).trim();
    if (!s)
        return "";
    if (s.includes("@"))
        return s.split("@")[0] || s;
    return s;
}
async function fetchConnectedInstances() {
    const response = await callEvo(EVO_INSTANCES_URL, "GET");
    if (!response.ok)
        return [];
    const raw = response.json;
    const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.response)
            ? raw.response
            : Array.isArray(raw?.data)
                ? raw.data
                : [];
    return list
        .map((item) => {
        const inst = (item?.instance ?? item);
        const status = String(inst?.connectionStatus ?? inst?.status ?? "").toLowerCase();
        if (!status.includes("open"))
            return null;
        const instancia = (0, evo_instance_key_1.resolveEvoInstanceKey)(inst);
        const numero = extractInstanceNumber(inst);
        if (!instancia || !numero)
            return null;
        return { instancia, numero };
    })
        .filter((x) => x != null);
}
function collectMessageTexts(node, out, depth = 0) {
    if (depth > 10 || node == null)
        return;
    if (typeof node === "string")
        return;
    if (Array.isArray(node)) {
        for (const item of node)
            collectMessageTexts(item, out, depth + 1);
        return;
    }
    if (typeof node !== "object")
        return;
    const obj = node;
    if (typeof obj.conversation === "string" && obj.conversation.trim()) {
        out.push(obj.conversation.trim());
    }
    const ext = obj.extendedTextMessage;
    if (typeof ext?.text === "string" && ext.text.trim())
        out.push(ext.text.trim());
    if (typeof obj.text === "string" && obj.text.trim())
        out.push(obj.text.trim());
    for (const value of Object.values(obj)) {
        if (value && typeof value === "object")
            collectMessageTexts(value, out, depth + 1);
    }
}
function messageTextsIncludeMarker(node, marker) {
    const texts = [];
    collectMessageTexts(node, texts);
    const needle = marker.toLowerCase();
    return texts.some((t) => t.toLowerCase().includes(needle));
}
function isLikelyWhatsAppRestriction(detail, httpStatus) {
    const d = String(detail || "").toLowerCase();
    const patterns = [
        "ban",
        "banned",
        "blocked",
        "blocklist",
        "restricted",
        "restriction",
        "suspended",
        "suspend",
        "not authorized",
        "forbidden",
        "rate-overlimit",
        "spam",
        "integrity",
        "logged out",
        "logout",
        "connection closed",
        "disconnected",
    ];
    if (patterns.some((p) => d.includes(p)))
        return true;
    return httpStatus === 403;
}
function computeRestrictionSuspected(record) {
    if (!record.finished || !record.sendAttempted)
        return false;
    if (record.sendHttpOk)
        return false;
    return isLikelyWhatsAppRestriction(record.apiTest.detail);
}
function publicProbeStatus(record) {
    const finished = record.finished;
    const restrictionSuspected = computeRestrictionSuspected(record);
    return {
        probeId: record.probeId,
        finished,
        restrictionSuspected,
        sourceInstance: record.sourceInstance,
        destinationInstance: record.destinationInstance,
        apiTest: { ...record.apiTest },
        webhookTest: { ...record.webhookTest },
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
    };
}
function tryFinalizeProbe(record) {
    if (record.finished)
        return;
    const apiDone = record.apiTest.success !== null;
    const webhookDone = record.webhookTest.success !== null;
    if (!apiDone || !webhookDone)
        return;
    record.finished = true;
    record.finishedAt = new Date().toISOString();
    markerIndex.delete(record.marker);
    notifyProbeFinished(record);
}
function finalizeProbeOnTimeout(record) {
    if (record.finished)
        return;
    if (record.apiTest.success === null) {
        record.apiTest = {
            success: false,
            detail: "Tempo esgotado sem confirmar mensagem via API (findMessages).",
        };
    }
    if (record.webhookTest.success === null) {
        record.webhookTest = {
            success: false,
            detail: "Tempo esgotado sem evento de mensagem recebida no destino.",
        };
    }
    tryFinalizeProbe(record);
}
async function ensureDestinationWebhook(destinationInstance) {
    if (!WABA_PUBLIC_BASE_URL) {
        return "WABA_PUBLIC_BASE_URL não configurada — teste por webhook pode falhar.";
    }
    const webhookUrl = `${WABA_PUBLIC_BASE_URL}/webhooks/evolution`;
    const setUrl = `${EVO_API_BASE}/webhook/set/${encodeURIComponent(destinationInstance)}`;
    const body = {
        webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: false,
            events: ["MESSAGES_UPSERT"],
        },
    };
    const result = await callEvo(setUrl, "POST", body);
    if (!result.ok) {
        return `Não foi possível registrar webhook na EVO (HTTP ${result.status}).`;
    }
    return "";
}
async function sendProbeMessage(sourceInstance, destNumber, text) {
    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, sourceInstance);
    const numero = normalizeWhatsAppNumber(destNumber);
    const sendBody = EVO_SEND_TEXT_V1
        ? { number: numero, textMessage: { text } }
        : { number: numero, text, textMessage: { text } };
    const result = await callEvo(sendUrl, "POST", sendBody);
    if (!result.ok) {
        const detail = result.json?.message ||
            result.json?.error ||
            result.body.slice(0, 180) ||
            `HTTP ${result.status}`;
        return { ok: false, status: result.status, detail: String(detail) };
    }
    return { ok: true, status: result.status, detail: "sendText retornou sucesso." };
}
async function findProbeMessageViaApi(destinationInstance, sourceNumber, marker) {
    const remoteJid = toRemoteJid(sourceNumber);
    const url = `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(destinationInstance)}`;
    const bodies = [
        { where: { key: { remoteJid } }, limit: 30 },
        { where: { key: { remoteJid } }, take: 30 },
        { limit: 40 },
        {},
    ];
    for (const body of bodies) {
        const result = await callEvo(url, "POST", body);
        if (!result.ok)
            continue;
        if (messageTextsIncludeMarker(result.json, marker))
            return true;
    }
    return false;
}
function markWebhookSuccess(probeId, detail) {
    const record = probes.get(probeId);
    if (!record || record.finished)
        return;
    if (record.webhookTest.success === true)
        return;
    record.webhookTest = { success: true, detail };
    tryFinalizeProbe(record);
}
function markApiSuccess(probeId, detail) {
    const record = probes.get(probeId);
    if (!record || record.finished)
        return;
    if (record.apiTest.success === true)
        return;
    record.apiTest = { success: true, detail };
    tryFinalizeProbe(record);
}
function handleEvolutionWebhookPayload(body) {
    if (!body || typeof body !== "object")
        return;
    const payload = body;
    const instanceName = String(payload.instance || payload.instanceName || "").trim();
    const event = String(payload.event || "").toUpperCase();
    if (event && event !== "MESSAGES_UPSERT" && event !== "MESSAGES.UPSERT")
        return;
    for (const [marker, probeId] of markerIndex.entries()) {
        const record = probes.get(probeId);
        if (!record || record.finished)
            continue;
        if (instanceName && instanceName !== record.destinationInstance)
            continue;
        if (!messageTextsIncludeMarker(payload, marker))
            continue;
        markWebhookSuccess(probeId, `Webhook MESSAGES_UPSERT confirmou mensagem no destino${instanceName ? ` (${instanceName})` : ""}.`);
        break;
    }
}
async function runProbeLoop(record) {
    const deadline = Date.now() + PROBE_TIMEOUT_MS;
    while (Date.now() < deadline && !record.finished) {
        if (record.apiTest.success !== true) {
            try {
                const found = await findProbeMessageViaApi(record.destinationInstance, record.sourceNumber, record.marker);
                if (found) {
                    markApiSuccess(record.probeId, "findMessages localizou a mensagem de teste no destino.");
                }
            }
            catch {
                // continua polling
            }
        }
        if (!record.finished) {
            await new Promise((r) => setTimeout(r, PROBE_POLL_MS));
        }
    }
    finalizeProbeOnTimeout(record);
}
function getIntegrationProbeStatus(probeId) {
    const record = probes.get(probeId);
    if (!record)
        return null;
    return publicProbeStatus(record);
}
async function startIntegrationProbe(input) {
    const sourceInstanceName = String(input.sourceInstanceName || "").trim();
    if (!sourceInstanceName) {
        return { error: "Nome da instância de origem é obrigatório." };
    }
    const connected = await fetchConnectedInstances();
    const source = connected.find((c) => c.instancia === sourceInstanceName);
    if (!source) {
        return {
            error: `Instância "${sourceInstanceName}" não está conectada (status open) na Evolution.`,
        };
    }
    const allowMessageSend = input.allowMessageSend === true && !INTEGRATION_PROBE_MESSAGE_SEND_DISABLED;
    if (!allowMessageSend) {
        const startedAt = new Date().toISOString();
        return {
            status: {
                probeId: "",
                finished: true,
                restrictionSuspected: false,
                sourceInstance: source.instancia,
                destinationInstance: "",
                apiTest: {
                    success: true,
                    detail: "Conexão confirmada (status open) na Evolution.",
                },
                webhookTest: {
                    success: null,
                    detail: "Nenhuma mensagem de teste enviada (modo seguro).",
                },
                startedAt,
                finishedAt: startedAt,
            },
        };
    }
    let destination = input.destinationInstanceName
        ? connected.find((c) => c.instancia === input.destinationInstanceName)
        : undefined;
    if (!destination) {
        destination = connected.find((c) => c.instancia !== sourceInstanceName);
    }
    if (!destination) {
        return {
            error: "Nenhuma outra instância conectada disponível como destino do teste. Conecte uma instância de referência antes.",
        };
    }
    const probeId = crypto_1.default.randomUUID();
    const marker = `WABA-PROBE:${probeId.slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const record = {
        probeId,
        marker,
        sourceInstance: source.instancia,
        destinationInstance: destination.instancia,
        sourceNumber: source.numero,
        destNumber: destination.numero,
        startedAt,
        finishedAt: null,
        finished: false,
        restrictionSuspected: false,
        sendAttempted: false,
        sendHttpOk: false,
        apiTest: { success: null, detail: "Consultando mensagens no destino (findMessages)…" },
        webhookTest: {
            success: null,
            detail: "Aguardando evento de mensagem recebida no destino…",
        },
    };
    probes.set(probeId, record);
    markerIndex.set(marker, probeId);
    const webhookNote = await ensureDestinationWebhook(destination.instancia);
    if (webhookNote) {
        record.webhookTest.detail = `${webhookNote} Aguardando evento…`;
    }
    const probeText = `Teste de integração WABA. ${marker}`;
    record.sendAttempted = true;
    const send = await sendProbeMessage(source.instancia, destination.numero, probeText);
    record.sendHttpOk = send.ok;
    if (!send.ok) {
        const restricted = isLikelyWhatsAppRestriction(String(send.detail), send.status);
        record.apiTest = { success: false, detail: `Falha ao enviar teste: ${send.detail}` };
        record.webhookTest = {
            success: restricted ? false : null,
            detail: restricted
                ? "Evolution indicou possível restrição no envio."
                : "Envio não confirmado (falha técnica — não indica bloqueio do número).",
        };
        tryFinalizeProbe(record);
        return { probeId, status: publicProbeStatus(record) };
    }
    void runProbeLoop(record);
    return { probeId, status: publicProbeStatus(record) };
}
/** Remove probes antigos (> 2 h) para não crescer memória indefinidamente. */
function pruneIntegrationProbes() {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, record] of probes.entries()) {
        const started = new Date(record.startedAt).getTime();
        if (started < cutoff) {
            markerIndex.delete(record.marker);
            probes.delete(id);
        }
    }
}
setInterval(() => pruneIntegrationProbes(), 30 * 60 * 1000).unref?.();
