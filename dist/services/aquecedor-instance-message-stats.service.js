"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAquecedorMessageStatsForInstances = getAquecedorMessageStatsForInstances;
const fs_1 = require("fs");
const data_path_1 = require("../data-path");
const aquecedor_chip_identity_1 = require("../aquecedor/aquecedor-chip-identity");
const evo_instance_phone_service_1 = require("../instances/evo-instance-phone.service");
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
/**
 * Constrói nome-de-instância (histórico) → chip, a partir dos números atuais
 * + controle_instancia + aliases.
 */
async function buildHistoricalNameToChipMap(instanceNames, numberByInstance, supabase) {
    const connected = instanceNames.map((name) => ({
        instancia: name,
        numero: numberByInstance.get(name) || numberByInstance.get(name.toLowerCase()) || "",
    }));
    const variantToChip = (0, aquecedor_chip_identity_1.buildAquecedorNumberVariantToChipMap)(connected.filter((c) => c.numero));
    const chipToPrimary = new Map();
    const nameToChip = new Map();
    for (const name of instanceNames) {
        const chip = (0, aquecedor_chip_identity_1.aquecedorChipKeyFromNumber)(numberByInstance.get(name) || numberByInstance.get(name.toLowerCase()) || "");
        if (!chip)
            continue;
        nameToChip.set(name.toLowerCase(), chip);
        if (!chipToPrimary.has(chip))
            chipToPrimary.set(chip, name);
    }
    const aliasesMap = await loadInstanceAliasesMap();
    for (const [technical, alias] of aliasesMap.entries()) {
        const techChip = nameToChip.get(normalizeKey(technical));
        const aliasChip = nameToChip.get(normalizeKey(alias));
        const chip = techChip || aliasChip;
        if (!chip)
            continue;
        nameToChip.set(normalizeKey(technical), chip);
        nameToChip.set(normalizeKey(alias), chip);
    }
    if (supabase && chipToPrimary.size) {
        try {
            const { data } = await supabase
                .from("controle_instancia")
                .select("instancia, numero_whatsapp")
                .limit(500);
            for (const row of Array.isArray(data) ? data : []) {
                const inst = String(row?.instancia || "").trim();
                const chip = (0, aquecedor_chip_identity_1.resolveNumberVariantToChip)(String(row?.numero_whatsapp || ""), variantToChip);
                if (!inst || !chip || !chipToPrimary.has(chip)) {
                    // Também aceita match por brazilWhatsAppNumbersMatch contra chips conhecidos
                    const rawChip = (0, aquecedor_chip_identity_1.aquecedorChipKeyFromNumber)(String(row?.numero_whatsapp || ""));
                    let matched = "";
                    for (const known of chipToPrimary.keys()) {
                        if (rawChip && (0, evo_instance_phone_service_1.brazilWhatsAppNumbersMatch)(known, rawChip)) {
                            matched = known;
                            break;
                        }
                    }
                    if (!matched || !inst)
                        continue;
                    nameToChip.set(inst.toLowerCase(), matched);
                    continue;
                }
                nameToChip.set(inst.toLowerCase(), chip);
            }
        }
        catch {
            /* optional */
        }
    }
    return { nameToChip, chipToPrimary };
}
async function aggregateFromSupabaseByChip(supabase, nameToChip, chipToPrimary, map) {
    const chipStats = new Map();
    for (const chip of chipToPrimary.keys()) {
        chipStats.set(chip, { sent: 0, received: 0, total: 0 });
    }
    const resolveChip = (rawName) => {
        const key = normalizeKey(rawName);
        if (!key)
            return null;
        return nameToChip.get(key) || null;
    };
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
            const fromChip = resolveChip(String(row?.instancia_origem || ""));
            const toChip = resolveChip(String(row?.instancia_destino || ""));
            if (fromChip && chipStats.has(fromChip)) {
                const s = chipStats.get(fromChip);
                s.sent += 1;
                s.total = s.sent + s.received;
            }
            if (toChip && chipStats.has(toChip)) {
                const s = chipStats.get(toChip);
                s.received += 1;
                s.total = s.sent + s.received;
            }
        }
        offset += rows.length;
        if (rows.length < LOGS_PAGE_SIZE)
            break;
    }
    for (const [chip, stats] of chipStats.entries()) {
        // Replica o mesmo volume do chip em todas as linhas da UI que apontam para ele
        // (rename / aliases não fragmentam a leitura).
        for (const [nameLower, mappedChip] of nameToChip.entries()) {
            if (mappedChip !== chip)
                continue;
            for (const primary of map.keys()) {
                if (normalizeKey(primary) !== nameLower)
                    continue;
                const row = map.get(primary);
                if (!row)
                    continue;
                row.sent = stats.sent;
                row.received = stats.received;
                row.total = stats.total;
            }
        }
    }
}
function aggregateFromLocalLogByChip(rows, nameToChip, chipToPrimary, map, ownerEmail) {
    const owner = normalizeEmail(ownerEmail);
    const chipStats = new Map();
    for (const chip of chipToPrimary.keys()) {
        chipStats.set(chip, { sent: 0, received: 0, total: 0 });
    }
    for (const row of rows) {
        if (String(row?.status || "") !== "Envio com Sucesso")
            continue;
        const rowOwner = normalizeEmail(String(row?.ownerEmail || ""));
        if (owner && rowOwner && rowOwner !== owner)
            continue;
        const fromChip = nameToChip.get(normalizeKey(String(row?.instanciaOrigem || "")));
        const toChip = nameToChip.get(normalizeKey(String(row?.instanciaDestino || "")));
        if (fromChip && chipStats.has(fromChip)) {
            const s = chipStats.get(fromChip);
            s.sent += 1;
            s.total = s.sent + s.received;
        }
        if (toChip && chipStats.has(toChip)) {
            const s = chipStats.get(toChip);
            s.received += 1;
            s.total = s.sent + s.received;
        }
    }
    for (const [chip, stats] of chipStats.entries()) {
        // Replica o mesmo volume do chip em todas as linhas da UI que apontam para ele
        // (rename / aliases não fragmentam a leitura).
        for (const [nameLower, mappedChip] of nameToChip.entries()) {
            if (mappedChip !== chip)
                continue;
            for (const primary of map.keys()) {
                if (normalizeKey(primary) !== nameLower)
                    continue;
                const row = map.get(primary);
                if (!row)
                    continue;
                row.sent = stats.sent;
                row.received = stats.received;
                row.total = stats.total;
            }
        }
    }
}
async function getAquecedorMessageStatsForInstances(instanceNames, options = {}) {
    const primaries = Array.from(new Set(instanceNames.map((n) => String(n || "").trim()).filter(Boolean)));
    if (!primaries.length)
        return new Map();
    const numberByInstance = new Map();
    if (options.numberByInstance instanceof Map) {
        for (const [k, v] of options.numberByInstance.entries()) {
            numberByInstance.set(String(k), String(v || ""));
            numberByInstance.set(String(k).toLowerCase(), String(v || ""));
        }
    }
    else if (options.numberByInstance && typeof options.numberByInstance === "object") {
        for (const [k, v] of Object.entries(options.numberByInstance)) {
            numberByInstance.set(k, String(v || ""));
            numberByInstance.set(k.toLowerCase(), String(v || ""));
        }
    }
    const ownerEmail = normalizeEmail(String(options.ownerEmail || ""));
    const cacheKey = `${ownerEmail}::chip::${primaries
        .map((n) => `${n}:${(0, aquecedor_chip_identity_1.aquecedorChipKeyFromNumber)(numberByInstance.get(n) || "")}`)
        .sort()
        .join("|")}`;
    const now = Date.now();
    if (statsCache && statsCacheKey === cacheKey && now - statsCache.at < STATS_CACHE_MS) {
        return new Map(statsCache.map);
    }
    const map = initStatsMap(primaries);
    const supabase = options.supabase ?? null;
    const { nameToChip, chipToPrimary } = await buildHistoricalNameToChipMap(primaries, numberByInstance, supabase);
    if (supabase && chipToPrimary.size) {
        await aggregateFromSupabaseByChip(supabase, nameToChip, chipToPrimary, map);
    }
    else {
        const localRows = await readLocalAquecedorEnviosLog();
        aggregateFromLocalLogByChip(localRows, nameToChip, chipToPrimary, map, ownerEmail);
    }
    statsCache = { at: now, map: new Map(map) };
    statsCacheKey = cacheKey;
    return map;
}
