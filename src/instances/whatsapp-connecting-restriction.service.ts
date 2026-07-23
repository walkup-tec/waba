import { promises as fs } from "fs";
import path from "path";
import { resolveDataFile } from "../data-path";
import { fetchEvoInstanceLiveState } from "./evo-connection-state.service";

const STORE_FILE = resolveDataFile("whatsapp-connecting-restriction.json");

/** Janela de UI: 3 horas (mantida para restrições explícitas futuras). */
export const WA_CONNECTING_RESTRICTION_MS = 3 * 60 * 60 * 1000;

/** Rechecagem periódica do connectionState. */
export const WA_CONNECTING_RECHECK_MS = 60 * 60 * 1000;

export type WhatsappConnectingRestrictionRow = {
  detectedAt: string;
  restrictedUntil: string;
  lastCheckedAt: string | null;
  lastLiveState: string | null;
  /** Origem: só `explicit` gera tag. `connecting` automático foi desativado (falso positivo). */
  source?: "explicit" | "connecting-auto";
};

type Store = {
  version: 1;
  updatedAt: string;
  instances: Record<string, WhatsappConnectingRestrictionRow>;
};

let cache: Store | null = null;

function normalizeKey(instanceName: string): string {
  return String(instanceName || "").trim().toLowerCase();
}

function defaultStore(): Store {
  return { version: 1, updatedAt: new Date().toISOString(), instances: {} };
}

async function loadStore(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (parsed?.version === 1 && parsed.instances && typeof parsed.instances === "object") {
      cache = {
        version: 1,
        updatedAt: String(parsed.updatedAt || new Date().toISOString()),
        instances: parsed.instances as Record<string, WhatsappConnectingRestrictionRow>,
      };
      return cache;
    }
  } catch {
    /* primeiro uso */
  }
  cache = defaultStore();
  return cache;
}

async function saveStore(store: Store): Promise<void> {
  store.updatedAt = new Date().toISOString();
  cache = store;
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  const tmp = `${STORE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
  await fs.rename(tmp, STORE_FILE);
}

/**
 * Alinha o store ao live state.
 *
 * Importante: `connecting` sozinho NÃO é restrição WhatsApp.
 * Costuma ser QR, reconnect após device_removed, ou Baileys reiniciando —
 * falso positivo observado em 6973 / 5181076973.
 *
 * Tags automáticas antigas (`connecting-auto` ou sem source) são removidas.
 * Restrição explícita futura pode usar `markWhatsappRestrictionExplicit`.
 */
export async function syncWhatsappConnectingRestriction(
  instanceName: string,
  liveState: string,
): Promise<WhatsappConnectingRestrictionRow | null> {
  const name = String(instanceName || "").trim();
  if (!name) return null;
  const key = normalizeKey(name);
  const store = await loadStore();
  const state = String(liveState || "").trim().toLowerCase();
  const existing = store.instances[key];

  if (!existing) return null;

  const source = existing.source || "connecting-auto";
  if (source !== "explicit") {
    delete store.instances[key];
    await saveStore(store);
    console.warn(
      `[WA-Restrição] removida tag automática de ${name} (live=${state || "—"}; connecting ≠ restrição).`,
    );
    return null;
  }

  // Restrição explícita: limpa se saiu de connecting/open com sucesso ou expirou.
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

/** Marca restrição explícita (ex.: recusa EVO com indício de ban) — não usar para connecting genérico. */
export async function markWhatsappRestrictionExplicit(
  instanceName: string,
  detail?: string,
): Promise<WhatsappConnectingRestrictionRow | null> {
  const name = String(instanceName || "").trim();
  if (!name) return null;
  const key = normalizeKey(name);
  const store = await loadStore();
  const now = Date.now();
  const detectedAt = new Date().toISOString();
  const row: WhatsappConnectingRestrictionRow = {
    detectedAt,
    restrictedUntil: new Date(now + WA_CONNECTING_RESTRICTION_MS).toISOString(),
    lastCheckedAt: detectedAt,
    lastLiveState: null,
    source: "explicit",
  };
  store.instances[key] = row;
  await saveStore(store);
  console.warn(
    `[WA-Restrição] explícita em ${name} até ${row.restrictedUntil}${detail ? ` (${String(detail).slice(0, 120)})` : ""}.`,
  );
  return { ...row };
}

export async function clearWhatsappConnectingRestriction(
  instanceName: string,
): Promise<boolean> {
  const key = normalizeKey(instanceName);
  if (!key) return false;
  const store = await loadStore();
  if (!store.instances[key]) return false;
  delete store.instances[key];
  await saveStore(store);
  return true;
}

/** Remove todas as tags automáticas legadas (connecting → restrição). */
export async function purgeAutomaticWhatsappConnectingRestrictions(): Promise<string[]> {
  const store = await loadStore();
  const cleared: string[] = [];
  for (const [key, row] of Object.entries(store.instances)) {
    if ((row.source || "connecting-auto") !== "explicit") {
      delete store.instances[key];
      cleared.push(key);
    }
  }
  if (cleared.length) await saveStore(store);
  return cleared;
}

export async function getWhatsappConnectingRestrictionMap(): Promise<
  Record<
    string,
    {
      restrictedUntil: string;
      detectedAt: string;
      statusLabel: "Restrição";
      active: boolean;
    }
  >
> {
  const store = await loadStore();
  const out: Record<
    string,
    {
      restrictedUntil: string;
      detectedAt: string;
      statusLabel: "Restrição";
      active: boolean;
    }
  > = {};
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
  if (dirty) await saveStore(store);
  return out;
}

/** Rechecagem: consulta connectionState e remove quem não deve mais ter tag. */
export async function recheckWhatsappConnectingRestrictions(): Promise<{
  cleared: string[];
  stillRestricted: string[];
}> {
  const store = await loadStore();
  const names = Object.keys(store.instances);
  const cleared: string[] = [];
  const stillRestricted: string[] = [];
  for (const key of names) {
    const liveState = await fetchEvoInstanceLiveState(key, { fresh: true });
    const row = await syncWhatsappConnectingRestriction(key, liveState || "close");
    if (row) stillRestricted.push(key);
    else cleared.push(key);
  }
  return { cleared, stillRestricted };
}
