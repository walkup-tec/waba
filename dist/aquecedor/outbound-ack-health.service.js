"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyEvoOutboundSample = exports.normalizeEvoMessageAckStatus = exports.isEvoAckProgressed = exports.isEvoAckFailure = exports.extractEvoMessageAckStatus = void 0;
exports.clearAquecedorOutboundHealthCache = clearAquecedorOutboundHealthCache;
exports.getCachedAquecedorOutboundHealth = getCachedAquecedorOutboundHealth;
exports.rememberAquecedorOutboundHealth = rememberAquecedorOutboundHealth;
exports.collectFromMeAckStatusesFromPayload = collectFromMeAckStatusesFromPayload;
exports.evaluateOutboundSamplePayload = evaluateOutboundSamplePayload;
/**
 * Saúde de outbound EVO (MessageUpdate / findStatusMessage).
 * Instâncias "open" com 100% ERROR no fromMe não aquecem ninguém.
 */
const delivery_verify_helpers_1 = require("./delivery-verify.helpers");
Object.defineProperty(exports, "classifyEvoOutboundSample", { enumerable: true, get: function () { return delivery_verify_helpers_1.classifyEvoOutboundSample; } });
Object.defineProperty(exports, "extractEvoMessageAckStatus", { enumerable: true, get: function () { return delivery_verify_helpers_1.extractEvoMessageAckStatus; } });
Object.defineProperty(exports, "isEvoAckFailure", { enumerable: true, get: function () { return delivery_verify_helpers_1.isEvoAckFailure; } });
Object.defineProperty(exports, "isEvoAckProgressed", { enumerable: true, get: function () { return delivery_verify_helpers_1.isEvoAckProgressed; } });
Object.defineProperty(exports, "normalizeEvoMessageAckStatus", { enumerable: true, get: function () { return delivery_verify_helpers_1.normalizeEvoMessageAckStatus; } });
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
function cacheKey(name) {
    return String(name || "")
        .trim()
        .toLowerCase();
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
function collectFromMeAckStatusesFromPayload(json) {
    const records = json?.messages?.records ||
        json?.records ||
        [];
    if (!Array.isArray(records))
        return [];
    return records.map((rec) => (0, delivery_verify_helpers_1.extractEvoMessageAckStatus)(rec));
}
function evaluateOutboundSamplePayload(json) {
    const statuses = collectFromMeAckStatusesFromPayload(json);
    const errorCount = statuses.filter((s) => (0, delivery_verify_helpers_1.isEvoAckFailure)(s)).length;
    return {
        class: (0, delivery_verify_helpers_1.classifyEvoOutboundSample)(statuses, { minSamples: 3 }),
        sampleSize: statuses.length,
        errorCount,
        statuses,
    };
}
