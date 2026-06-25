"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AQUECEDOR_DAILY_CAP_CEILING = exports.AQUECEDOR_DAILY_CAP_WEEKLY_GROWTH = exports.AQUECEDOR_DAILY_CAP_BASE = exports.AQUECEDOR_LIFECYCLE_GRANDFATHER_CUTOFF_ISO = exports.AQUECEDOR_PREPARING_DURATION_MS = exports.AQUECEDOR_STAGGER_PROMOTE_MS = void 0;
exports.computeDailyCapForInstance = computeDailyCapForInstance;
exports.isLikelyWhatsAppRestriction = isLikelyWhatsAppRestriction;
exports.getAquecedorLifecycleRow = getAquecedorLifecycleRow;
exports.registerAquecedorInstancePreparing = registerAquecedorInstancePreparing;
exports.grandfatherAquecedorInstanceActive = grandfatherAquecedorInstanceActive;
exports.markAquecedorInstanceRestricted = markAquecedorInstanceRestricted;
exports.syncAquecedorPreparingPromotions = syncAquecedorPreparingPromotions;
exports.tickAquecedorStaggerPromotions = tickAquecedorStaggerPromotions;
exports.computePreparingPromoteAtMs = computePreparingPromoteAtMs;
exports.filterInstancesLifecycleReady = filterInstancesLifecycleReady;
exports.formatAquecedorLifecycleStatusLabel = formatAquecedorLifecycleStatusLabel;
exports.getAquecedorLifecycleStatusMap = getAquecedorLifecycleStatusMap;
exports.filterAquecedorCycleConnected = filterAquecedorCycleConnected;
exports.refreshAquecedorDailyCapsIfNeeded = refreshAquecedorDailyCapsIfNeeded;
exports.canAquecedorInstanceSendToday = canAquecedorInstanceSendToday;
exports.recordAquecedorInstanceDailySend = recordAquecedorInstanceDailySend;
exports.detectAndMarkRestrictionFromSend = detectAndMarkRestrictionFromSend;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../data-path");
const LIFECYCLE_FILE = (0, data_path_1.resolveDataFile)("aquecedor-instance-lifecycle.json");
const EVO_INSTANCES_CACHE_FILE = (0, data_path_1.resolveDataFile)("evo-instances-cache.json");
const RESTRICTION_WAIT_MS = 6 * 60 * 60 * 1000;
exports.AQUECEDOR_STAGGER_PROMOTE_MS = 6 * 60 * 60 * 1000;
/** Duração da fase Preparando (6h desde a integração). */
exports.AQUECEDOR_PREPARING_DURATION_MS = exports.AQUECEDOR_STAGGER_PROMOTE_MS;
const PREPARING_DURATION_MS = exports.AQUECEDOR_PREPARING_DURATION_MS;
/** Instâncias integradas antes desta data entram direto como ativas (legado). */
exports.AQUECEDOR_LIFECYCLE_GRANDFATHER_CUTOFF_ISO = "2026-06-22T00:00:00.000Z";
let cache = null;
function normalizeKey(instanceName) {
    return String(instanceName || "").trim().toLowerCase();
}
function emptyRow(phase, preparingSince) {
    const now = new Date().toISOString();
    return {
        phase,
        preparingSince: phase === "preparing" ? preparingSince || now : null,
        activatedAt: phase === "active" ? now : null,
        restrictedUntil: null,
        restrictedReason: null,
        dailyDate: null,
        dailySendCount: 0,
        dailyCap: null,
    };
}
async function readEvoInstanceCreatedAt(instanceName) {
    try {
        const raw = await fs_1.promises.readFile(EVO_INSTANCES_CACHE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        const key = normalizeKey(instanceName);
        for (const item of parsed?.items || []) {
            if (normalizeKey(String(item?.name || "")) !== key)
                continue;
            const createdAt = String(item?.createdAt || "").trim();
            return createdAt || null;
        }
    }
    catch {
        /* cache opcional */
    }
    return null;
}
function isGrandfatherEligible(createdAt) {
    if (!createdAt)
        return true;
    const createdMs = new Date(createdAt).getTime();
    const cutoffMs = new Date(exports.AQUECEDOR_LIFECYCLE_GRANDFATHER_CUTOFF_ISO).getTime();
    return !Number.isFinite(createdMs) || createdMs < cutoffMs;
}
function shouldRevertGrandfatherToPreparing(row, createdAt) {
    if (row.phase !== "active" || row.preparingSince)
        return false;
    if (isGrandfatherEligible(createdAt))
        return false;
    const createdMs = new Date(createdAt || 0).getTime();
    if (!Number.isFinite(createdMs))
        return false;
    return Date.now() - createdMs < PREPARING_DURATION_MS;
}
async function reconcileGrandfatheredActiveRow(instanceName, row) {
    const createdAt = await readEvoInstanceCreatedAt(instanceName);
    if (!shouldRevertGrandfatherToPreparing(row, createdAt))
        return false;
    row.phase = "preparing";
    row.preparingSince = createdAt;
    row.activatedAt = null;
    return true;
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
/** Semana 1: 70/dia por instância; +40% por semana; teto 150 (~semana 4). */
exports.AQUECEDOR_DAILY_CAP_BASE = 70;
exports.AQUECEDOR_DAILY_CAP_WEEKLY_GROWTH = 1.4;
exports.AQUECEDOR_DAILY_CAP_CEILING = 150;
function computeDailyCapForInstance(_instanceName, activatedAt) {
    const activatedMs = activatedAt ? new Date(activatedAt).getTime() : Date.now();
    const weekIndex = Math.max(0, Math.floor((Date.now() - activatedMs) / (7 * 24 * 60 * 60 * 1000)));
    const scaled = Math.round(exports.AQUECEDOR_DAILY_CAP_BASE * exports.AQUECEDOR_DAILY_CAP_WEEKLY_GROWTH ** weekIndex);
    return Math.min(exports.AQUECEDOR_DAILY_CAP_CEILING, scaled);
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
    }
    row.dailyCap = computeDailyCapForInstance(instanceName, row.activatedAt);
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
async function registerAquecedorInstancePreparing(instanceName, preparingSince) {
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
        if (existing.phase === "active") {
            if (await reconcileGrandfatheredActiveRow(name, existing)) {
                await saveStore(store);
            }
            return;
        }
        return;
    }
    const createdAt = preparingSince ||
        (await readEvoInstanceCreatedAt(name)) ||
        null;
    if (isGrandfatherEligible(createdAt)) {
        await grandfatherAquecedorInstanceActive(name);
        return;
    }
    store.instances[key] = emptyRow("preparing", createdAt || new Date().toISOString());
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
async function syncAquecedorPreparingPromotions() {
    const store = await loadStore();
    const now = Date.now();
    const promoted = [];
    for (const [key, row] of Object.entries(store.instances)) {
        refreshRestrictionPhase(row);
        if (row.phase !== "preparing")
            continue;
        const preparingSinceMs = new Date(row.preparingSince || 0).getTime();
        if (!Number.isFinite(preparingSinceMs))
            continue;
        if (now < preparingSinceMs + PREPARING_DURATION_MS)
            continue;
        row.phase = "active";
        row.activatedAt = new Date().toISOString();
        row.preparingSince = null;
        promoted.push(key);
    }
    if (promoted.length)
        await saveStore(store);
    return promoted;
}
async function tickAquecedorStaggerPromotions() {
    const promoted = await syncAquecedorPreparingPromotions();
    return promoted[0] ?? null;
}
/** Momento em que a instância sai de Preparando: integração + 6h (sem fila escalonada). */
function computePreparingPromoteAtMs(row) {
    const preparingSinceMs = new Date(row.preparingSince || 0).getTime();
    if (!Number.isFinite(preparingSinceMs))
        return Date.now() + PREPARING_DURATION_MS;
    return preparingSinceMs + PREPARING_DURATION_MS;
}
/** Instâncias em fase ativa (pós-Preparando) — elegíveis para aquecedor e disparo. */
async function filterInstancesLifecycleReady(instanceNames) {
    await syncAquecedorPreparingPromotions();
    const store = await loadStore();
    const out = [];
    for (const rawName of instanceNames) {
        const name = String(rawName || "").trim();
        if (!name)
            continue;
        const key = normalizeKey(name);
        const row = store.instances[key];
        if (!row) {
            const createdAt = await readEvoInstanceCreatedAt(name);
            if (isGrandfatherEligible(createdAt))
                out.push(name);
            continue;
        }
        refreshRestrictionPhase(row);
        if (row.phase === "active")
            out.push(name);
    }
    return out;
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
    await syncAquecedorPreparingPromotions();
    const store = await loadStore();
    let storeDirty = false;
    for (const [key, row] of Object.entries(store.instances)) {
        if (await reconcileGrandfatheredActiveRow(key, row))
            storeDirty = true;
    }
    if (storeDirty)
        await saveStore(store);
    const out = {};
    for (const [key, row] of Object.entries(store.instances)) {
        refreshRestrictionPhase(row);
        let promoteAt = null;
        if (row.phase === "preparing") {
            promoteAt = new Date(computePreparingPromoteAtMs(row)).toISOString();
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
    await syncAquecedorPreparingPromotions();
    const store = await loadStore();
    const out = [];
    let storeDirty = false;
    for (const item of connected) {
        const key = normalizeKey(item.instancia);
        let row = store.instances[key];
        if (!row) {
            const createdAt = await readEvoInstanceCreatedAt(item.instancia);
            if (isGrandfatherEligible(createdAt)) {
                await grandfatherAquecedorInstanceActive(item.instancia);
                row = (await loadStore()).instances[key];
            }
            else {
                await registerAquecedorInstancePreparing(item.instancia, createdAt);
                row = (await loadStore()).instances[key];
            }
        }
        else if (await reconcileGrandfatheredActiveRow(item.instancia, row)) {
            storeDirty = true;
        }
        if (!row)
            continue;
        refreshRestrictionPhase(row);
        if (row.phase === "active")
            out.push(item);
    }
    if (storeDirty)
        await saveStore(store);
    return out;
}
/** Zera contadores diários ao virar o dia (SP) e persiste quando necessário. */
async function refreshAquecedorDailyCapsIfNeeded() {
    const store = await loadStore();
    let dirty = false;
    for (const [key, row] of Object.entries(store.instances)) {
        refreshRestrictionPhase(row);
        const beforeDate = row.dailyDate;
        const beforeCap = row.dailyCap;
        ensureDailyCap(row, key);
        if (beforeDate !== row.dailyDate || beforeCap !== row.dailyCap)
            dirty = true;
    }
    if (dirty)
        await saveStore(store);
}
async function canAquecedorInstanceSendToday(instanceName) {
    const store = await loadStore();
    const key = normalizeKey(instanceName);
    const row = store.instances[key];
    if (!row) {
        return { ok: true, reason: "", dailyCap: exports.AQUECEDOR_DAILY_CAP_BASE, dailyCount: 0 };
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
    const beforeDate = row.dailyDate;
    const beforeCap = row.dailyCap;
    ensureDailyCap(row, instanceName);
    if (beforeDate !== row.dailyDate || beforeCap !== row.dailyCap) {
        await saveStore(store);
    }
    const cap = row.dailyCap ?? exports.AQUECEDOR_DAILY_CAP_BASE;
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
