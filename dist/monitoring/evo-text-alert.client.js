"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEvoTextAlert = sendEvoTextAlert;
exports.sendEvoImageAlert = sendEvoImageAlert;
const evo_http_client_1 = require("../evo-http.client");
const evo_api_config_1 = require("../evo-api-config");
const evo_send_recovery_service_1 = require("../services/evo-send-recovery.service");
const evo_api_config_2 = require("../evo-api-config");
const resolveEvoApiKey = () => String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11").trim();
const resolveSendTextUrlTemplate = () => {
    const base = (0, evo_api_config_2.resolvePrimaryEvoApiBase)();
    return (process.env.EVO_SEND_TEXT_URL_TEMPLATE || `${base}/message/sendText/{instance}`).trim();
};
const resolveSendMediaUrlTemplate = () => {
    const base = (0, evo_api_config_2.resolvePrimaryEvoApiBase)();
    return (process.env.EVO_SEND_MEDIA_URL_TEMPLATE || `${base}/message/sendMedia/{instance}`).trim();
};
const isSendTextV1 = () => {
    const raw = String(process.env.EVO_SEND_TEXT_V1 ?? "").trim().toLowerCase();
    return raw === "1" || raw === "true";
};
const buildTemplateUrl = (template, instanceName) => template
    .replace("{instance}", encodeURIComponent(instanceName))
    .replace("{name}", encodeURIComponent(instanceName));
