/**
 * Cooldown de pares do aquecedor após falha de entrega confirmada.
 * Evita reescolher o mesmo A→B e travar o ciclo.
 */
import fs from "fs/promises";
import path from "path";
import { resolveDataFile } from "../data-path";

const STORE_FILE = resolveDataFile("aquecedor-delivery-cooldowns.json");
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;

type CooldownEntry = {
  untilMs: number;
  reason: string;
  updatedAt: string;
};

type Store = {
  directed: Record<string, CooldownEntry>;
};

let cache: Store | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

export function buildDirectedCooldownKey(origem: string, destino: string): string {
  return `${String(origem || "").trim().toLowerCase()}→${String(destino || "").trim().toLowerCase()}`;
}

async function loadStore(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Store;
    cache = {
      directed: parsed?.directed && typeof parsed.directed === "object" ? parsed.directed : {},
    };
  } catch {
    cache = { directed: {} };
  }
  return cache;
}

function enqueueWrite(store: Store): void {
  cache = store;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void fs
      .mkdir(path.dirname(STORE_FILE), { recursive: true })
      .then(() => fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8"))
      .catch((err) => console.warn("[Aquecedor] cooldown persist:", err?.message || err));
  }, 250);
}

function pruneExpired(store: Store, nowMs = Date.now()): void {
  for (const [key, entry] of Object.entries(store.directed)) {
    if (!entry || entry.untilMs <= nowMs) delete store.directed[key];
  }
}

export async function listBlockedDirectedKeys(nowMs = Date.now()): Promise<Set<string>> {
  const store = await loadStore();
  pruneExpired(store, nowMs);
  enqueueWrite(store);
  return new Set(
    Object.entries(store.directed)
      .filter(([, entry]) => entry.untilMs > nowMs)
      .map(([key]) => key),
  );
}

export async function isDirectedDeliveryBlocked(
  origem: string,
  destino: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const key = buildDirectedCooldownKey(origem, destino);
  if (!key.includes("→")) return false;
  const blocked = await listBlockedDirectedKeys(nowMs);
  return blocked.has(key);
}

export async function recordDirectedDeliveryFailure(input: {
  origem: string;
  destino: string;
  reason: string;
  cooldownMs?: number;
}): Promise<{ key: string; untilMs: number }> {
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
