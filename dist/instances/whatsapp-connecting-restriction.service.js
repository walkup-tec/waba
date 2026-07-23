"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WA_CONNECTING_RESTRICTION_MS = void 0;
exports.WA_CONNECTING_RECHECK_MS = void 0;
exports.syncWhatsappConnectingRestriction = syncWhatsappConnectingRestriction;
exports.markWhatsappRestrictionExplicit = markWhatsappRestrictionExplicit;
exports.clearWhatsappConnectingRestriction = clearWhatsappConnectingRestriction;
exports.purgeAutomaticWhatsappConnectingRestrictions = purgeAutomaticWhatsappConnectingRestrictions;
exports.getWhatsappConnectingRestrictionMap = getWhatsappConnectingRestrictionMap;
exports.recheckWhatsappConnectingRestrictions = recheckWhatsappConnectingRestrictions;
const fs_1 = require("fs");
const path = require("path");
const data_path_1 = require("../data-path");
const evo_connection_state_service_1 = require("./evo-connection-state.service");
const STORE_FILE = (0, data_path_1.resolveDataFile)("whatsapp-connecting-restriction.json");
/** Janela de UI: 3 horas (mantida para restrições explícitas futuras). */
exports.WA_CONNECTING_RESTRICTION_MS = 3 * 60 * 60 * 1000;
/** Rechecagem periódica do connectionState. */
exports.WA_CONNECTING_RECHECK_MS = 60 * 60 * 1000;
let cache = null;
function normalizeKey(instanceName) {
    return String(instanceName || "").trim().toLowerCase();
}
function defaultStore() {
    return { version: 1, updatedAt: new Date().toISOString(), instances: {} };
}
async function loadStore() {
    if (cache)
        return cache;
    try {
        const raw = await fs_1.promises.readFile(STORE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1 && parsed.instances && typeof parsed.instances === "object") {
            cache = {
                version: 1,
                updatedAt: String(parsed.updatedAt || new Date().toISOString()),
                instances: parsed.instances,
            };
            return cache;
        }
    }
    catch {
        /* primeiro uso */
    }
    cache = defaultStore();
    return cache;
}
async function saveStore(store) {
    store.updatedAt = new Date().toISOString();
    cache = store;
    await fs_1.promises.mkdir(path.dirname(STORE_FILE), { recursive: true });
    const tmp = `${STORE_FILE}.tmp`;
    await fs_1.promises.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
    await fs_1.promises.rename(tmp, STORE_FILE);
}
/**
 * connecting sozinho NÃO é restrição WhatsApp (QR/reconnect/device_removed).
 * Remove tags automáticas legadas.
 */
async function syncWhatsappConnectingRestriction(instanceName, liveState) {
    const name = String(instanceName || "").trim();
    if (!name)
        return null;
    const key = normalizeKey(name);
    const store = await loadStore();
    const state = String(liveState || "").trim().toLowerCase();
    const existing = store.instances[key];
    if (!existing)
        return null;
    const source = existing.source || "connecting-auto";
    if (source !== "explicit") {
        delete store.instances[key];
        await saveStore(store);
        console.warn(`[WA-Restrição] removida tag automática de ${name} (live=${state || "—"}; connecting ≠ restrição).`);
        return null;
    }
    const untilMs = new Date(existing.restrictedUntil).getTime();
    const now = Date.now();
    if (!Number.isFinite(untilMs) || untilMs <= now || state === "open" || state === "close") {
        delete store.instances[key];
        await saveStore(store);
        return null;
    }
    existing.lastCheckedAt = new Date().toISOString();
    existing.lastLiveState = state || existing.lastLiveState;
    store.instances[key] = existing;
    await saveStore(store);
    return { ...existing };
}
async function markWhatsappRestrictionExplicit(instanceName, detail) {
    const name = String(instanceName || "").trim();
    if (!name)
        return null;
    const key = normalizeKey(name);
    const store = await loadStore();
    const now = Date.now();
    const detectedAt = new Date().toISOString();
    const row = {
        detectedAt,
        restrictedUntil: new Date(now + exports.WA_CONNECTING_RESTRICTION_MS).toISOString(),
        lastCheckedAt: detectedAt,
        lastLiveState: null,
        source: "explicit",
    };
    store.instances[key] = row;
    await saveStore(store);
    console.warn(`[WA-Restrição] explícita em ${name} até ${row.restrictedUntil}${detail ? ` (${String(detail).slice(0, 120)})` : ""}.`);
    return { ...row };
}
async function clearWhatsappConnectingRestriction(instanceName) {
    const key = normalizeKey(instanceName);
    if (!key)
        return false;
    const store = await loadStore();
    if (!store.instances[key])
        return false;
    delete store.instances[key];
    await saveStore(store);
    return true;
}
async function purgeAutomaticWhatsappConnectingRestrictions() {
    const store = await loadStore();
    const cleared = [];
    for (const [key, row] of Object.entries(store.instances)) {
        if ((row.source || "connecting-auto") !== "explicit") {
            delete store.instances[key];
            cleared.push(key);
        }
    }
    if (cleared.length)
        await saveStore(store);
    return cleared;
}
async function getWhatsappConnectingRestrictionMap() {
    const store = await loadStore();
    const out = {};
    let dirty = false;
    const now = Date.now();
    for (const [key, row] of Object.entries(store.instances)) {
        if ((row.source || "connecting-auto") !== "explicit") {
            delete store.instances[key];
            dirty = true;
            continue;
        }
        const untilMs = new Date(row.restrictedUntil).getTime();
        if (!Number.isFinite(untilMs) || untilMs <= now) {
            delete store.instances[key];
            dirty = true;
            continue;
        }
        out[key] = {
            restrictedUntil: row.restrictedUntil,
            detectedAt: row.detectedAt,
            statusLabel: "Restrição",
            active: true,
        };
    }
    if (dirty)
        await saveStore(store);
    return out;
}
async function recheckWhatsappConnectingRestrictions() {
    const store = await loadStore();
    const names = Object.keys(store.instances);
    const cleared = [];
    const stillRestricted = [];
    for (const key of names) {
        const liveState = await (0, evo_connection_state_service_1.fetchEvoInstanceLiveState)(key, { fresh: true });
        const row = await syncWhatsappConnectingRestriction(key, liveState || "close");
        if (row)
            stillRestricted.push(key);
        else
            cleared.push(key);
    }
    return { cleared, stillRestricted };
}
