"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeInstanceWarmthLevel = computeInstanceWarmthLevel;
exports.computeWarmthFromLifecycleRow = computeWarmthFromLifecycleRow;
exports.getInstanceWarmthInfo = getInstanceWarmthInfo;
exports.getAquecedorWarmthMapForInstances = getAquecedorWarmthMapForInstances;
const fs_1 = require("fs");
const data_path_1 = require("../data-path");
const aquecedor_instance_lifecycle_service_1 = require("./aquecedor-instance-lifecycle.service");
const WARMTH_LABELS = {
    0: "Não aquecido",
    1: "Pouco aquecido",
    2: "Aquecimento médio",
    3: "Totalmente aquecido",
};
const STATS_CACHE_MS = 45000;
const WARMTH_OVERRIDE_FILE = (0, data_path_1.resolveDataFile)("aquecedor-instance-warmth-overrides.json");
let statsCacheAt = 0;
let statsCache = new Map();
let warmthOverrideCache = null;
let warmthOverrideCacheAt = 0;
function normalizeKey(instanceName) {
    return String(instanceName || "").trim().toLowerCase();
}
async function loadWarmthOverrides() {
    const now = Date.now();
    if (warmthOverrideCache && now - warmthOverrideCacheAt < 5000) {
        return warmthOverrideCache;
    }
    const map = new Map();
    try {
        const raw = await fs_1.promises.readFile(WARMTH_OVERRIDE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        for (const [key, levelRaw] of Object.entries(parsed?.instances || {})) {
            const level = Math.max(0, Math.min(3, Number(levelRaw) || 0));
            map.set(normalizeKey(key), level);
        }
    }
    catch {
        /* arquivo opcional de teste */
    }
    warmthOverrideCache = map;
    warmthOverrideCacheAt = now;
    return map;
}
function applyWarmthOverride(info, overrides, instanceKey) {
    const override = overrides.get(normalizeKey(instanceKey));
    if (override == null)
        return info;
    const level = Math.max(0, Math.min(3, override));
    return {
        ...info,
        level,
        label: WARMTH_LABELS[level],
    };
}
function ageDaysSince(iso) {
    if (!iso)
        return 0;
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0)
        return 0;
    return Math.floor(ms / (24 * 60 * 60 * 1000));
}
function hasDailyConversations(sends7d, receives7d) {
    if (receives7d < 1)
        return false;
    const daysWithActivity = Math.min(7, Math.max(1, Math.ceil(sends7d / 8)));
    return receives7d >= daysWithActivity;
}
function frequentReplies(replyRate, receives7d) {
    return replyRate >= 0.45 && receives7d >= 5;
}
function computeInstanceWarmthLevel(params) {
    const { phase, activatedAt, ageDays, avgDailySends, replyRate, sends7d, receives7d } = params;
    if (phase === "preparing" || phase === "restricted_wait" || !activatedAt || ageDays < 1) {
        return {
            level: 0,
            label: WARMTH_LABELS[0],
            ageDays,
            avgDailySends,
            replyRate,
        };
    }
    let level = 0;
    if (ageDays >= 1 &&
        ageDays <= 7 &&
        avgDailySends >= 20 &&
        avgDailySends <= 50 &&
        replyRate >= 0.3) {
        level = 1;
    }
    if (ageDays >= 8 &&
        ageDays <= 15 &&
        avgDailySends >= 50 &&
        avgDailySends <= 150 &&
        hasDailyConversations(sends7d, receives7d)) {
        level = 2;
    }
    if (ageDays >= 16 &&
        avgDailySends >= 150 &&
        avgDailySends <= 300 &&
        frequentReplies(replyRate, receives7d)) {
        level = 3;
    }
    else if (ageDays > 30 && avgDailySends >= 150 && frequentReplies(replyRate, receives7d)) {
        level = 3;
    }
    else if (ageDays > 15 && level < 2 && avgDailySends >= 50 && hasDailyConversations(sends7d, receives7d)) {
        level = 2;
    }
    else if (ageDays > 7 && level < 1 && avgDailySends >= 20 && replyRate >= 0.3) {
        level = 1;
    }
    return {
        level,
        label: WARMTH_LABELS[level],
        ageDays,
        avgDailySends: Math.round(avgDailySends * 10) / 10,
        replyRate: Math.round(replyRate * 100) / 100,
    };
}
function computeWarmthFromLifecycleRow(row, exchangeStats) {
    const activatedAt = row?.activatedAt ?? null;
    const ageDays = ageDaysSince(activatedAt);
    const sends7d = exchangeStats?.sends7d ?? row?.dailySendCount ?? 0;
    const receives7d = exchangeStats?.receives7d ?? 0;
    const avgDailySends = ageDays > 0 ? sends7d / Math.min(7, ageDays) : sends7d;
    const replyRate = sends7d > 0 ? receives7d / sends7d : 0;
    return computeInstanceWarmthLevel({
        phase: row?.phase ?? null,
        activatedAt,
        ageDays,
        avgDailySends,
        replyRate,
        sends7d,
        receives7d,
    });
}
function phoneTail(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    if (d.length >= 12)
        return d.slice(-11);
    if (d.length >= 10)
        return d.slice(-11);
    return d;
}
/**
 * Agrupa nomes técnicos que compartilham o mesmo WhatsApp (controle_instancia).
 * Ex.: 6635 ← 6035, 51981076635.
 */
