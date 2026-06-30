"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INBOUND_VALIDATION_KEYWORD = void 0;
exports.setInboundValidationFinishedHandler = setInboundValidationFinishedHandler;
exports.handleInboundValidationWebhook = handleInboundValidationWebhook;
exports.getInboundValidationStatus = getInboundValidationStatus;
exports.startInboundValidation = startInboundValidation;
exports.pruneInboundValidations = pruneInboundValidations;
const crypto_1 = __importDefault(require("crypto"));
const evo_http_client_1 = require("./evo-http.client");
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
exports.INBOUND_VALIDATION_KEYWORD = String(process.env.INBOUND_VALIDATION_KEYWORD || "CONFIRMAR").trim() || "CONFIRMAR";
const VALIDATION_TIMEOUT_MS = Math.max(60000, Math.min(600000, Number(process.env.INBOUND_VALIDATION_TIMEOUT_MS || 300000) || 300000));
const VALIDATION_POLL_MS = Math.max(2000, Math.min(10000, Number(process.env.INBOUND_VALIDATION_POLL_MS || 3000) || 3000));
const REPLY_DELAY_MS = Math.max(2000, Math.min(30000, Number(process.env.INBOUND_VALIDATION_REPLY_DELAY_MS || 4000) || 4000));
const validations = new Map();
/** Uma valida├º├úo ativa por inst├óncia ÔÇö evita loops ├│rf├úos ap├│s novo POST. */
const activeValidationByInstance = new Map();
/** Uma resposta por conversa (inst├óncia + chat) dentro da janela. */
const recentReplyByConversation = new Map();
const REPLY_DEDUPE_MS = 15 * 60 * 1000;
const replyInFlight = new Set();
let onValidationFinished = null;
function setInboundValidationFinishedHandler(handler) {
    onValidationFinished = handler;
}
function isRecordActive(record) {
    return !record.finished && !record.cancelled;
}
function cancelValidationRecord(record) {
    if (record.cancelled || record.finished)
        return;
    record.cancelled = true;
}
function getActiveValidationForInstance(instanceName) {
    const id = activeValidationByInstance.get(instanceName);
    if (!id)
        return null;
    const record = validations.get(id);
    if (!record || !isRecordActive(record)) {
        activeValidationByInstance.delete(instanceName);
        return null;
    }
    return record;
}
function stopValidationsForInstance(instanceName, exceptValidationId) {
    for (const [id, record] of validations.entries()) {
        if (record.instanceName !== instanceName)
            continue;
        if (exceptValidationId && id === exceptValidationId)
            continue;
        cancelValidationRecord(record);
        validations.delete(id);
    }
    if (!exceptValidationId || activeValidationByInstance.get(instanceName) !== exceptValidationId) {
        activeValidationByInstance.delete(instanceName);
    }
}
function conversationReplyKey(record) {
    const target = resolveSendTarget(record.referenceJid, record.referenceNumber);
    if (!target)
        return null;
    return `${record.instanceName}:${target}`;
}
function notifyFinished(record) {
    if (!onValidationFinished)
        return;
    try {
        onValidationFinished(publicStatus(record));
    }
    catch (e) {
        console.error("[validacao-inbound] onFinished:", e);
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
function jidToNumber(jid) {
    const s = String(jid || "").trim();
    if (!s)
        return "";
    return normalizeWhatsAppNumber(s.split("@")[0] || s);
}
async function callEvo(url, method, body) {
    const result = await (0, evo_http_client_1.evoHttpRequest)(url, method, {
        apiKey: EVO_API_KEY,
        body,
        timeoutMs: 12000,
    });
    return {
        ok: result.ok,
        status: result.status,
        body: result.body,
        json: result.json,
    };
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
function resolveSendTarget(referenceJid, referenceNumber) {
    const jid = String(referenceJid || "").trim();
    if (jid.includes("@"))
        return jid;
    return normalizeWhatsAppNumber(String(referenceNumber || "").trim());
}
async function fetchConnectedInstance(instanceName) {
    const response = await callEvo(EVO_INSTANCES_URL, "GET");
    if (!response.ok)
        return null;
    const raw = response.json;
    const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.response)
            ? raw.response
            : Array.isArray(raw?.data)
                ? raw.data
                : [];
    for (const item of list) {
        const inst = (item?.instance ?? item);
        const status = String(inst?.connectionStatus ?? inst?.status ?? "").toLowerCase();
        if (!status.includes("open"))
            continue;
        const instancia = (0, evo_instance_key_1.resolveEvoInstanceKey)(inst);
        if (instancia !== instanceName)
            continue;
        const numero = extractInstanceNumber(inst);
        if (!numero)
            return null;
        return { instancia, numero };
    }
    return null;
}
function collectMessageTexts(node, out, depth = 0) {
    if (depth > 12 || node == null)
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
function textMatchesKeyword(texts, keyword) {
    const needle = keyword.trim().toLowerCase();
    if (!needle)
        return false;
    return texts.some((t) => t.trim().toLowerCase() === needle);
}
function extractMessageTimestampMs(node) {
    const message = node.message;
    const candidates = [node.messageTimestamp, message?.messageTimestamp];
    for (const raw of candidates) {
        if (raw == null || raw === "")
            continue;
        const n = typeof raw === "number" ? raw : Number(String(raw).trim());
        if (!Number.isFinite(n) || n <= 0)
            continue;
        return n < 1000000000000 ? Math.round(n * 1000) : Math.round(n);
    }
    return null;
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
    return isLikelyWhatsAppRestriction(record.sendDetail);
}
function publicStatus(record) {
    return {
        validationId: record.validationId,
        instanceName: record.instanceName,
        instanceNumber: record.instanceNumber,
        keyword: record.keyword,
        phase: record.phase,
        receiveTest: { ...record.receiveTest },
        sendTest: { ...record.sendTest },
        finished: record.finished,
        restrictionSuspected: computeRestrictionSuspected(record),
        referenceNumber: record.referenceNumber,
        webhookConfigured: record.webhookConfigured,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
    };
}
function tryFinalize(record) {
    if (record.finished)
        return;
    const receiveDone = record.receiveTest.success !== null;
    const sendDone = record.sendTest.success !== null;
    if (!receiveDone || !sendDone)
        return;
    record.finished = true;
    record.finishedAt = new Date().toISOString();
    record.phase =
        record.receiveTest.success === true && record.sendTest.success === true
            ? "completed"
            : "failed";
    notifyFinished(record);
}
function finalizeExpired(record) {
    if (record.finished)
        return;
    if (record.receiveTest.success === null) {
        record.receiveTest = {
            success: false,
            detail: `Tempo esgotado sem receber "${record.keyword}" no n├║mero da inst├óncia.`,
        };
        record.phase = "expired";
    }
    if (record.sendTest.success === null) {
        record.sendTest = {
            success: false,
            detail: record.receiveTest.success
                ? "Tempo esgotado sem confirmar resposta na conversa."
                : "Resposta n├úo testada ÔÇö recep├º├úo n├úo confirmada.",
        };
    }
    tryFinalize(record);
}
async function ensureInstanceWebhook(instanceName) {
    if (!WABA_PUBLIC_BASE_URL)
        return false;
    const webhookUrl = `${WABA_PUBLIC_BASE_URL}/webhooks/evolution`;
    const setUrl = `${EVO_API_BASE}/webhook/set/${encodeURIComponent(instanceName)}`;
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
    return result.ok;
}
function isInboundHitFresh(hit, options) {
    const minTs = options?.minTimestampMs;
    if (minTs != null && hit.messageTimestampMs != null) {
        return hit.messageTimestampMs >= minTs;
    }
    if (options?.requireTimestamp)
        return false;
    return true;
}
function walkInboundHits(node, out, keyword, options, depth = 0) {
    if (depth > 14 || node == null)
        return;
    if (Array.isArray(node)) {
        for (const item of node)
            walkInboundHits(item, out, keyword, options, depth + 1);
        return;
    }
    if (typeof node !== "object")
        return;
    const obj = node;
    const fromMe = extractFromMe(obj);
    const remoteJid = extractRemoteJid(obj);
    const texts = [];
    collectMessageTexts(obj.message ?? obj, texts);
    if (fromMe === false && remoteJid && textMatchesKeyword(texts, keyword)) {
        const hit = {
            remoteJid,
            referenceNumber: jidToNumber(remoteJid),
            texts,
            messageTimestampMs: extractMessageTimestampMs(obj),
        };
        if (isInboundHitFresh(hit, options))
            out.push(hit);
    }
    for (const value of Object.values(obj)) {
        if (value && typeof value === "object")
            walkInboundHits(value, out, keyword, options, depth + 1);
    }
}
function findInboundInPayload(payload, keyword, options) {
    const hits = [];
    walkInboundHits(payload, hits, keyword, options);
    if (!hits.length)
        return null;
    hits.sort((a, b) => (b.messageTimestampMs ?? 0) - (a.messageTimestampMs ?? 0));
    return hits[0];
}
function extractFromMe(node) {
    const key = node.key;
    if (typeof key?.fromMe === "boolean")
        return key.fromMe;
    if (typeof node.fromMe === "boolean")
        return node.fromMe;
    return null;
}
function extractRemoteJid(node) {
    const key = node.key;
    const candidates = [
        key?.remoteJid,
        key?.remoteJidAlt,
        node.remoteJid,
        node.chatId,
    ];
    for (const c of candidates) {
        const s = String(c || "").trim();
        if (s && !s.includes("@g.us"))
            return s;
    }
    return "";
}
async function findInboundViaApi(instanceName, keyword, minTimestampMs) {
    const url = `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(instanceName)}`;
    const bodies = [{ limit: 40 }, { take: 40 }, {}];
    const searchOptions = {
        minTimestampMs: minTimestampMs - 3000,
        requireTimestamp: true,
    };
    for (const body of bodies) {
        const result = await callEvo(url, "POST", body);
        if (!result.ok)
            continue;
        const hit = findInboundInPayload(result.json, keyword, searchOptions);
        if (hit)
            return hit;
    }
    return null;
}
async function findReplyInChat(instanceName, referenceJid, replyMarker) {
    const remoteJid = referenceJid.includes("@") ? referenceJid : `${referenceJid}@s.whatsapp.net`;
    const url = `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(instanceName)}`;
    const bodies = [
        { where: { key: { remoteJid } }, limit: 30 },
        { where: { key: { remoteJid } }, take: 30 },
        { limit: 40 },
    ];
    for (const body of bodies) {
        const result = await callEvo(url, "POST", body);
        if (!result.ok)
            continue;
        const texts = [];
        collectMessageTexts(result.json, texts);
        const needle = replyMarker.toLowerCase();
        if (texts.some((t) => t.toLowerCase().includes(needle)))
            return true;
    }
    return false;
}
function markInboundReceived(record, hit, via) {
    if (record.receiveTest.success === true)
        return;
    record.referenceJid = hit.remoteJid;
    record.referenceNumber = hit.referenceNumber;
    record.inboundReceivedAt = hit.messageTimestampMs ?? Date.now();
    record.phase = "inbound_received";
    record.receiveTest = {
        success: true,
        detail: `Mensagem "${record.keyword}" recebida (${via}).`,
    };
}
async function sendContextualReply(record) {
    if (record.cancelled || record.finished || !record.referenceNumber || record.sendAttempted)
        return;
    const convKey = conversationReplyKey(record);
    if (convKey) {
        const lastSentAt = recentReplyByConversation.get(convKey);
        if (lastSentAt != null && Date.now() - lastSentAt < REPLY_DEDUPE_MS) {
            record.phase = "sending_reply";
            record.sendAttempted = true;
            record.sendHttpOk = true;
            record.sendDetail = "dedupe";
            record.sendTest = {
                success: true,
                detail: "Resposta j├í enviada nesta conversa (valida├º├úo ├║nica).",
            };
            tryFinalize(record);
            return;
        }
        if (replyInFlight.has(convKey))
            return;
        replyInFlight.add(convKey);
    }
    record.phase = "sending_reply";
    record.sendAttempted = true;
    const text = `Valida├º├úo WABA conclu├¡da. ${record.replyMarker}`;
    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, record.instanceName);
    const numero = resolveSendTarget(record.referenceJid, record.referenceNumber);
    if (!numero) {
        if (convKey)
            replyInFlight.delete(convKey);
        record.sendHttpOk = false;
        record.sendDetail = "Destino da resposta n├úo identificado.";
        record.sendTest = {
            success: false,
            detail: "N├úo foi poss├¡vel identificar o chat do outro WhatsApp para responder.",
        };
        tryFinalize(record);
        return;
    }
    const sendBody = EVO_SEND_TEXT_V1
        ? { number: numero, textMessage: { text } }
        : { number: numero, text, textMessage: { text } };
    try {
        const result = await callEvo(sendUrl, "POST", sendBody);
        record.sendHttpOk = result.ok;
        if (!result.ok) {
            const detail = result.json?.message ||
                result.json?.error ||
                result.body.slice(0, 180) ||
                `HTTP ${result.status}`;
            record.sendDetail = String(detail);
            const restricted = isLikelyWhatsAppRestriction(record.sendDetail, result.status);
            record.sendTest = {
                success: false,
                detail: restricted
                    ? `Evolution recusou a resposta: ${record.sendDetail}`
                    : `Falha t├®cnica ao responder: ${record.sendDetail}`,
            };
            tryFinalize(record);
            return;
        }
        if (convKey)
            recentReplyByConversation.set(convKey, Date.now());
        record.sendDetail = "sendText OK";
        record.sendTest = {
            success: true,
            detail: "Resposta enviada na mesma conversa (ap├│s mensagem recebida).",
        };
        tryFinalize(record);
    }
    finally {
        if (convKey)
            replyInFlight.delete(convKey);
    }
}
async function runValidationLoop(record) {
    if (record.loopRunning)
        return;
    record.loopRunning = true;
    const deadline = Date.now() + VALIDATION_TIMEOUT_MS;
    try {
        while (Date.now() < deadline && !record.finished && !record.cancelled) {
            if (record.receiveTest.success !== true) {
                try {
                    const hit = await findInboundViaApi(record.instanceName, record.keyword, record.validationStartedAtMs);
                    if (hit)
                        markInboundReceived(record, hit, "findMessages");
                }
                catch {
                    // mant├®m polling ÔÇö falha transit├│ria na Evolution
                }
            }
            if (record.receiveTest.success === true &&
                record.inboundReceivedAt &&
                Date.now() >= record.inboundReceivedAt + REPLY_DELAY_MS &&
                !record.sendAttempted) {
                await sendContextualReply(record);
            }
            if (record.sendAttempted &&
                record.sendHttpOk &&
                record.sendTest.success !== true &&
                record.referenceJid) {
                const found = await findReplyInChat(record.instanceName, record.referenceJid, record.replyMarker);
                if (found) {
                    record.sendTest = {
                        success: true,
                        detail: "Resposta confirmada no hist├│rico da conversa.",
                    };
                    tryFinalize(record);
                }
            }
            if (!record.finished) {
                await new Promise((r) => setTimeout(r, VALIDATION_POLL_MS));
            }
        }
    }
    finally {
        record.loopRunning = false;
        if (!record.finished)
            finalizeExpired(record);
    }
}
function handleInboundValidationWebhook(body) {
    if (!body || typeof body !== "object")
        return;
    const payload = body;
    const instanceName = String(payload.instance || payload.instanceName || "").trim();
    const event = String(payload.event || "").toUpperCase();
    if (event && event !== "MESSAGES_UPSERT" && event !== "MESSAGES.UPSERT")
        return;
    const active = instanceName ? getActiveValidationForInstance(instanceName) : null;
    const candidates = active
        ? [active]
        : [...validations.values()].filter((record) => isRecordActive(record));
    for (const record of candidates) {
        if (instanceName && instanceName !== record.instanceName)
            continue;
        const hit = findInboundInPayload(payload, record.keyword, {
            minTimestampMs: record.validationStartedAtMs - 3000,
        });
        if (!hit)
            continue;
        markInboundReceived(record, hit, "webhook");
        break;
    }
}
function getInboundValidationStatus(validationId) {
    const record = validations.get(validationId);
    if (!record)
        return null;
    return publicStatus(record);
}
async function startInboundValidation(input) {
    const instanceName = String(input.instanceName || "").trim();
    if (!instanceName) {
        return { error: "Nome da inst├óncia ├® obrigat├│rio." };
    }
    const numberHint = normalizeWhatsAppNumber(String(input.instanceNumberHint || "").trim());
    let connected = await fetchConnectedInstance(instanceName);
    if (!connected && numberHint) {
        connected = { instancia: instanceName, numero: numberHint };
    }
    if (!connected) {
        return {
            error: `Inst├óncia "${instanceName}" n├úo est├í conectada (status open) na Evolution.`,
        };
    }
    const existing = getActiveValidationForInstance(connected.instancia);
    if (existing) {
        return { validationId: existing.validationId, status: publicStatus(existing) };
    }
    stopValidationsForInstance(connected.instancia);
    const validationId = crypto_1.default.randomUUID();
    const replyMarker = `WABA-VAL:${validationId.slice(0, 8)}`;
    const validationStartedAtMs = Date.now();
    const startedAt = new Date(validationStartedAtMs).toISOString();
    const webhookOk = await ensureInstanceWebhook(instanceName);
    const record = {
        validationId,
        instanceName: connected.instancia,
        instanceNumber: connected.numero,
        keyword: exports.INBOUND_VALIDATION_KEYWORD,
        replyMarker,
        phase: "awaiting_inbound",
        receiveTest: {
            success: null,
            detail: webhookOk
                ? `Aguardando "${exports.INBOUND_VALIDATION_KEYWORD}" de outro WhatsApp (n├úo o que est├í integrando)ÔÇª`
                : `Aguardando "${exports.INBOUND_VALIDATION_KEYWORD}" de outro WhatsAppÔÇª (webhook p├║blico indispon├¡vel; usando consulta peri├│dica).`,
        },
        sendTest: {
            success: null,
            detail: "Aguardando mensagem do outro WhatsApp para responder na mesma conversaÔÇª",
        },
        finished: false,
        restrictionSuspected: false,
        referenceNumber: null,
        referenceJid: null,
        inboundReceivedAt: null,
        validationStartedAtMs,
        webhookConfigured: webhookOk,
        sendAttempted: false,
        sendHttpOk: false,
        sendDetail: "",
        loopRunning: false,
        cancelled: false,
        startedAt,
        finishedAt: null,
    };
    validations.set(validationId, record);
    activeValidationByInstance.set(connected.instancia, validationId);
    void runValidationLoop(record);
    return { validationId, status: publicStatus(record) };
}
function pruneInboundValidations() {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, record] of validations.entries()) {
        const started = new Date(record.startedAt).getTime();
        if (started < cutoff) {
            cancelValidationRecord(record);
            validations.delete(id);
            if (activeValidationByInstance.get(record.instanceName) === id) {
                activeValidationByInstance.delete(record.instanceName);
            }
        }
    }
    const replyCutoff = Date.now() - REPLY_DEDUPE_MS;
    for (const [key, at] of recentReplyByConversation.entries()) {
        if (at < replyCutoff)
            recentReplyByConversation.delete(key);
    }
}
setInterval(() => pruneInboundValidations(), 30 * 60 * 1000).unref?.();
