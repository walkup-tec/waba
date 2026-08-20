"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeInstanceWarmthLevel = computeInstanceWarmthLevel;
exports.computeWarmthFromLifecycleRow = computeWarmthFromLifecycleRow;
exports.getInstanceWarmthInfo = getInstanceWarmthInfo;
exports.getAquecedorWarmthMapForInstances = getAquecedorWarmthMapForInstances;
const fs_1 = require("fs");
const data_path_1 = require("../data-path");
const aquecedor_chip_identity_1 = require("../aquecedor/aquecedor-chip-identity");
const aquecedor_instance_lifecycle_service_1 = require("./aquecedor-instance-lifecycle.service");
const WARMTH_LABELS = {
    0: "Não aquecido",
    1: "Pouco aquecido",
    2: "Aquecimento médio",
    3: "Totalmente aquecido",
};
const STATS_CACHE_MS = 45000;
const WARMTH_OVERRIDE_FILE = (0, data_path_1.resolveDataFile)("aquecedor-instance-warmth-overrides.json");
const EVO_INSTANCES_CACHE_FILE = (0, data_path_1.resolveDataFile)("evo-instances-cache.json");
const INSTANCE_ALIASES_FILE = (0, data_path_1.resolveDataFile)("instance-aliases.json");
let statsCacheAt = 0;
let statsCache = new Map();
let warmthOverrideCache = null;
let warmthOverrideCacheAt = 0;
function normalizeKey(instanceName) {
    return String(instanceName || "").trim().toLowerCase();
}
function pickEarlierIso(a, b) {
    const left = String(a || "").trim();
    const right = String(b || "").trim();
    if (!left)
        return right || null;
    if (!right)
        return left || null;
    return left < right ? left : right;
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
/**
 * Nível de aquecimento por chip.
 * - Sem teto superior de média diária (volume alto não zera foguinho).
 * - Pisos por volume vitalício do chip (histórico de renomes conta).
 */
function computeInstanceWarmthLevel(params) {
    const { phase, activatedAt, ageDays, avgDailySends, replyRate, sends7d, receives7d, lifetimeSent, lifetimeRecv, } = params;
    // Preparando não zera foguinho: rename/re-QR (ex.: soma-9224) herda o calor do chip.
    if (phase === "restricted_wait" || !activatedAt || ageDays < 1) {
        return {
            level: 0,
            label: WARMTH_LABELS[0],
            ageDays,
            avgDailySends,
            replyRate,
        };
    }
    let level = 0;
    if (ageDays >= 1 && avgDailySends >= 20 && replyRate >= 0.3) {
        level = 1;
    }
    if (ageDays >= 8 && avgDailySends >= 50 && hasDailyConversations(sends7d, receives7d)) {
        level = 2;
    }
    if (ageDays >= 16 && avgDailySends >= 150 && frequentReplies(replyRate, receives7d)) {
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
    // Pisos pelo histórico real do chip (não só janela de 7 dias / rename recente).
    if (lifetimeSent >= 150 && ageDays >= 5 && (replyRate >= 0.25 || lifetimeRecv >= 100)) {
        level = Math.max(level, 1);
    }
    if (lifetimeSent >= 300 &&
        ageDays >= 14 &&
        (replyRate >= 0.3 || receives7d >= 5 || lifetimeRecv >= 250)) {
        level = Math.max(level, 2);
    }
    if (lifetimeSent >= 700 && ageDays >= 30 && (replyRate >= 0.4 || lifetimeRecv >= 500)) {
        level = Math.max(level, 3);
    }
    return {
        level,
        label: WARMTH_LABELS[level],
        ageDays,
        avgDailySends: Math.round(avgDailySends * 10) / 10,
        replyRate: Math.round(replyRate * 100) / 100,
    };
}
function computeWarmthFromLifecycleRow(row, exchangeStats, earliestActivityAt) {
    const activatedAt = pickEarlierIso(row?.activatedAt ?? null, earliestActivityAt ?? null);
    const ageDays = ageDaysSince(activatedAt);
    const sends7d = exchangeStats?.sends7d ?? row?.dailySendCount ?? 0;
    const receives7d = exchangeStats?.receives7d ?? 0;
    const lifetimeSent = exchangeStats?.sendsLifetime ?? sends7d;
    const lifetimeRecv = exchangeStats?.receivesLifetime ?? receives7d;
    const avgRecent = ageDays > 0 ? sends7d / Math.min(7, Math.max(1, ageDays)) : sends7d;
    const avgLifetime = ageDays > 0 ? lifetimeSent / Math.max(1, ageDays) : lifetimeSent;
    const avgDailySends = Math.max(avgRecent, avgLifetime);
    const replyRate = sends7d > 0 ? receives7d / sends7d : lifetimeSent > 0 ? lifetimeRecv / lifetimeSent : 0;
    return computeInstanceWarmthLevel({
        phase: row?.phase ?? null,
        activatedAt,
        ageDays,
        avgDailySends,
        replyRate,
        sends7d,
        receives7d,
        lifetimeSent,
        lifetimeRecv,
    });
}
function numericTokenFromInstanceName(name) {
    const digits = String(name || "").replace(/\D/g, "");
    if (digits.length >= 4)
        return digits.slice(-4);
    return digits;
}
async function loadInstanceAliasesFile() {
    try {
        const raw = await fs_1.promises.readFile(INSTANCE_ALIASES_FILE, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        const map = new Map();
        for (const [key, value] of Object.entries(parsed || {})) {
            const k = String(key || "").trim();
            const v = String(value || "").trim();
            if (k && v)
                map.set(normalizeKey(k), v);
        }
        return map;
    }
    catch {
        return new Map();
    }
}
async function loadEvoCacheNameToChip() {
    const map = new Map();
    try {
        const raw = await fs_1.promises.readFile(EVO_INSTANCES_CACHE_FILE, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        for (const item of Array.isArray(parsed?.items) ? parsed.items : []) {
            const name = normalizeKey(String(item?.name || ""));
            const chip = (0, aquecedor_chip_identity_1.aquecedorChipKeyFromNumber)(String(item?.number || ""));
            if (name && chip)
                map.set(name, chip);
        }
    }
    catch {
        /* opcional */
    }
    return map;
}
/**
 * Agrupa nomes técnicos pelo chip WhatsApp (não pelo nome da instância).
 * Inclui controle_instancia, cache EVO, aliases e nomes históricos órfãos
 * descobertos por token numérico (ex.: digital-corban-2477), excluindo
 * nomes que o controle mapeia para outro chip.
 */
async function loadChipAliasMap(supabase, instanceNames) {
    const requested = Array.from(new Set(instanceNames.map(normalizeKey).filter(Boolean)));
    const result = new Map();
    for (const key of requested)
        result.set(key, [key]);
    if (!requested.length)
        return result;
    const chipToNames = new Map();
    const nameToChip = new Map();
    const addNameChip = (rawName, rawNumber) => {
        const name = normalizeKey(rawName);
        const chip = (0, aquecedor_chip_identity_1.aquecedorChipKeyFromNumber)(rawNumber);
        if (!name || !chip)
            return;
        nameToChip.set(name, chip);
        let set = chipToNames.get(chip);
        if (!set) {
            set = new Set();
            chipToNames.set(chip, set);
        }
        set.add(name);
    };
    try {
        const { data, error } = await supabase
            .from("controle_instancia")
            .select("instancia, numero_whatsapp")
            .limit(5000);
        if (!error && Array.isArray(data)) {
            for (const row of data) {
                addNameChip(String(row?.instancia || ""), String(row?.numero_whatsapp || ""));
            }
        }
    }
    catch {
        /* opcional */
    }
    const evoMap = await loadEvoCacheNameToChip();
    for (const [name, chip] of evoMap.entries()) {
        nameToChip.set(name, chip);
        let set = chipToNames.get(chip);
        if (!set) {
            set = new Set();
            chipToNames.set(chip, set);
        }
        set.add(name);
    }
    const aliasesFile = await loadInstanceAliasesFile();
    for (const [technical, alias] of aliasesFile.entries()) {
        const techChip = nameToChip.get(normalizeKey(technical));
        const aliasChip = nameToChip.get(normalizeKey(alias));
        const chip = techChip || aliasChip;
        if (!chip)
            continue;
        for (const n of [technical, alias]) {
            const key = normalizeKey(n);
            nameToChip.set(key, chip);
            let set = chipToNames.get(chip);
            if (!set) {
                set = new Set();
                chipToNames.set(chip, set);
            }
            set.add(key);
        }
    }
    // Descoberta de renomes históricos órfãos (fora do controle) pelo token do nome.
    for (const key of requested) {
        const chip = nameToChip.get(key);
        if (!chip)
            continue;
        const token = numericTokenFromInstanceName(key);
        if (token.length < 4)
            continue;
        try {
            const { data } = await supabase
                .from("logs_envios")
                .select("instancia_origem, instancia_destino")
                .or(`instancia_origem.ilike.%${token}%,instancia_destino.ilike.%${token}%`)
                .limit(2000);
            for (const row of Array.isArray(data) ? data : []) {
                for (const raw of [row?.instancia_origem, row?.instancia_destino]) {
                    const name = normalizeKey(String(raw || ""));
                    if (!name || !name.includes(token))
                        continue;
                    const mapped = nameToChip.get(name);
                    if (mapped && mapped !== chip)
                        continue; // outro chip (ex.: nome "2477" no chip 6973)
                    let set = chipToNames.get(chip);
                    if (!set) {
                        set = new Set();
                        chipToNames.set(chip, set);
                    }
                    set.add(name);
                    if (!mapped)
                        nameToChip.set(name, chip);
                }
            }
        }
        catch {
            /* opcional */
        }
    }
    for (const key of requested) {
        const chip = nameToChip.get(key);
        if (!chip)
            continue;
        const group = chipToNames.get(chip);
        if (!group?.size)
            continue;
        result.set(key, Array.from(group));
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
        const stats = {
            sends7d: 0,
            receives7d: 0,
            sendsLifetime: 0,
            receivesLifetime: 0,
        };
        for (const alias of aliases) {
            const row = raw.get(normalizeKey(alias));
            if (!row)
                continue;
            stats.sends7d += row.sends7d;
            stats.receives7d += row.receives7d;
            stats.sendsLifetime += row.sendsLifetime;
            stats.receivesLifetime += row.receivesLifetime;
        }
        out.set(canonical, stats);
    }
    return out;
}
async function pickLifecycleFromAliases(names) {
    const rows = (await Promise.all(names.map((name) => (0, aquecedor_instance_lifecycle_service_1.getAquecedorLifecycleRow)(name)))).filter((row) => Boolean(row));
    if (!rows.length)
        return null;
    const active = rows.filter((row) => row.phase === "active" && row.activatedAt);
    const pool = active.length ? active : rows;
    return pool.reduce((best, row) => {
        if (!best?.activatedAt)
            return row;
        if (!row.activatedAt)
            return best;
        return row.activatedAt < best.activatedAt ? row : best;
    });
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
async function countLogsForName(supabase, name, column, sinceIso) {
    try {
        let query = supabase
            .from("logs_envios")
            .select("id", { count: "exact", head: true })
            .eq(column, name);
        if (sinceIso)
            query = query.gte("data_envio", sinceIso);
        const { count, error } = await query;
        if (error || count == null)
            return 0;
        return Number(count) || 0;
    }
    catch {
        return 0;
    }
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
    for (const key of keys) {
        out.set(key, { sends7d: 0, receives7d: 0, sendsLifetime: 0, receivesLifetime: 0 });
    }
    if (!keys.length)
        return out;
    const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const concurrency = 4;
    for (let i = 0; i < keys.length; i += concurrency) {
        const chunk = keys.slice(i, i + concurrency);
        await Promise.all(chunk.map(async (name) => {
            const [sendsLifetime, receivesLifetime, sends7d, receives7d] = await Promise.all([
                countLogsForName(supabase, name, "instancia_origem"),
                countLogsForName(supabase, name, "instancia_destino"),
                countLogsForName(supabase, name, "instancia_origem", since),
                countLogsForName(supabase, name, "instancia_destino", since),
            ]);
            out.set(name, { sendsLifetime, receivesLifetime, sends7d, receives7d });
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
    let aliasMap = new Map();
    if (supabase && requested.length) {
        aliasMap = await loadChipAliasMap(supabase, requested);
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
        const aliases = aliasMap.get(key) || [key];
        const row = await pickLifecycleFromAliases(aliases);
        const computed = computeWarmthFromLifecycleRow(row, exchangeMap.get(key), earliestMap.get(key) || null);
        out[key] = applyWarmthOverride(computed, overrides, name);
    }));
    return out;
}
