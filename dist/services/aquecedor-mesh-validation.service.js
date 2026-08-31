"use strict";
/** Confirmação de pares do mesh bootstrap via webhook MESSAGES_UPSERT. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.beginAquecedorMeshSession = beginAquecedorMeshSession;
exports.endAquecedorMeshSession = endAquecedorMeshSession;
exports.registerAquecedorMeshPending = registerAquecedorMeshPending;
exports.isAquecedorMeshPairConfirmed = isAquecedorMeshPairConfirmed;
exports.getAquecedorMeshConfirmDetail = getAquecedorMeshConfirmDetail;
exports.handleAquecedorMeshWebhook = handleAquecedorMeshWebhook;
const pendingByMarker = new Map();
let meshSessionActive = false;
function normalizeInstanceKey(name) {
    return String(name || "").trim().toLowerCase();
}
function buildComparableDigitKeys(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    const out = new Set();
    if (!digits)
        return out;
    out.add(digits);
    if (digits.startsWith("55") && digits.length > 11)
        out.add(digits.slice(2));
    if (digits.startsWith("1") && digits.length >= 11)
        out.add(digits.slice(1));
    if (digits.length > 10)
        out.add(digits.slice(-10));
    if (digits.length > 11)
        out.add(digits.slice(-11));
    return out;
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
    const candidates = [key?.remoteJid, key?.remoteJidAlt, node.remoteJid, node.chatId];
    for (const candidate of candidates) {
        const text = String(candidate || "").trim();
        if (text && !text.includes("@g.us"))
            return text;
    }
    return "";
}
function remoteJidMatchesOrigem(remoteJid, origDigitKeys) {
    const jidDigits = String(remoteJid || "").split("@")[0].replace(/\D/g, "");
    if (!jidDigits)
        return false;
    if (origDigitKeys.has(jidDigits))
        return true;
    const comparable = buildComparableDigitKeys(jidDigits);
    for (const key of comparable) {
        if (origDigitKeys.has(key))
            return true;
    }
    return false;
}
function payloadIncludesMeshMarker(node, marker, depth = 0) {
    if (depth > 14 || node == null)
        return false;
    if (Array.isArray(node)) {
        return node.some((item) => payloadIncludesMeshMarker(item, marker, depth + 1));
    }
    if (typeof node !== "object")
        return false;
    const obj = node;
    const texts = [];
    collectMessageTexts(obj.message ?? obj, texts);
    const needle = marker.toLowerCase();
    if (texts.some((text) => text.toLowerCase().includes(needle)))
        return true;
    for (const value of Object.values(obj)) {
        if (value && typeof value === "object") {
            if (payloadIncludesMeshMarker(value, marker, depth + 1))
                return true;
        }
    }
    return false;
}
function beginAquecedorMeshSession() {
    meshSessionActive = true;
    pendingByMarker.clear();
}
function endAquecedorMeshSession() {
    meshSessionActive = false;
    pendingByMarker.clear();
}
function registerAquecedorMeshPending(input) {
    if (!meshSessionActive)
        return;
    const marker = String(input.marker || "").trim().toLowerCase();
    if (!marker)
        return;
    pendingByMarker.set(marker, {
        marker,
        destInstance: String(input.destInstance || "").trim(),
        origInstance: String(input.origInstance || "").trim(),
        origDigitKeys: buildComparableDigitKeys(input.origDigits),
        sendStartedAtMs: input.sendStartedAtMs,
        confirmedAtMs: null,
        confirmDetail: "",
    });
}
function isAquecedorMeshPairConfirmed(marker) {
    const key = String(marker || "").trim().toLowerCase();
    const row = pendingByMarker.get(key);
    return Boolean(row?.confirmedAtMs);
}
function getAquecedorMeshConfirmDetail(marker) {
    const key = String(marker || "").trim().toLowerCase();
    return pendingByMarker.get(key)?.confirmDetail || "";
}
function handleAquecedorMeshWebhook(body) {
    if (!meshSessionActive || !body || typeof body !== "object")
        return;
    const payload = body;
    const event = String(payload.event || "").toUpperCase();
    if (event && event !== "MESSAGES_UPSERT" && event !== "MESSAGES.UPSERT")
        return;
    const instanceName = String(payload.instance || payload.instanceName || payload.sender || "").trim();
    const instanceKey = normalizeInstanceKey(instanceName);
    for (const row of pendingByMarker.values()) {
        if (row.confirmedAtMs)
            continue;
        if (instanceKey && normalizeInstanceKey(row.destInstance) !== instanceKey)
            continue;
        if (!payloadIncludesMeshMarker(payload, row.marker))
            continue;
        const fromMe = extractFromMe(payload);
        if (fromMe === true)
            continue;
        const remoteJid = extractRemoteJid(payload);
        if (remoteJid && !remoteJidMatchesOrigem(remoteJid, row.origDigitKeys))
            continue;
        row.confirmedAtMs = Date.now();
        row.confirmDetail = remoteJid
            ? `Webhook confirmou entrega (${instanceName || row.destInstance}, ${remoteJid}).`
            : `Webhook confirmou entrega (${instanceName || row.destInstance}).`;
    }
}