async function loadCanonicalAliasMap(supabase, instanceNames) {
    const requested = Array.from(new Set(instanceNames.map(normalizeKey).filter(Boolean)));
    const result = new Map();
    for (const key of requested)
        result.set(key, [key]);
    if (!requested.length)
        return result;
    try {
        const { data, error } = await supabase
            .from("controle_instancia")
            .select("instancia, numero_whatsapp")
            .limit(5000);
        if (error || !Array.isArray(data))
            return result;
        const phoneToNames = new Map();
        const nameToPhone = new Map();
        for (const row of data) {
            const name = normalizeKey(String(row?.instancia || ""));
            const phone = phoneTail(String(row?.numero_whatsapp || ""));
            if (!name || phone.length < 8)
                continue;
            nameToPhone.set(name, phone);
            let set = phoneToNames.get(phone);
            if (!set) {
                set = new Set();
                phoneToNames.set(phone, set);
            }
            set.add(name);
        }
        for (const key of requested) {
            const phone = nameToPhone.get(key);
            if (!phone)
                continue;
            const group = phoneToNames.get(phone);
            if (!group?.size)
                continue;
            result.set(key, Array.from(group));
        }
    }
    catch {
        /* opcional */
    }
    return result;
}
function expandAliasNames(aliasMap) {
    const all = new Set();
    for (const names of aliasMap.values()) {
        for (const n of names)
            all.add(normalizeKey(n));
    }
    return Array.from(all);
}
function foldStatsToCanonical(aliasMap, raw) {
    const out = new Map();
    for (const [canonical, aliases] of aliasMap) {
        let sends7d = 0;
        let receives7d = 0;
        for (const alias of aliases) {
            const row = raw.get(normalizeKey(alias));
            if (!row)
                continue;
            sends7d += row.sends7d;
            receives7d += row.receives7d;
        }
        out.set(canonical, { sends7d, receives7d });
    }
    return out;
}
function foldEarliestToCanonical(aliasMap, raw) {
    const out = new Map();
    for (const [canonical, aliases] of aliasMap) {
        let best = null;
        for (const alias of aliases) {
            const at = raw.get(normalizeKey(alias));
            if (!at)
                continue;
            if (!best || at < best)
                best = at;
        }
        if (best)
            out.set(canonical, best);
    }
    return out;
}
async function loadExchangeStatsMap(supabase, instanceNames) {
    const keys = Array.from(new Set(instanceNames.map(normalizeKey).filter(Boolean)));
    const now = Date.now();
    const cacheHit = now - statsCacheAt < STATS_CACHE_MS &&
        statsCache.size > 0 &&
        keys.every((k) => statsCache.has(k));
    if (cacheHit) {
        const hit = new Map();
        for (const k of keys)
            hit.set(k, statsCache.get(k));
        return hit;
    }
    const out = new Map();
    for (const key of keys)
        out.set(key, { sends7d: 0, receives7d: 0 });
    if (!keys.length)
        return out;
    const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Contagem por instância (evita perder nomes no limite global de 8000 rows).
    const concurrency = 6;
    for (let i = 0; i < keys.length; i += concurrency) {
        const chunk = keys.slice(i, i + concurrency);
        await Promise.all(chunk.map(async (name) => {
            try {
                const { data, error } = await supabase
                    .from("logs_envios")
                    .select("instancia_origem, instancia_destino")
                    .or(`instancia_origem.eq.${name},instancia_destino.eq.${name}`)
                    .gte("data_envio", since)
                    .limit(5000);
                if (error || !Array.isArray(data))
                    return;
                const stats = out.get(name);
                for (const row of data) {
                    if (normalizeKey(String(row?.instancia_origem || "")) === name)
                        stats.sends7d += 1;
                    if (normalizeKey(String(row?.instancia_destino || "")) === name)
                        stats.receives7d += 1;
                }
            }
            catch {
                /* opcional */
            }
        }));
    }
    statsCacheAt = now;
    statsCache = new Map(out);
    return out;
}
/** Primeira data_envio por instância (origem ou destino) — restaura aquecimento após recreate. */
async function loadEarliestActivityMap(supabase, instanceNames) {
    const out = new Map();
    const keys = Array.from(new Set(instanceNames.map(normalizeKey).filter(Boolean)));
    if (!keys.length)
        return out;
    const concurrency = 6;
    for (let i = 0; i < keys.length; i += concurrency) {
        const chunk = keys.slice(i, i + concurrency);
        await Promise.all(chunk.map(async (name) => {
            try {
                const { data, error } = await supabase
                    .from("logs_envios")
                    .select("data_envio")
                    .or(`instancia_origem.eq.${name},instancia_destino.eq.${name}`)
                    .order("data_envio", { ascending: true })
                    .limit(1);
                if (error || !Array.isArray(data) || !data[0]?.data_envio)
                    return;
                out.set(name, String(data[0].data_envio));
            }
            catch {
                /* opcional */
            }
        }));
    }
    return out;
}
async function getInstanceWarmthInfo(instanceName, supabase) {
    const map = await getAquecedorWarmthMapForInstances([instanceName], supabase);
    return (map[normalizeKey(instanceName)] || {
        level: 0,
        label: WARMTH_LABELS[0],
        ageDays: 0,
        avgDailySends: 0,
        replyRate: 0,
    });
}
async function getAquecedorWarmthMapForInstances(instanceNames, supabase) {
    const overrides = await loadWarmthOverrides();
    const out = {};
    const requested = Array.from(new Set(instanceNames.map((n) => String(n || "").trim()).filter(Boolean)));
    let exchangeMap = new Map();
    let earliestMap = new Map();
    if (supabase && requested.length) {
        const aliasMap = await loadCanonicalAliasMap(supabase, requested);
        const expanded = expandAliasNames(aliasMap);
        const [rawExchange, rawEarliest] = await Promise.all([
            loadExchangeStatsMap(supabase, expanded),
            loadEarliestActivityMap(supabase, expanded),
        ]);
        exchangeMap = foldStatsToCanonical(aliasMap, rawExchange);
        earliestMap = foldEarliestToCanonical(aliasMap, rawEarliest);
        await (0, aquecedor_instance_lifecycle_service_1.restoreAquecedorLifecyclesFromHistoryBatch)(requested.map((name) => ({
            instanceName: name,
            earliestActivityAt: earliestMap.get(normalizeKey(name)) || null,
        })));
    }
    await Promise.all(requested.map(async (name) => {
        const key = normalizeKey(name);
        const row = await (0, aquecedor_instance_lifecycle_service_1.getAquecedorLifecycleRow)(name);
        const computed = computeWarmthFromLifecycleRow(row, exchangeMap.get(key));
        out[key] = applyWarmthOverride(computed, overrides, name);
    }));
    return out;
}
