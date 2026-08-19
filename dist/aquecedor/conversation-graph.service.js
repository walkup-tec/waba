"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRAPH_FILE = exports.MAX_BALANCE_ABS = void 0;
exports.buildConversationPairKey = buildConversationPairKey;
exports.splitConversationPairKey = splitConversationPairKey;
exports.dayKeySaoPaulo = dayKeySaoPaulo;
exports.getOwnerConversationGraph = getOwnerConversationGraph;
exports.ensureCompletePairGraph = ensureCompletePairGraph;
exports.bootstrapOwnerGraphFromEvents = bootstrapOwnerGraphFromEvents;
exports.recordDirectedSend = recordDirectedSend;
exports.recordPairSelection = recordPairSelection;
exports.getPairDirectionAllowed = getPairDirectionAllowed;
exports.listDirectedCandidatesForInstances = listDirectedCandidatesForInstances;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../data-path");
const GRAPH_FILE = (0, data_path_1.resolveDataFile)("aquecedor-conversation-graph.json");
exports.GRAPH_FILE = GRAPH_FILE;
const MAX_BALANCE_ABS = 2;
exports.MAX_BALANCE_ABS = MAX_BALANCE_ABS;
let cache = null;
let writeChain = Promise.resolve();
function normalizeOwner(email) {
    return String(email || "").trim().toLowerCase();
}
function normalizeInst(name) {
    return String(name || "").trim();
}
/** Chave estável do par (A|B com A <= B por localeCompare). */
function buildConversationPairKey(instanciaA, instanciaB) {
    const a = normalizeInst(instanciaA);
    const b = normalizeInst(instanciaB);
    if (!a || !b)
        return "";
    return a.localeCompare(b) <= 0 ? `${a}|${b}` : `${b}|${a}`;
}
function splitConversationPairKey(pairKey) {
    const parts = String(pairKey || "").split("|");
    if (parts.length !== 2)
        return null;
    const a = normalizeInst(parts[0]);
    const b = normalizeInst(parts[1]);
    if (!a || !b)
        return null;
    return a.localeCompare(b) <= 0 ? { a, b } : { a: b, b: a };
}
function dayKeySaoPaulo(atMs = Date.now()) {
    try {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date(atMs));
    }
    catch {
        return new Date(atMs).toISOString().slice(0, 10);
    }
}
function emptyOwnerGraph() {
    return {
        pairs: {},
        phones: {},
        updatedAt: new Date().toISOString(),
        bootstrapped: false,
        lastSelectedPairKey: null,
        selectionHistory: [],
    };
}
function recomputeBalance(pair) {
    pair.balance = pair.sentAB - pair.sentBA;
    pair.totalMessages = pair.sentAB + pair.sentBA;
    pair.updatedAt = new Date().toISOString();
}
function ensurePhone(owner, phone, atMs) {
    const key = normalizeInst(phone);
    const dayKey = dayKeySaoPaulo(atMs);
    let stats = owner.phones[key];
    if (!stats) {
        stats = {
            phone: key,
            sentToday: 0,
            receivedToday: 0,
            sentTotal: 0,
            receivedTotal: 0,
            lastConversationAt: null,
            lastSentAt: null,
            lastReceivedAt: null,
            dayKey,
        };
        owner.phones[key] = stats;
        return stats;
    }
    if (stats.dayKey !== dayKey) {
        stats.dayKey = dayKey;
        stats.sentToday = 0;
        stats.receivedToday = 0;
    }
    return stats;
}
function ensurePair(owner, instA, instB) {
    const key = buildConversationPairKey(instA, instB);
    if (!key)
        return null;
    const ordered = splitConversationPairKey(key);
    if (!ordered)
        return null;
    const dayKey = dayKeySaoPaulo();
    let pair = owner.pairs[key];
    if (!pair) {
        const now = new Date().toISOString();
        pair = {
            a: ordered.a,
            b: ordered.b,
            sentAB: 0,
            sentBA: 0,
            balance: 0,
            lastMessageAt: null,
            lastDirection: null,
            totalMessages: 0,
            usageToday: 0,
            dayKey,
            createdAt: now,
            updatedAt: now,
        };
        owner.pairs[key] = pair;
    }
    else {
        if (typeof pair.usageToday !== "number")
            pair.usageToday = 0;
        if (!pair.dayKey)
            pair.dayKey = dayKey;
        if (pair.dayKey !== dayKey) {
            pair.dayKey = dayKey;
            pair.usageToday = 0;
        }
    }
    return pair;
}
function applyDirectedToOwner(owner, fromInst, toInst, atIso) {
    const from = normalizeInst(fromInst);
    const to = normalizeInst(toInst);
    if (!from || !to || from.toLowerCase() === to.toLowerCase())
        return;
    const pair = ensurePair(owner, from, to);
    if (!pair)
        return;
    const atMs = Date.parse(atIso) || Date.now();
    const at = Number.isFinite(Date.parse(atIso)) ? atIso : new Date(atMs).toISOString();
    const dayKey = dayKeySaoPaulo(atMs);
    if (pair.dayKey !== dayKey) {
        pair.dayKey = dayKey;
        pair.usageToday = 0;
    }
    const direction = from.localeCompare(pair.a) === 0 && to.localeCompare(pair.b) === 0 ? "a_to_b" : "b_to_a";
    if (direction === "a_to_b")
        pair.sentAB += 1;
    else
        pair.sentBA += 1;
    pair.lastDirection = direction;
    pair.lastMessageAt = at;
    pair.usageToday = (pair.usageToday || 0) + 1;
    recomputeBalance(pair);
    const fromStats = ensurePhone(owner, from, atMs);
    const toStats = ensurePhone(owner, to, atMs);
    fromStats.sentToday += 1;
    fromStats.sentTotal += 1;
    fromStats.lastSentAt = at;
    fromStats.lastConversationAt = at;
    toStats.receivedToday += 1;
    toStats.receivedTotal += 1;
    toStats.lastReceivedAt = at;
    toStats.lastConversationAt = at;
    owner.lastSelectedPairKey = buildConversationPairKey(from, to);
    owner.updatedAt = new Date().toISOString();
}
async function readStoreFromDisk() {
    try {
        const raw = await fs_1.promises.readFile(GRAPH_FILE, "utf-8");
        const parsed = JSON.parse(raw || "{}");
        if (!parsed || typeof parsed !== "object")
            return { owners: {} };
        if (!parsed.owners || typeof parsed.owners !== "object")
            return { owners: {} };
        return parsed;
    }
    catch {
        return { owners: {} };
    }
}
async function writeStoreAtomic(store) {
    await fs_1.promises.mkdir(path_1.default.dirname(GRAPH_FILE), { recursive: true });
    const tmp = `${GRAPH_FILE}.${process.pid}.${Date.now()}.tmp`;
    const payload = JSON.stringify(store, null, 2);
    await fs_1.promises.writeFile(tmp, payload, "utf-8");
    try {
        await fs_1.promises.rename(tmp, GRAPH_FILE);
    }
    catch {
        await fs_1.promises.writeFile(GRAPH_FILE, payload, "utf-8");
        try {
            await fs_1.promises.unlink(tmp);
        }
        catch {
            /* ignore */
        }
    }
}
function enqueueWrite(store) {
    cache = store;
    writeChain = writeChain
        .then(() => writeStoreAtomic(store))
        .catch((err) => {
        console.error("[aquecedor-graph] falha ao persistir:", err);
    });
}
async function loadStore() {
    if (cache)
        return cache;
    cache = await readStoreFromDisk();
    return cache;
}
function getOrCreateOwner(store, ownerEmail) {
    const key = normalizeOwner(ownerEmail);
    if (!store.owners[key]) {
        store.owners[key] = emptyOwnerGraph();
    }
    const owner = store.owners[key];
    if (!Array.isArray(owner.selectionHistory))
        owner.selectionHistory = [];
    if (owner.lastSelectedPairKey === undefined)
        owner.lastSelectedPairKey = null;
    return owner;
}
async function getOwnerConversationGraph(ownerEmail) {
    const store = await loadStore();
    return getOrCreateOwner(store, ownerEmail);
}
/**
 * Garante pares para todas as combinações C(N,2) das instâncias elegíveis.
 * Não inventa histórico — só cria arestas com contadores zerados se faltarem.
 */
