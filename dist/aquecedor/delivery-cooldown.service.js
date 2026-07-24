"use strict";
/**
 * Cooldown de pares do aquecedor após falha de entrega confirmada.
 * Evita reescolher o mesmo A→B e travar o ciclo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordDirectedDeliveryFailure = exports.isDirectedDeliveryBlocked = exports.listBlockedDirectedKeys = exports.buildDirectedCooldownKey = void 0;
const fs = require("fs/promises");
const path = require("path");
const data_path_1 = require("../data-path");
const STORE_FILE = (0, data_path_1.resolveDataFile)("aquecedor-delivery-cooldowns.json");
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
let cache = null;
let writeTimer = null;
function buildDirectedCooldownKey(origem, destino) {
    return `${String(origem || "").trim().toLowerCase()}→${String(destino || "").trim().toLowerCase()}`;
}
exports.buildDirectedCooldownKey = buildDirectedCooldownKey;
async function loadStore() {
    if (cache)
        return cache;
    try {
        const raw = await fs.readFile(STORE_FILE, "utf8");
        const parsed = JSON.parse(raw);
        cache = {
            directed: parsed?.directed && typeof parsed.directed === "object" ? parsed.directed : {},
        };
    }
    catch {
        cache = { directed: {} };
    }
    return cache;
}
function enqueueWrite(store) {
    cache = store;
    if (writeTimer)
        clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
        writeTimer = null;
        void fs
            .mkdir(path.dirname(STORE_FILE), { recursive: true })
            .then(() => fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8"))
            .catch((err) => console.warn("[Aquecedor] cooldown persist:", err?.message || err));
    }, 250);
}
function pruneExpired(store, nowMs = Date.now()) {
    for (const [key, entry] of Object.entries(store.directed)) {
        if (!entry || entry.untilMs <= nowMs)
            delete store.directed[key];
    }
}
async function listBlockedDirectedKeys(nowMs = Date.now()) {
    const store = await loadStore();
    pruneExpired(store, nowMs);
    enqueueWrite(store);
    return new Set(Object.entries(store.directed)
        .filter(([, entry]) => entry.untilMs > nowMs)
        .map(([key]) => key));
}
exports.listBlockedDirectedKeys = listBlockedDirectedKeys;
async function isDirectedDeliveryBlocked(origem, destino, nowMs = Date.now()) {
    const key = buildDirectedCooldownKey(origem, destino);
    if (!key.includes("→"))
        return false;
    const blocked = await listBlockedDirectedKeys(nowMs);
    return blocked.has(key);
}
exports.isDirectedDeliveryBlocked = isDirectedDeliveryBlocked;
async function recordDirectedDeliveryFailure(input) {
    const store = await loadStore();
    const nowMs = Date.now();
    pruneExpired(store, nowMs);
    const key = buildDirectedCooldownKey(input.origem, input.destino);
    const untilMs = nowMs + Math.max(60_000, input.cooldownMs ?? DEFAULT_COOLDOWN_MS);
    store.directed[key] = {
        untilMs,
        reason: String(input.reason || "falha de entrega").slice(0, 240),
        updatedAt: new Date().toISOString(),
    };
    enqueueWrite(store);
    return { key, untilMs };
}
exports.recordDirectedDeliveryFailure = recordDirectedDeliveryFailure;