const normalizeWhatsAppNumber = (num) => {
    const raw = String(num || "").trim();
    const digits = raw.replace(/\D/g, "");
    if (!digits)
        return raw;
    if (digits.length >= 12 && digits.startsWith("55"))
        return digits;
    if (digits.length >= 10 && digits.length <= 11 && /^[1-9]\d/.test(digits)) {
        return `55${digits}`;
    }
    return digits;
};
const isEvoSendTextAccepted = (json, body) => {
    const rawBody = String(body || "").trim();
    if (!json && !rawBody)
        return false;
    if (json && typeof json === "object") {
        const record = json;
        const status = String(record.status ?? record.state ?? "").trim().toUpperCase();
        if (status === "ERROR" || status === "FAILED")
            return false;
        if (record.error)
            return false;
        if (record.key || record.messageId || record.id)
            return true;
    }
    const bodyLc = rawBody.toLowerCase();
    if (bodyLc.includes('"error"') || bodyLc.includes("not found"))
        return false;
    return rawBody.length > 0;
};
const extractSendMessageMeta = (json) => {
    const visit = (node, depth) => {
        if (node == null || depth > 8)
            return null;
        if (Array.isArray(node)) {
            for (const item of node) {
                const hit = visit(item, depth + 1);
                if (hit?.id)
                    return hit;
            }
            return null;
        }
        if (typeof node !== "object")
            return null;
        const rec = node;
        const key = rec.key;
        if (key && typeof key === "object") {
            const keyRec = key;
            const id = String(keyRec.id || rec.messageId || rec.id || "").trim();
            if (id) {
                return { id, remoteJid: String(keyRec.remoteJid || rec.remoteJid || "").trim() };
            }
        }
        for (const value of Object.values(rec)) {
            const hit = visit(value, depth + 1);
            if (hit?.id)
                return hit;
        }
        return null;
    };
    return visit(json, 0) || { id: "", remoteJid: "" };
};
const toSendResult = (ok, detail, status, json) => {
    const meta = extractSendMessageMeta(json);
    return {
        ok,
        detail,
        status,
        messageId: meta.id || undefined,
        remoteJid: meta.remoteJid || undefined,
    };
};
async function sendEvoTextAlert(input) {
    const instanceName = String(input.instanceName || "").trim();
    const targetNumber = normalizeWhatsAppNumber(String(input.targetNumber || "").trim());
    const text = String(input.text || "").trim();
    if (!instanceName) {
        return { ok: false, detail: "Instância EVO não informada.", status: 0 };
    }
    if (!targetNumber) {
        return { ok: false, detail: "Número de destino inválido.", status: 0 };
    }
    if (!text) {
        return { ok: false, detail: "Texto do alerta vazio.", status: 0 };
    }
    const url = buildTemplateUrl(resolveSendTextUrlTemplate(), instanceName);
    const body = isSendTextV1()
        ? { number: targetNumber, textMessage: { text } }
        : { number: targetNumber, text, textMessage: { text } };
    if (typeof input.linkPreview === "boolean") {
        body.linkPreview = input.linkPreview;
    }
    const timeoutMs = typeof input.timeoutMs === "number" && input.timeoutMs >= 10000
        ? Math.round(input.timeoutMs)
        : (0, evo_http_client_1.defaultEvoSendTextTimeoutMs)();
    const result = await (0, evo_api_config_1.evoHttpRequestWithBaseFailover)(url, "POST", {
        apiKey: resolveEvoApiKey(),
        body,
        timeoutMs,
        retries: Math.max(1, Math.min(4, Math.round(Number(input.retries ?? 1)))),
    });
    let accepted = result.ok && isEvoSendTextAccepted(result.json, result.body);
    if (accepted) {
        return toSendResult(true, "sendText OK.", result.status, result.json);
    }
    const initialDetail = result.error ||
        result.body ||
        (result.json && typeof result.json === "object"
            ? String(result.json.message ?? "")
            : "") ||
        "Falha no envio via sistema WABA - Drax.";
    if ((0, evo_send_recovery_service_1.isEvoSendInternalDbError)(String(initialDetail), result.status)) {
        const recovered = await (0, evo_send_recovery_service_1.recoverEvoSendTextAfterFailure)({
            url,
            body,
            apiKey: resolveEvoApiKey(),
            timeoutMs,
            status: result.status,
            detail: String(initialDetail),
        });
        accepted = recovered.ok && isEvoSendTextAccepted(recovered.json, recovered.body);
        if (accepted) {
            return toSendResult(true, "sendText OK (após restart EVO).", recovered.status, recovered.json);
        }
        const recoveredDetail = recovered.error || recovered.body || initialDetail;
        return toSendResult(false, String(recoveredDetail).slice(0, 300), recovered.status || result.status, recovered.json);
    }
    const detail = result.error ||
        result.body ||
        (result.json && typeof result.json === "object"
            ? String(result.json.message ?? "")
            : "") ||
        "Falha no envio via sistema WABA - Drax.";
    return toSendResult(false, String(detail).slice(0, 300), result.status, result.json);
}
async function sendEvoImageAlert(input) {
    const instanceName = String(input.instanceName || "").trim();
    const targetNumber = normalizeWhatsAppNumber(String(input.targetNumber || "").trim());
    const mediaBase64 = String(input.mediaBase64 || "").replace(/\s+/g, "");
    const mediaUrl = String(input.mediaUrl || "").trim();
    const mimetype = String(input.mimetype || "image/jpeg").trim() || "image/jpeg";
    const fileName = String(input.fileName || "boas-vindas.jpg").trim() || "boas-vindas.jpg";
    if (!instanceName) {
        return { ok: false, detail: "Instância EVO não informada.", status: 0 };
    }
    if (!targetNumber) {
        return { ok: false, detail: "Número de destino inválido.", status: 0 };
    }
    const mediaVariants = [];
    if (mediaBase64) {
        mediaVariants.push(`data:${mimetype};base64,${mediaBase64}`);
        mediaVariants.push(mediaBase64);
    }
    if (/^https?:\/\//i.test(mediaUrl)) {
        mediaVariants.push(mediaUrl);
    }
    if (!mediaVariants.length) {
        return { ok: false, detail: "Imagem de capa vazia.", status: 0 };
    }
    const url = buildTemplateUrl(resolveSendMediaUrlTemplate(), instanceName);
    const timeoutMs = typeof input.timeoutMs === "number" && input.timeoutMs >= 10000
        ? Math.round(input.timeoutMs)
        : Math.max(60000, (0, evo_http_client_1.defaultEvoHttpTimeoutMs)());
    let lastDetail = "Falha no envio de imagem via Evolution.";
    let lastStatus = 0;
    let lastJson = null;
    for (const media of mediaVariants) {
        const body = {
            number: targetNumber,
            mediatype: "image",
            mimetype,
            caption: String(input.caption || "").trim(),
            fileName,
            media,
        };
        const result = await (0, evo_api_config_1.evoHttpRequestWithBaseFailover)(url, "POST", {
            apiKey: resolveEvoApiKey(),
            body,
            timeoutMs,
            retries: 2,
        });
        const accepted = result.ok && isEvoSendTextAccepted(result.json, result.body);
        if (accepted) {
            return toSendResult(true, "sendMedia OK.", result.status, result.json);
        }
        lastStatus = result.status;
        lastJson = result.json;
        lastDetail =
            result.error ||
                result.body ||
                (result.json && typeof result.json === "object"
                    ? String(result.json.message ?? "")
                    : "") ||
                lastDetail;
    }
    return toSendResult(false, String(lastDetail).slice(0, 300), lastStatus, lastJson);
}
