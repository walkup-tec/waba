"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AQUECEDOR_STAGGER_PROMOTE_MS = void 0;
exports.computeDailyCapForInstance = computeDailyCapForInstance;
exports.isLikelyWhatsAppRestriction = isLikelyWhatsAppRestriction;
exports.getAquecedorLifecycleRow = getAquecedorLifecycleRow;
exports.registerAquecedorInstancePreparing = registerAquecedorInstancePreparing;
exports.grandfatherAquecedorInstanceActive = grandfatherAquecedorInstanceActive;
exports.markAquecedorInstanceRestricted = markAquecedorInstanceRestricted;
exports.tickAquecedorStaggerPromotions = tickAquecedorStaggerPromotions;
exports.computePreparingPromoteAtMs = computePreparingPromoteAtMs;
exports.formatAquecedorLifecycleStatusLabel = formatAquecedorLifecycleStatusLabel;
exports.getAquecedorLifecycleStatusMap = getAquecedorLifecycleStatusMap;
exports.filterAquecedorCycleConnected = filterAquecedorCycleConnected;
exports.canAquecedorInstanceSendToday = canAquecedorInstanceSendToday;
exports.recordAquecedorInstanceDailySend = recordAquecedorInstanceDailySend;
exports.detectAndMarkRestrictionFromSend = detectAndMarkRestrictionFromSend;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../data-path");
const LIFECYCLE_FILE = (0, data_path_1.resolveDataFile)("aquecedor-instance-lifecycle.json");
const RESTRICTION_WAIT_MS = 6 * 60 * 60 * 1000;
exports.AQUECEDOR_STAGGER_PROMOTE_MS = 12 * 60 * 60 * 1000;
const STAGGER_PROMOTE_MS = exports.AQUECEDOR_STAGGER_PROMOTE_MS;
let cache = null;
function normalizeKey(instanceName) {
    return String(instanceName || "").trim().toLowerCase();
}
function emptyRow(phase) {
    const now = new Date().toISOString();
    return {
        phase,
        preparingSince: phase === "preparing" ? now : null,
        activatedAt: phase === "active" ? now : null,
        restrictedUntil: null,
        restrictedReason: null,
        dailyDate: null,
        dailySendCount: 0,
        dailyCap: null,
    };
}
function defaultStore() {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        lastStaggerPromotionAt: null,
        instances: {},
    };
}
async function loadStore() {
    if (cache)
        return cache;
    try {
        const raw = await fs_1.promises.readFile(LIFECYCLE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1 && parsed.instances && typeof parsed.instances === "object") {
            cache = {
                version: 1,
                updatedAt: String(parsed.updatedAt || new Date().toISOString()),
                lastStaggerPromotionAt: typeof parsed.lastStaggerPromotionAt === "string" ? parsed.lastStaggerPromotionAt : null,
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
    await fs_1.promises.mkdir(path_1.default.dirname(LIFECYCLE_FILE), { recursive: true });
    const tmp = `${LIFECYCLE_FILE}.tmp`;
    await fs_1.promises.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
    await fs_1.promises.rename(tmp, LIFECYCLE_FILE);
}
function todayKeySp() {
    try {
        return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    }
    catch {
        return new Date().toISOString().slice(0, 10);
    }
}
function stableWeeklyHash(instanceName, weekIndex) {
    const seed = `${instanceName.toLowerCase()}|w${weekIndex}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return hash;
}
/** Semana 1: 8–16/dia; sobe ~40% por semana (teto 48). */
function computeDailyCapForInstance(instanceName, activatedAt) {
    const activatedMs = activatedAt ? new Date(activatedAt).getTime() : Date.now();
    const weekIndex = Math.max(0, Math.floor((Date.now() - activatedMs) / (7 * 24 * 60 * 60 * 1000)));
    const baseMin = 8;
    const baseMax = 16;
    const growth = 1 + weekIndex * 0.4;
    const min = Math.min(40, Math.round(baseMin * growth));
    const max = Math.min(48, Math.round(baseMax * growth));
    const span = Math.max(1, max - min + 1);
    const hash = stableWeeklyHash(instanceName, weekIndex);
    return min + (hash % span);
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
        "restringid",
        "suspended",
        "suspend",
        "not authorized",
        "forbidden",
        "rate-overlimit",
        "spam",
        "integrity",
        "logged out",
        "logout",
        "automáticas",
        "automaticas",
        "em massa",
    ];
    if (patterns.some((p) => d.includes(p)))
        return true;
    return httpStatus === 403;
}
function refreshRestrictionPhase(row) {
    if (row.phase !== "restricted_wait" || !row.restrictedUntil)
        return;
    if (Date.now() >= new Date(row.restrictedUntil).getTime()) {
        row.phase = row.activatedAt ? "active" : "preparing";
        row.restrictedUntil = null;
        row.restrictedReason = null;
        if (row.phase === "preparing" && !row.preparingSince) {
            row.preparingSince = new Date().toISOString();
        }
    }
}
function ensureDailyCap(row, instanceName) {
    const today = todayKeySp();
    if (row.dailyDate !== today) {
        row.dailyDate = today;
        row.dailySendCount = 0;
        row.dailyCap = computeDailyCapForInstance(instanceName, row.activatedAt);
    }
    else if (row.dailyCap == null) {
        row.dailyCap = computeDailyCapForInstance(instanceName, row.activatedAt);
    }
}
async function getAquecedorLifecycleRow(instanceName) {
    const store = await loadStore();
    const key = normalizeKey(instanceName);
    const row = store.instances[key];
    if (!row)
        return null;
    refreshRestrictionPhase(row);
    return { ...row };
}
async function registerAquecedorInstancePreparing(instanceName) {
    const name = String(instanceName || "").trim();
    if (!name)
        return;
    const store = await loadStore();
    const key = normalizeKey(name);
    const existing = store.instances[key];
    if (existing) {
        refreshRestrictionPhase(existing);
        if (existing.phase === "restricted_wait")
            return;
        if (existing.phase === "active")
            return;
        return;
    }
    store.instances[key] = emptyRow("preparing");
    await saveStore(store);
}
async function grandfatherAquecedorInstanceActive(instanceName) {
    const name = String(instanceName || "").trim();
    if (!name)
        return;
    const store = await loadStore();
    const key = normalizeKey(name);
    if (store.instances[key])
        return;
    const row = emptyRow("active");
    row.preparingSince = null;
    row.activatedAt = new Date().toISOString();
    store.instances[key] = row;
    await saveStore(store);
}
async function markAquecedorInstanceRestricted(instanceName, detail) {
    const name = String(instanceName || "").trim();
    if (!name)
        return;
    const store = await loadStore();
    const key = normalizeKey(name);
    const row = store.instances[key] || emptyRow("active");
    const until = new Date(Date.now() + RESTRICTION_WAIT_MS).toISOString();
    row.phase = "restricted_wait";
    row.restrictedUntil = until;
    row.restrictedReason = String(detail || "Restrição temporária WhatsApp.").slice(0, 240);
    store.instances[key] = row;
    await saveStore(store);
    console.warn(`[Aquecedor] instância ${name} em espera de 6h por restrição: ${row.restrictedReason}`);
}
async function tickAquecedorStaggerPromotions() {
    const store = await loadStore();
    const now = Date.now();
    const lastMs = store.lastStaggerPromotionAt
        ? new Date(store.lastStaggerPromotionAt).getTime()
        : 0;
    if (lastMs && now - lastMs < STAGGER_PROMOTE_MS)
        return null;
    const preparing = Object.entries(store.instances)
        .map(([key, row]) => ({ key, row }))
        .filter((item) => {
        refreshRestrictionPhase(item.row);
        return item.row.phase === "preparing";
    })
        .sort((a, b) => {
        const aMs = new Date(a.row.preparingSince || 0).getTime();
        const bMs = new Date(b.row.preparingSince || 0).getTime();
        return aMs - bMs;
    });
    if (!preparing.length)
        return null;
    const pick = preparing[0];
    const preparingSinceMs = new Date(pick.row.preparingSince || 0).getTime();
    if (!Number.isFinite(preparingSinceMs) || now - preparingSinceMs < STAGGER_PROMOTE_MS) {
        return null;
    }
    if (lastMs && now - lastMs < STAGGER_PROMOTE_MS)
        return null;
    pick.row.phase = "active";
    pick.row.activatedAt = new Date().toISOString();
    pick.row.preparingSince = null;
    store.lastStaggerPromotionAt = new Date().toISOString();
    await saveStore(store);
    return pick.key;
}
function computePreparingPromoteAtMs(row, queueIndex, lastStaggerPromotionAt) {
    const preparingSinceMs = new Date(row.preparingSince || 0).getTime();
    if (!Number.isFinite(preparingSinceMs))
        return Date.now() + STAGGER_PROMOTE_MS;
    const personalReadyMs = preparingSinceMs + STAGGER_PROMOTE_MS;
    const lastStaggerMs = lastStaggerPromotionAt
        ? new Date(lastStaggerPromotionAt).getTime()
        : 0;
    const staggerReadyMs = lastStaggerMs + STAGGER_PROMOTE_MS * (queueIndex + 1);
    return Math.max(personalReadyMs, staggerReadyMs);
}
function formatAquecedorLifecycleStatusLabel(row) {
    if (!row)
        return null;
    refreshRestrictionPhase(row);
    if (row.phase === "preparing")
        return "Preparando";
    if (row.phase === "restricted_wait" && row.restrictedUntil) {
        const remainingMs = new Date(row.restrictedUntil).getTime() - Date.now();
        if (remainingMs > 0)
            return "6 horas de espera";
        return null;
    }
    return null;
}
async function getAquecedorLifecycleStatusMap() {
    const store = await loadStore();
    const preparingList = Object.entries(store.instances)
        .map(([key, row]) => ({ key, row }))
        .filter(({ row }) => {
        refreshRestrictionPhase(row);
        return row.phase === "preparing";
    })
        .sort((a, b) => {
        const aMs = new Date(a.row.preparingSince || 0).getTime();
        const bMs = new Date(b.row.preparingSince || 0).getTime();
        return aMs - bMs;
    });
    const queueIndexByKey = new Map();
    preparingList.forEach(({ key }, index) => queueIndexByKey.set(key, index));
    const out = {};
    for (const [key, row] of Object.entries(store.instances)) {
        refreshRestrictionPhase(row);
        let promoteAt = null;
        if (row.phase === "preparing") {
            const queueIndex = queueIndexByKey.get(key) ?? 0;
            promoteAt = new Date(computePreparingPromoteAtMs(row, queueIndex, store.lastStaggerPromotionAt)).toISOString();
        }
        out[key] = {
            phase: row.phase,
            statusLabel: formatAquecedorLifecycleStatusLabel(row),
            restrictedUntil: row.restrictedUntil,
            promoteAt,
        };
    }
    return out;
}
async function filterAquecedorCycleConnected(connected) {
    await tickAquecedorStaggerPromotions();
    const store = await loadStore();
    const out = [];
    for (const item of connected) {
        const key = normalizeKey(item.instancia);
        const row = store.instances[key];
        if (!row) {
            await grandfatherAquecedorInstanceActive(item.instancia);
            out.push(item);
            continue;
        }
        refreshRestrictionPhase(row);
        if (row.phase === "active")
            out.push(item);
    }
    return out;
}
async function canAquecedorInstanceSendToday(instanceName) {
    const store = await loadStore();
    const key = normalizeKey(instanceName);
    const row = store.instances[key];
    if (!row) {
        return { ok: true, reason: "", dailyCap: 16, dailyCount: 0 };
    }
    refreshRestrictionPhase(row);
    if (row.phase !== "active") {
        return {
            ok: false,
            reason: row.phase === "preparing"
                ? "Instância em preparação."
                : "Instância em espera por restrição (6h).",
            dailyCap: 0,
            dailyCount: 0,
        };
    }
    ensureDailyCap(row, instanceName);
    const cap = row.dailyCap ?? 16;
    if (row.dailySendCount >= cap) {
        return {
            ok: false,
            reason: `Limite diário de aquecimento atingido (${row.dailySendCount}/${cap}).`,
            dailyCap: cap,
            dailyCount: row.dailySendCount,
        };
    }
    return { ok: true, reason: "", dailyCap: cap, dailyCount: row.dailySendCount };
}
async function recordAquecedorInstanceDailySend(instanceName) {
    const name = String(instanceName || "").trim();
    if (!name)
        return;
    const store = await loadStore();
    const key = normalizeKey(name);
    const row = store.instances[key] || emptyRow("active");
    ensureDailyCap(row, name);
    row.dailySendCount += 1;
    store.instances[key] = row;
    await saveStore(store);
}
async function detectAndMarkRestrictionFromSend(instanceName, status, body) {
    if (!isLikelyWhatsAppRestriction(body, status))
        return false;
    await markAquecedorInstanceRestricted(instanceName, body.slice(0, 200));
    return true;
}