async function ensureCompletePairGraph(ownerEmail, instanceNames) {
    const store = await loadStore();
    const owner = getOrCreateOwner(store, ownerEmail);
    const names = Array.from(new Set(instanceNames.map(normalizeInst).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const nowMs = Date.now();
    for (const name of names) {
        ensurePhone(owner, name, nowMs);
    }
    for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
            ensurePair(owner, names[i], names[j]);
        }
    }
    owner.updatedAt = new Date().toISOString();
    enqueueWrite(store);
    return owner;
}
/**
 * Bootstrap a partir de eventos históricos (mais antigo → mais recente).
 * Só roda se o owner ainda não foi bootstrapped (ou force=true).
 */
async function bootstrapOwnerGraphFromEvents(ownerEmail, events, options = {}) {
    const store = await loadStore();
    const owner = getOrCreateOwner(store, ownerEmail);
    if (owner.bootstrapped && !options.force) {
        if (options.instanceNames?.length) {
            await ensureCompletePairGraph(ownerEmail, options.instanceNames);
        }
        return getOrCreateOwner(await loadStore(), ownerEmail);
    }
    owner.pairs = {};
    owner.phones = {};
    const chronological = [...events].sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
    for (const ev of chronological) {
        applyDirectedToOwner(owner, ev.fromInst, ev.toInst, ev.at);
    }
    if (options.instanceNames?.length) {
        const nowMs = Date.now();
        const names = Array.from(new Set(options.instanceNames.map(normalizeInst).filter(Boolean))).sort((a, b) => a.localeCompare(b));
        for (const name of names)
            ensurePhone(owner, name, nowMs);
        for (let i = 0; i < names.length; i += 1) {
            for (let j = i + 1; j < names.length; j += 1) {
                ensurePair(owner, names[i], names[j]);
            }
        }
    }
    owner.bootstrapped = true;
    owner.updatedAt = new Date().toISOString();
    enqueueWrite(store);
    return owner;
}
async function recordDirectedSend(input) {
    const store = await loadStore();
    const owner = getOrCreateOwner(store, input.ownerEmail);
    const at = String(input.at || new Date().toISOString());
    applyDirectedToOwner(owner, input.fromInst, input.toInst, at);
    owner.bootstrapped = true;
    enqueueWrite(store);
    const key = buildConversationPairKey(input.fromInst, input.toInst);
    return key ? owner.pairs[key] || null : null;
}
async function recordPairSelection(input) {
    const store = await loadStore();
    const owner = getOrCreateOwner(store, input.ownerEmail);
    owner.lastSelectedPairKey = input.record.pairKey;
    owner.selectionHistory = [input.record, ...(owner.selectionHistory || [])].slice(0, 40);
    owner.updatedAt = new Date().toISOString();
    enqueueWrite(store);
}
function getPairDirectionAllowed(pair, origem, destino) {
    const from = normalizeInst(origem);
    const to = normalizeInst(destino);
    if (!from || !to)
        return { ok: false, reason: "origem/destino inválidos" };
    const direction = from.localeCompare(pair.a) === 0 && to.localeCompare(pair.b) === 0 ? "a_to_b" : "b_to_a";
    // Regra 3: nunca A→B seguido sem resposta B→A.
    if (pair.lastDirection === direction && pair.totalMessages > 0) {
        return { ok: false, reason: "mesmo sentido consecutivo sem resposta" };
    }
    const nextBalance = direction === "a_to_b" ? pair.balance + 1 : pair.balance - 1;
    // Regra 2: |saldo| <= 2.
    if (Math.abs(nextBalance) > MAX_BALANCE_ABS) {
        return { ok: false, reason: `|saldo| excederia ${MAX_BALANCE_ABS}` };
    }
    // Regra 1: se já há desequilíbrio, só permitir direção que reduz |saldo|.
    if (Math.abs(pair.balance) >= 1) {
        if (Math.abs(nextBalance) >= Math.abs(pair.balance)) {
            return { ok: false, reason: "direção não reduz o desequilíbrio" };
        }
    }
    return { ok: true };
}
function listDirectedCandidatesForInstances(owner, instanceNames) {
    const names = Array.from(new Set(instanceNames.map(normalizeInst).filter(Boolean)));
    const out = [];
    for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
            const pairKey = buildConversationPairKey(names[i], names[j]);
            const pair = owner.pairs[pairKey] || ensurePair(owner, names[i], names[j]);
            if (!pair)
                continue;
            for (const [origem, destino] of [
                [pair.a, pair.b],
                [pair.b, pair.a],
            ]) {
                const gate = getPairDirectionAllowed(pair, origem, destino);
                if (!gate.ok)
                    continue;
                out.push({ origem, destino, pair, pairKey });
            }
        }
    }
    return out;
}
