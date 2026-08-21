"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyEvoAckStatus = classifyEvoAckStatus;
exports.waitForEvoOutboundDeliveryAck = waitForEvoOutboundDeliveryAck;
const evo_api_config_1 = require("../evo-api-config");
const evo_instance_phone_service_1 = require("../instances/evo-instance-phone.service");
const DEVICE_ACK = new Set(["DELIVERY_ACK", "READ", "PLAYED"]);
const FAIL_ACK = new Set(["ERROR", "FAILED"]);
const resolveEvoApiKey = () => String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const resolveAckTimeoutMs = () => {
    const raw = Number(process.env.WABA_WHATSAPP_ACK_TIMEOUT_MS ?? 10000);
    return Number.isFinite(raw) && raw >= 2000 ? Math.round(raw) : 10000;
};
const resolveAckPollMs = () => {
    const raw = Number(process.env.WABA_WHATSAPP_ACK_POLL_MS ?? 1500);
    return Number.isFinite(raw) && raw >= 400 ? Math.round(raw) : 1500;
};
function classifyEvoAckStatus(raw) {
    const status = String(raw || "").trim().toUpperCase();
    if (DEVICE_ACK.has(status))
        return "delivered";
    if (FAIL_ACK.has(status))
        return "error";
    return "pending";
}
function collectAckStatuses(node, messageId, sentAfterMs, depth = 0, out = []) {
    if (node == null || depth > 12)
        return out;
    if (Array.isArray(node)) {
        for (const item of node)
            collectAckStatuses(item, messageId, sentAfterMs, depth + 1, out);
        return out;
    }
    if (typeof node !== "object")
        return out;
    const rec = node;
    const key = rec.key && typeof rec.key === "object" ? rec.key : null;
    const id = String(key?.id || rec.id || rec.messageId || "").trim();
    const matchesId = !messageId || !id || id === messageId;
    const ts = Number(rec.messageTimestamp ?? rec.timestamp ?? 0);
    const tsMs = ts > 1e12 ? ts : ts > 0 ? ts * 1000 : 0;
    const matchesTime = !sentAfterMs || !tsMs || tsMs >= sentAfterMs;
    const matches = matchesId && matchesTime;
    if (matches) {
        const updates = rec.MessageUpdate ?? rec.messageUpdate ?? rec.updates;
        if (Array.isArray(updates)) {
            for (const upd of updates) {
                if (upd && typeof upd === "object") {
                    const st = String(upd.status || "").trim();
                    if (st)
                        out.push(st);
                }
            }
        }
        const update = rec.update;
        if (update && typeof update === "object") {
            const st = String(update.status || "").trim();
            if (st)
                out.push(st);
        }
        const st = String(rec.status || rec.ack || "").trim();
        if (st)
            out.push(st);
    }
    for (const value of Object.values(rec)) {
        collectAckStatuses(value, messageId, sentAfterMs, depth + 1, out);
    }
    return out;
}
function pickAckOutcome(statuses) {
    let pendingStatus = "";
    for (const raw of statuses) {
        const outcome = classifyEvoAckStatus(raw);
        if (outcome === "error")
            return { outcome: "error", status: String(raw).toUpperCase() };
        if (outcome === "delivered")
            return { outcome: "delivered", status: String(raw).toUpperCase() };
        if (raw && !pendingStatus)
            pendingStatus = String(raw).toUpperCase();
    }
    return { outcome: "pending", status: pendingStatus || "PENDING" };
}
function buildRemoteJids(targetNumber, hintJid) {
    const out = new Set();
    const add = (raw) => {
        const digits = String(raw || "").replace(/\D/g, "");
        if (!digits)
            return;
        out.add(`${digits}@s.whatsapp.net`);
    };
    if (hintJid.includes("@"))
        out.add(hintJid.trim());
    for (const variant of (0, evo_instance_phone_service_1.expandBrazilWhatsAppNumberVariants)(targetNumber))
        add(variant);
    add(targetNumber);
    return [...out];
}
async function postEvoJson(path, body) {
    const url = `${(0, evo_api_config_1.resolvePrimaryEvoApiBase)()}${path}`;
    const result = await (0, evo_api_config_1.evoHttpRequestWithBaseFailover)(url, "POST", {
        apiKey: resolveEvoApiKey(),
        body,
        timeoutMs: 8000,
        retries: 1,
    });
    if (!result.ok)
        return { json: null, status: result.status };
    return { json: result.json, status: result.status };
}
let statusMessageUnsupported = false;
async function probeFindStatusMessage(instanceName, messageId, sentAfterMs) {
    if (!messageId || statusMessageUnsupported)
        return null;
    const enc = encodeURIComponent(instanceName);
    const result = await postEvoJson(`/chat/findStatusMessage/${enc}`, { id: messageId });
    if (!result)
        return null;
    if (result.status === 404 || result.status === 405) {
        statusMessageUnsupported = true;
        return null;
    }
    if (!result.json)
        return null;
    const statuses = collectAckStatuses(result.json, messageId, sentAfterMs);
    if (!statuses.length)
        return null;
    return pickAckOutcome(statuses);
}
async function probeFindMessages(instanceName, remoteJids, messageId, sentAfterMs) {
    const enc = encodeURIComponent(instanceName);
    for (const remoteJid of remoteJids.slice(0, 4)) {
        const result = await postEvoJson(`/chat/findMessages/${enc}`, {
            where: { key: { remoteJid, fromMe: true } },
            limit: 20,
        });
        if (!result?.json)
            continue;
        const statuses = collectAckStatuses(result.json, messageId, sentAfterMs);
        if (!statuses.length)
            continue;
        return pickAckOutcome(statuses);
    }
    return null;
}
/**
 * Após sendText HTTP 2xx: espera ACK de aparelho.
 * ERROR/FAILED → não chegou. SERVER_ACK/PENDING sozinhos não confirmam entrega.
 */
async function waitForEvoOutboundDeliveryAck(input) {
    const instanceName = String(input.instanceName || "").trim();
    const messageId = String(input.messageId || "").trim();
    if (!instanceName)
        return { outcome: "pending", status: "PENDING" };
    const remoteJids = buildRemoteJids(input.targetNumber, String(input.remoteJid || ""));
    const timeoutMs = resolveAckTimeoutMs();
    const pollMs = resolveAckPollMs();
    const started = Date.now();
    const sentAfterMs = started - 8000;
    let last = { outcome: "pending", status: "PENDING" };
    while (Date.now() - started < timeoutMs) {
        const viaStatus = await probeFindStatusMessage(instanceName, messageId, sentAfterMs);
        if (viaStatus) {
            last = viaStatus;
            if (viaStatus.outcome === "delivered" || viaStatus.outcome === "error")
                return viaStatus;
        }
        const viaMessages = await probeFindMessages(instanceName, remoteJids, messageId, sentAfterMs);
        if (viaMessages) {
            last = viaMessages;
            if (viaMessages.outcome === "delivered" || viaMessages.outcome === "error")
                return viaMessages;
        }
        await sleep(pollMs);
    }
    return last;
}
