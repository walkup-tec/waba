import { promises as fs } from "fs";
import path from "path";
import { resolveDataFile } from "../data-path";
import { fetchEvoInstanceLiveState } from "./evo-connection-state.service";

const STORE_FILE = resolveDataFile("whatsapp-connecting-restriction.json");

/** Janela de UI: 3 horas a partir da detecção de `connecting`. */
export const WA_CONNECTING_RESTRICTION_MS = 3 * 60 * 60 * 1000;

/** Rechecagem periódica do connectionState. */
export const WA_CONNECTING_RECHECK_MS = 60 * 60 * 1000;

export type WhatsappConnectingRestrictionRow = {
  detectedAt: string;
  restrictedUntil: string;
  lastCheckedAt: string | null;
  lastLiveState: string | null;
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

function isConnectingState(liveState: string): boolean {
  // Apenas `connecting` (restrição WA observada). Não inclui pairing/qrcode do fluxo de QR.
  return String(liveState || "").trim().toLowerCase() === "connecting";
}

/**
 * Alinha o store ao live state:
 * - connecting → inicia/mantém restrição UI de 3h
 * - qualquer outro estado → remove a tag
 */
export async function syncWhatsappConnectingRestriction(
  instanceName: string,
  liveState: string,
): Promise<WhatsappConnectingRestrictionRow | null> {
  const name = String(instanceName || "").trim();
  if (!name) return null;
  const key = normalizeKey(name);
  const store = await loadStore();
  const now = Date.now();
  const state = String(liveState || "").trim().toLowerCase();

  if (!isConnectingState(state)) {
    if (store.instances[key]) {
      delete store.instances[key];
      await saveStore(store);
    }
    return null;
  }

  const existing = store.instances[key];
  const existingUntil = existing?.restrictedUntil
    ? new Date(existing.restrictedUntil).getTime()
    : 0;
  if (existing && Number.isFinite(existingUntil) && existingUntil > now) {
    existing.lastCheckedAt = new Date().toISOString();
    existing.lastLiveState = state;
    store.instances[key] = existing;
    await saveStore(store);
    return { ...existing };
  }

  const detectedAt = new Date().toISOString();
  const row: WhatsappConnectingRestrictionRow = {
    detectedAt,
    restrictedUntil: new Date(now + WA_CONNECTING_RESTRICTION_MS).toISOString(),
    lastCheckedAt: detectedAt,
    lastLiveState: state,
  };
  store.instances[key] = row;
  await saveStore(store);
  console.warn(
    `[WA-Restrição] ${name} em connecting — tag UI por 3h (até ${row.restrictedUntil}).`,
  );
  return { ...row };
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
  const now = Date.now();
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
  for (const [key, row] of Object.entries(store.instances)) {
    const untilMs = new Date(row.restrictedUntil).getTime();
    if (!Number.isFinite(untilMs)) {
      delete store.instances[key];
      dirty = true;
      continue;
    }
    // Countdown expirado: mantém a linha até o recheck 60min limpar via live state,
    // mas a UI trata active=false se quiser — pedimos tag enquanto connecting.
    // Se o until passou e ainda não rechecamos, mantém active para a tag (countdown "em breve")
    // até o tick de 60min confirmar que saiu de connecting.
    out[key] = {
      restrictedUntil: row.restrictedUntil,
      detectedAt: row.detectedAt,
      statusLabel: "Restrição",
      active: true,
    };
    void untilMs;
    void now;
  }
  if (dirty) await saveStore(store);
  return out;
}

/** Rechecagem: consulta connectionState e remove quem não está mais connecting. */
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
