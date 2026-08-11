import { promises as fs } from "fs";
import path from "path";
import { resolveDataFile } from "../data-path";
import type {
  ConversationPair,
  ConversationGraphStore,
  DirectedExchangeEvent,
  OwnerConversationGraph,
  PairDirection,
  PhoneStatistics,
} from "./conversation-pair.types";

const GRAPH_FILE = resolveDataFile("aquecedor-conversation-graph.json");
const MAX_BALANCE_ABS = 2;

let cache: ConversationGraphStore | null = null;
let writeChain: Promise<void> = Promise.resolve();

function normalizeOwner(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function normalizeInst(name: string): string {
  return String(name || "").trim();
}

/** Chave estável do par (A|B com A <= B por localeCompare). */
export function buildConversationPairKey(instanciaA: string, instanciaB: string): string {
  const a = normalizeInst(instanciaA);
  const b = normalizeInst(instanciaB);
  if (!a || !b) return "";
  return a.localeCompare(b) <= 0 ? `${a}|${b}` : `${b}|${a}`;
}

export function splitConversationPairKey(pairKey: string): { a: string; b: string } | null {
  const parts = String(pairKey || "").split("|");
  if (parts.length !== 2) return null;
  const a = normalizeInst(parts[0]);
  const b = normalizeInst(parts[1]);
  if (!a || !b) return null;
  return a.localeCompare(b) <= 0 ? { a, b } : { a: b, b: a };
}

export function dayKeySaoPaulo(atMs: number = Date.now()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(atMs));
  } catch {
    return new Date(atMs).toISOString().slice(0, 10);
  }
}

function emptyOwnerGraph(): OwnerConversationGraph {
  return {
    pairs: {},
    phones: {},
    updatedAt: new Date().toISOString(),
    bootstrapped: false,
    identityMode: "chip",
    lastSelectedPairKey: null,
    selectionHistory: [],
  };
}

function recomputeBalance(pair: ConversationPair): void {
  pair.balance = pair.sentAB - pair.sentBA;
  pair.totalMessages = pair.sentAB + pair.sentBA;
  pair.updatedAt = new Date().toISOString();
}

function ensurePhone(owner: OwnerConversationGraph, phone: string, atMs: number): PhoneStatistics {
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

function ensurePair(
  owner: OwnerConversationGraph,
  instA: string,
  instB: string,
): ConversationPair | null {
  const key = buildConversationPairKey(instA, instB);
  if (!key) return null;
  const ordered = splitConversationPairKey(key);
  if (!ordered) return null;
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
  } else {
    if (typeof pair.usageToday !== "number") pair.usageToday = 0;
    if (!pair.dayKey) pair.dayKey = dayKey;
    if (pair.dayKey !== dayKey) {
      pair.dayKey = dayKey;
      pair.usageToday = 0;
    }
  }
  return pair;
}

