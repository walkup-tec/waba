"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAquecedorMessageStatsForInstances = getAquecedorMessageStatsForInstances;
const fs_1 = require("fs");
const data_path_1 = require("../data-path");
const AQUECEDOR_ENVIOS_LOG_FILE = (0, data_path_1.resolveDataFile)("aquecedor-envios-log.json");
const INSTANCE_ALIASES_FILE = (0, data_path_1.resolveDataFile)("instance-aliases.json");
const STATS_CACHE_MS = 45000;
const LOGS_PAGE_SIZE = 1000;
const LOGS_MAX_PAGES = 120;
let statsCache = null;
let statsCacheKey = "";
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeKey = (value) => String(value || "").trim().toLowerCase();
async function loadInstanceAliasesMap() {
    try {
        const raw = await fs_1.promises.readFile(INSTANCE_ALIASES_FILE, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        const map = new Map();
        for (const [key, value] of Object.entries(parsed || {})) {
            const k = String(key || "").trim();
            const v = String(value || "").trim();
            if (k && v)
                map.set(k, v);
        }
        return map;
    }
    catch {
        return new Map();
    }
}
function buildPrimaryResolver(instanceNames, aliasesMap) {
    const primaryByLower = new Map();
    for (const name of instanceNames) {
        const trimmed = String(name || "").trim();
        if (!trimmed)
            continue;
        primaryByLower.set(trimmed.toLowerCase(), trimmed);
    }
    const bind = (raw, primary) => {
        const key = String(raw || "").trim();
        if (!key)
            return;
        primaryByLower.set(key.toLowerCase(), primary);
    };
    for (const name of instanceNames) {
        const primary = String(name || "").trim();
        if (!primary)
            continue;
        bind(primary, primary);
        const alias = aliasesMap.get(primary);
        if (alias)
            bind(alias, primary);
    }
    for (const [technical, alias] of aliasesMap.entries()) {
        const primary = primaryByLower.get(normalizeKey(technical));
        if (primary)
            bind(alias, primary);
    }
    const primaries = Array.from(new Set(instanceNames.map((n) => String(n || "").trim()).filter(Boolean)));
    return {
        primaries,
        resolve: (raw) => {
            const key = normalizeKey(raw);
            if (!key)
                return null;
            return primaryByLower.get(key) || null;
        },
    };
}
function initStatsMap(primaries) {
    const map = new Map();
    for (const name of primaries) {
        map.set(name, { sent: 0, received: 0, total: 0 });
    }
    return map;
}
function bump(map, primary, kind) {
    const row = map.get(primary);
    if (!row)
        return;
    if (kind === "sent")
        row.sent += 1;
    else
        row.received += 1;
    row.total = row.sent + row.received;
}
async function readLocalAquecedorEnviosLog() {
    try {
        const raw = await fs_1.promises.readFile(AQUECEDOR_ENVIOS_LOG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.items) ? parsed.items : [];
    }
    catch {
        return [];
    }
}
async function aggregateFromSupabase(supabase, map, resolve) {
    let offset = 0;
    for (let page = 0; page < LOGS_MAX_PAGES; page += 1) {
        const { data, error } = await supabase
            .from("logs_envios")
            .select("instancia_origem, instancia_destino")
            .order("data_envio", { ascending: false })
            .range(offset, offset + LOGS_PAGE_SIZE - 1);
        if (error)
            break;
        const rows = Array.isArray(data) ? data : [];
        if (!rows.length)
            break;
        for (const row of rows) {
            const from = resolve(String(row?.instancia_origem || ""));
            const to = resolve(String(row?.instancia_destino || ""));
            if (from)
                bump(map, from, "sent");
            if (to)
                bump(map, to, "received");
        }
        offset += rows.length;
        if (rows.length < LOGS_PAGE_SIZE)
            break;
    }
}
function aggregateFromLocalLog(rows, map, resolve, ownerEmail) {
    const owner = normalizeEmail(ownerEmail);
    for (const row of rows) {
        if (String(row?.status || "") !== "Envio com Sucesso")
            continue;
        const rowOwner = normalizeEmail(String(row?.ownerEmail || ""));
        if (owner && rowOwner && rowOwner !== owner)
            continue;
        const from = resolve(String(row?.instanciaOrigem || ""));
        const to = resolve(String(row?.instanciaDestino || ""));
        if (from)
            bump(map, from, "sent");
        if (to)
            bump(map, to, "received");
    }
}
async function getAquecedorMessageStatsForInstances(instanceNames, options = {}) {
    const primaries = Array.from(new Set(instanceNames.map((n) => String(n || "").trim()).filter(Boolean)));
    if (!primaries.length)
        return new Map();
    const ownerEmail = normalizeEmail(String(options.ownerEmail || ""));
    const cacheKey = `${ownerEmail}::${primaries.map((n) => n.toLowerCase()).sort().join("|")}`;
    const now = Date.now();
    if (statsCache && statsCacheKey === cacheKey && now - statsCache.at < STATS_CACHE_MS) {
        return new Map(statsCache.map);
    }
    const aliasesMap = await loadInstanceAliasesMap();
    const { resolve, primaries: resolvedPrimaries } = buildPrimaryResolver(primaries, aliasesMap);
    const map = initStatsMap(resolvedPrimaries);
    const supabase = options.supabase ?? null;
    if (supabase) {
        await aggregateFromSupabase(supabase, map, resolve);
    }
    else {
        const localRows = await readLocalAquecedorEnviosLog();
        aggregateFromLocalLog(localRows, map, resolve, ownerEmail);
    }
    statsCache = { at: now, map: new Map(map) };
    statsCacheKey = cacheKey;
    return map;
}
