"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyEvoOutboundSample = exports.normalizeEvoMessageAckStatus = exports.isEvoAckProgressed = exports.isEvoAckFailure = exports.extractEvoMessageAckStatus = exports.AQUECEDOR_OUTBOUND_SAMPLE_MAX_AGE_MS = void 0;
exports.evoRecordTimestampMs = evoRecordTimestampMs;
exports.clearAquecedorOutboundHealthCache = clearAquecedorOutboundHealthCache;
exports.getCachedAquecedorOutboundHealth = getCachedAquecedorOutboundHealth;
exports.rememberAquecedorOutboundHealth = rememberAquecedorOutboundHealth;
exports.collectFromMeAckStatusesFromPayload = collectFromMeAckStatusesFromPayload;
exports.evaluateOutboundSamplePayload = evaluateOutboundSamplePayload;
/**
 * Saúde de outbound EVO (MessageUpdate / findStatusMessage).
 * Instâncias "open" com ERROR recente no fromMe não aquecem ninguém.
 * Amostras velhas não expulsam: senão um QR reconectado fica fora para sempre.
 */
const delivery_verify_helpers_1 = require("./delivery-verify.helpers");
Object.defineProperty(exports, "classifyEvoOutboundSample", { enumerable: true, get: function () { return delivery_verify_helpers_1.classifyEvoOutboundSample; } });
Object.defineProperty(exports, "extractEvoMessageAckStatus", { enumerable: true, get: function () { return delivery_verify_helpers_1.extractEvoMessageAckStatus; } });
Object.defineProperty(exports, "isEvoAckFailure", { enumerable: true, get: function () { return delivery_verify_helpers_1.isEvoAckFailure; } });
Object.defineProperty(exports, "isEvoAckProgressed", { enumerable: true, get: function () { return delivery_verify_helpers_1.isEvoAckProgressed; } });
Object.defineProperty(exports, "normalizeEvoMessageAckStatus", { enumerable: true, get: function () { return delivery_verify_helpers_1.normalizeEvoMessageAckStatus; } });
/** Só conta fromMe nesta janela. Padrão 12h. */
exports.AQUECEDOR_OUTBOUND_SAMPLE_MAX_AGE_MS = Math.max(10 * 60 * 1000, Number(process.env.AQUECEDOR_OUTBOUND_SAMPLE_MAX_AGE_MS ?? 12 * 60 * 60 * 1000) ||
    12 * 60 * 60 * 1000);
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
function cacheKey(name) {
    return String(name || "")
        .trim()
        .toLowerCase();
}
function evoRecordTimestampMs(rec) {
    if (!rec || typeof rec !== "object")
        return null;
    const obj = rec;
    const nested = obj.message && typeof obj.message === "object"
        ? obj.message
        : null;
    const raw = obj.messageTimestamp ?? nested?.messageTimestamp ?? obj.timestamp;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return n > 1e12 ? n : n * 1000;
}
function clearAquecedorOutboundHealthCache() {
    cache.clear();
}
function getCachedAquecedorOutboundHealth(instanceName) {
    const key = cacheKey(instanceName);
    const row = cache.get(key);
    if (!row)
        return null;
    if (Date.now() - row.checkedAtMs > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return row;
}
function rememberAquecedorOutboundHealth(instanceName, health, meta) {
    const key = cacheKey(instanceName);
    if (!key)
        return;
    cache.set(key, {
        class: health,
        checkedAtMs: Date.now(),
        sampleSize: meta?.sampleSize ?? 0,
        errorCount: meta?.errorCount ?? 0,
    });
}
function collectFromMeAckStatusesFromPayload(json, options) {
    const records = json?.messages?.records ||
        json?.records ||
        [];
    if (!Array.isArray(records))
        return [];
    const nowMs = options?.nowMs ?? Date.now();
    const maxAgeMs = options?.maxAgeMs ?? exports.AQUECEDOR_OUTBOUND_SAMPLE_MAX_AGE_MS;
    const out = [];
    for (const rec of records) {
        const ts = evoRecordTimestampMs(rec);
        if (ts != null && nowMs - ts > maxAgeMs)
            continue;
        out.push((0, delivery_verify_helpers_1.extractEvoMessageAckStatus)(rec));
    }
    return out;
}
function evaluateOutboundSamplePayload(json, options) {
    const statuses = collectFromMeAckStatusesFromPayload(json, options);
    const errorCount = statuses.filter((s) => (0, delivery_verify_helpers_1.isEvoAckFailure)(s)).length;
    return {
        class: (0, delivery_verify_helpers_1.classifyEvoOutboundSample)(statuses, { minSamples: 3 }),
        sampleSize: statuses.length,
        errorCount,
        statuses,
    };
}