function applyDirectedToOwner(
  owner: OwnerConversationGraph,
  fromInst: string,
  toInst: string,
  atIso: string,
): void {
  const from = normalizeInst(fromInst);
  const to = normalizeInst(toInst);
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return;

  const pair = ensurePair(owner, from, to);
  if (!pair) return;

  const atMs = Date.parse(atIso) || Date.now();
  const at = Number.isFinite(Date.parse(atIso)) ? atIso : new Date(atMs).toISOString();
  const dayKey = dayKeySaoPaulo(atMs);
  if (pair.dayKey !== dayKey) {
    pair.dayKey = dayKey;
    pair.usageToday = 0;
  }
  const direction: PairDirection =
    from.localeCompare(pair.a) === 0 && to.localeCompare(pair.b) === 0 ? "a_to_b" : "b_to_a";

  if (direction === "a_to_b") pair.sentAB += 1;
  else pair.sentBA += 1;
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

async function readStoreFromDisk(): Promise<ConversationGraphStore> {
  try {
    const raw = await fs.readFile(GRAPH_FILE, "utf-8");
    const parsed = JSON.parse(raw || "{}") as ConversationGraphStore;
    if (!parsed || typeof parsed !== "object") return { owners: {} };
    if (!parsed.owners || typeof parsed.owners !== "object") return { owners: {} };
    return parsed;
  } catch {
    return { owners: {} };
  }
}

async function writeStoreAtomic(store: ConversationGraphStore): Promise<void> {
  await fs.mkdir(path.dirname(GRAPH_FILE), { recursive: true });
  const tmp = `${GRAPH_FILE}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(store, null, 2);
  await fs.writeFile(tmp, payload, "utf-8");
  try {
    await fs.rename(tmp, GRAPH_FILE);
  } catch {
    await fs.writeFile(GRAPH_FILE, payload, "utf-8");
    try {
      await fs.unlink(tmp);
    } catch {
      /* ignore */
    }
  }
}

function enqueueWrite(store: ConversationGraphStore): void {
  cache = store;
  writeChain = writeChain
    .then(() => writeStoreAtomic(store))
    .catch((err) => {
      console.error("[aquecedor-graph] falha ao persistir:", err);
    });
}

async function loadStore(): Promise<ConversationGraphStore> {
  if (cache) return cache;
  cache = await readStoreFromDisk();
  return cache;
}

function getOrCreateOwner(store: ConversationGraphStore, ownerEmail: string): OwnerConversationGraph {
  const key = normalizeOwner(ownerEmail);
  if (!store.owners[key]) {
    store.owners[key] = emptyOwnerGraph();
  }
  const owner = store.owners[key];
  if (!Array.isArray(owner.selectionHistory)) owner.selectionHistory = [];
  if (owner.lastSelectedPairKey === undefined) owner.lastSelectedPairKey = null;
  return owner;
}

export async function getOwnerConversationGraph(
  ownerEmail: string,
): Promise<OwnerConversationGraph> {
  const store = await loadStore();
  return getOrCreateOwner(store, ownerEmail);
}

/**
 * Garante pares para todas as combinações C(N,2) das instâncias elegíveis.
 * Não inventa histórico — só cria arestas com contadores zerados se faltarem.
 */
export async function ensureCompletePairGraph(
  ownerEmail: string,
  instanceNames: string[],
): Promise<OwnerConversationGraph> {
  const store = await loadStore();
  const owner = getOrCreateOwner(store, ownerEmail);
  const names = Array.from(
    new Set(instanceNames.map(normalizeInst).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

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
export async function bootstrapOwnerGraphFromEvents(
  ownerEmail: string,
  events: DirectedExchangeEvent[],
  options: { force?: boolean; instanceNames?: string[]; identityMode?: "chip" | "instance" } = {},
): Promise<OwnerConversationGraph> {
  const store = await loadStore();
  const owner = getOrCreateOwner(store, ownerEmail);
  const desiredMode = options.identityMode || "chip";
  const needsIdentityMigration = owner.identityMode !== desiredMode;
  if (owner.bootstrapped && !options.force && !needsIdentityMigration) {
    if (options.instanceNames?.length) {
      await ensureCompletePairGraph(ownerEmail, options.instanceNames);
    }
    return getOrCreateOwner(await loadStore(), ownerEmail);
  }

  owner.pairs = {};
  owner.phones = {};
  const chronological = [...events].sort(
    (a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0),
  );
  for (const ev of chronological) {
    applyDirectedToOwner(owner, ev.fromInst, ev.toInst, ev.at);
  }
  if (options.instanceNames?.length) {
    const nowMs = Date.now();
    const names = Array.from(
      new Set(options.instanceNames.map(normalizeInst).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    for (const name of names) ensurePhone(owner, name, nowMs);
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        ensurePair(owner, names[i], names[j]);
      }
    }
  }
  owner.bootstrapped = true;
  owner.identityMode = desiredMode;
  owner.updatedAt = new Date().toISOString();
  enqueueWrite(store);
  return owner;
}

export async function recordDirectedSend(input: {
  ownerEmail: string;
  fromInst: string;
  toInst: string;
  at?: string;
}): Promise<ConversationPair | null> {
  const store = await loadStore();
  const owner = getOrCreateOwner(store, input.ownerEmail);
  const at = String(input.at || new Date().toISOString());
  applyDirectedToOwner(owner, input.fromInst, input.toInst, at);
  owner.bootstrapped = true;
  enqueueWrite(store);
  const key = buildConversationPairKey(input.fromInst, input.toInst);
  return key ? owner.pairs[key] || null : null;
}

export async function recordPairSelection(input: {
  ownerEmail: string;
  record: import("./conversation-pair.types").PairSelectionRecord;
}): Promise<void> {
  const store = await loadStore();
  const owner = getOrCreateOwner(store, input.ownerEmail);
  owner.lastSelectedPairKey = input.record.pairKey;
  owner.selectionHistory = [input.record, ...(owner.selectionHistory || [])].slice(0, 40);
  owner.updatedAt = new Date().toISOString();
  enqueueWrite(store);
}

export function getPairDirectionAllowed(
  pair: ConversationPair,
  origem: string,
  destino: string,
): { ok: boolean; reason?: string } {
  const from = normalizeInst(origem);
  const to = normalizeInst(destino);
  if (!from || !to) return { ok: false, reason: "origem/destino inválidos" };

  const direction: PairDirection =
    from.localeCompare(pair.a) === 0 && to.localeCompare(pair.b) === 0 ? "a_to_b" : "b_to_a";

  const nextBalance =
    direction === "a_to_b" ? pair.balance + 1 : pair.balance - 1;
  const wouldReduceImbalance =
    Math.abs(pair.balance) >= 1 && Math.abs(nextBalance) < Math.abs(pair.balance);

  // Regra 3: nunca A→B seguido sem resposta B→A.
  // Exceção: se o grafo ficou com |saldo|>=1 e lastDirection JÁ é o sentido curativo
  // (legado/bootstrap), bloquear a repetição cria deadlock permanente — permitir
  // repetir só enquanto reduz o desequilíbrio.
  if (pair.lastDirection === direction && pair.totalMessages > 0 && !wouldReduceImbalance) {
    return { ok: false, reason: "mesmo sentido consecutivo sem resposta" };
  }

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

export function listDirectedCandidatesForInstances(
  owner: OwnerConversationGraph,
  instanceNames: string[],
): Array<{ origem: string; destino: string; pair: ConversationPair; pairKey: string }> {
  const names = Array.from(
    new Set(instanceNames.map(normalizeInst).filter(Boolean)),
  );
  const out: Array<{ origem: string; destino: string; pair: ConversationPair; pairKey: string }> =
    [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const pairKey = buildConversationPairKey(names[i], names[j]);
      const pair = owner.pairs[pairKey] || ensurePair(owner, names[i], names[j]);
      if (!pair) continue;
      for (const [origem, destino] of [
        [pair.a, pair.b],
        [pair.b, pair.a],
      ] as const) {
        const gate = getPairDirectionAllowed(pair, origem, destino);
        if (!gate.ok) continue;
        out.push({ origem, destino, pair, pairKey });
      }
    }
  }
  return out;
}

export { MAX_BALANCE_ABS, GRAPH_FILE };
