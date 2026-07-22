import { promises as fs } from "fs";
import path from "path";
import { resolveDataFile } from "../data-path";

const LIFECYCLE_FILE = resolveDataFile("aquecedor-instance-lifecycle.json");
const EVO_INSTANCES_CACHE_FILE = resolveDataFile("evo-instances-cache.json");
const INSTANCE_ALIASES_FILE = resolveDataFile("instance-aliases.json");
const RESTRICTION_WAIT_MS = 6 * 60 * 60 * 1000;
export const AQUECEDOR_STAGGER_PROMOTE_MS = 6 * 60 * 60 * 1000;
/** Duração da fase Preparando (6h desde a integração). */
export const AQUECEDOR_PREPARING_DURATION_MS = AQUECEDOR_STAGGER_PROMOTE_MS;
const PREPARING_DURATION_MS = AQUECEDOR_PREPARING_DURATION_MS;
/** Instâncias integradas antes desta data entram direto como ativas (legado). */
export const AQUECEDOR_LIFECYCLE_GRANDFATHER_CUTOFF_ISO = "2026-06-22T00:00:00.000Z";

export type AquecedorInstancePhase = "preparing" | "active" | "restricted_wait";

export type AquecedorInstanceLifecycleRow = {
  phase: AquecedorInstancePhase;
  preparingSince: string | null;
  activatedAt: string | null;
  restrictedUntil: string | null;
  restrictedReason: string | null;
  dailyDate: string | null;
  dailySendCount: number;
  dailyCap: number | null;
};

type LifecycleStore = {
  version: 1;
  updatedAt: string;
  lastStaggerPromotionAt: string | null;
  instances: Record<string, AquecedorInstanceLifecycleRow>;
};

let cache: LifecycleStore | null = null;
let aliasesCache: Map<string, string> | null = null;

function normalizeKey(instanceName: string): string {
  return String(instanceName || "").trim().toLowerCase();
}

async function loadAliasesMap(): Promise<Map<string, string>> {
  if (aliasesCache) return aliasesCache;
  try {
    const raw = await fs.readFile(INSTANCE_ALIASES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    aliasesCache = new Map<string, string>();
    for (const [technical, alias] of Object.entries(parsed || {})) {
      const key = String(technical || "").trim();
      const val = String(alias || "").trim();
      if (key && val) aliasesCache.set(key, val);
    }
  } catch {
    aliasesCache = new Map();
  }
  return aliasesCache;
}

/** Todas as chaves (técnica + alias) que referem a mesma instância. */
export function collectInstanceNameKeys(
  instanceName: string,
  aliasesMap: Map<string, string>,
): string[] {
  const keys = new Set<string>();
  const add = (raw: string) => {
    const key = normalizeKey(raw);
    if (key) keys.add(key);
  };
  const target = normalizeKey(instanceName);
  if (!target) return [];
  add(instanceName);
  for (const [technical, alias] of aliasesMap) {
    const techKey = normalizeKey(technical);
    const aliasKey = normalizeKey(alias);
    if (techKey === target || aliasKey === target) {
      add(technical);
      add(alias);
    }
  }
  return [...keys];
}

export async function findAquecedorLifecycleRow(
  instanceName: string,
): Promise<{ key: string; row: AquecedorInstanceLifecycleRow } | null> {
  const aliasesMap = await loadAliasesMap();
  const store = await loadStore();
  for (const key of collectInstanceNameKeys(instanceName, aliasesMap)) {
    const row = store.instances[key];
    if (row) return { key, row };
  }
  return null;
}

export async function getAquecedorLifecycleStatusForInstance(instanceName: string): Promise<{
  phase: AquecedorInstancePhase;
  statusLabel: string | null;
  restrictedUntil: string | null;
  promoteAt: string | null;
} | null> {
  await syncAquecedorPreparingPromotions();
  const found = await findAquecedorLifecycleRow(instanceName);
  if (!found) return null;
  const row = found.row;
  refreshRestrictionPhase(row);
  let promoteAt: string | null = null;
  if (row.phase === "preparing") {
    promoteAt = new Date(computePreparingPromoteAtMs(row)).toISOString();
  }
  return {
    phase: row.phase,
    statusLabel: formatAquecedorLifecycleStatusLabel(row),
    restrictedUntil: row.restrictedUntil,
    promoteAt,
  };
}

function emptyRow(
  phase: AquecedorInstancePhase,
  preparingSince?: string | null,
): AquecedorInstanceLifecycleRow {
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

async function readEvoInstanceCreatedAt(instanceName: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(EVO_INSTANCES_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { items?: Array<{ name?: string; createdAt?: string }> };
    const aliasesMap = await loadAliasesMap();
    const keys = new Set(collectInstanceNameKeys(instanceName, aliasesMap));
    for (const item of parsed?.items || []) {
      const itemKey = normalizeKey(String(item?.name || ""));
      if (!keys.has(itemKey)) continue;
      const createdAt = String(item?.createdAt || "").trim();
      return createdAt || null;
    }
  } catch {
    /* cache opcional */
  }
  return null;
}

function isGrandfatherEligible(createdAt: string | null): boolean {
  if (!createdAt) return true;
  const createdMs = new Date(createdAt).getTime();
  const cutoffMs = new Date(AQUECEDOR_LIFECYCLE_GRANDFATHER_CUTOFF_ISO).getTime();
  return !Number.isFinite(createdMs) || createdMs < cutoffMs;
}

function applyPreparingPhase(row: AquecedorInstanceLifecycleRow, preparingSince: string): void {
  row.phase = "preparing";
  row.preparingSince = preparingSince;
  row.activatedAt = null;
}

/**
 * Reverte active → Preparando quando a integração EVO é recente ou mais nova
 * que a ativação anterior (recriação / grandfather indevido).
 */
function shouldResetActiveToPreparing(
  row: AquecedorInstanceLifecycleRow,
  integrationAt: string | null,
): boolean {
  if (row.phase !== "active") return false;
  if (!integrationAt || isGrandfatherEligible(integrationAt)) return false;
  const integMs = new Date(integrationAt).getTime();
  if (!Number.isFinite(integMs)) return false;

  const withinPreparingWindow = Date.now() - integMs < PREPARING_DURATION_MS;
  const activatedMs = row.activatedAt ? new Date(row.activatedAt).getTime() : NaN;
  const reintegratedAfterActivation =
    Number.isFinite(activatedMs) && integMs > activatedMs + 10_000;

  return withinPreparingWindow || reintegratedAfterActivation;
}

function maybeResetActiveToPreparing(
  row: AquecedorInstanceLifecycleRow,
  integrationAt: string | null,
): boolean {
  if (!shouldResetActiveToPreparing(row, integrationAt)) return false;
  applyPreparingPhase(row, String(integrationAt));
  return true;
}

async function reconcileGrandfatheredActiveRow(
  instanceName: string,
  row: AquecedorInstanceLifecycleRow,
): Promise<boolean> {
  const createdAt = await readEvoInstanceCreatedAt(instanceName);
  return maybeResetActiveToPreparing(row, createdAt);
}

export type RegisterAquecedorPreparingOptions = {
  /** Create/QR de integração nova: força Preparando mesmo se já havia row active. */
  forceNewIntegration?: boolean;
};

function defaultStore(): LifecycleStore {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    lastStaggerPromotionAt: null,
    instances: {},
  };
}

async function loadStore(): Promise<LifecycleStore> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(LIFECYCLE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<LifecycleStore>;
    if (parsed?.version === 1 && parsed.instances && typeof parsed.instances === "object") {
      cache = {
        version: 1,
        updatedAt: String(parsed.updatedAt || new Date().toISOString()),
        lastStaggerPromotionAt:
          typeof parsed.lastStaggerPromotionAt === "string" ? parsed.lastStaggerPromotionAt : null,
        instances: parsed.instances as Record<string, AquecedorInstanceLifecycleRow>,
      };
      return cache;
    }
  } catch {
    /* primeiro uso */
  }
  cache = defaultStore();
  return cache;
}

async function saveStore(store: LifecycleStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  cache = store;
  await fs.mkdir(path.dirname(LIFECYCLE_FILE), { recursive: true });
  const tmp = `${LIFECYCLE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
  await fs.rename(tmp, LIFECYCLE_FILE);
}

function todayKeySp(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Semana 1: 70/dia por instância; +40% por semana; teto 150 (~semana 4). */
export const AQUECEDOR_DAILY_CAP_BASE = 70;
export const AQUECEDOR_DAILY_CAP_WEEKLY_GROWTH = 1.4;
export const AQUECEDOR_DAILY_CAP_CEILING = 150;

export function computeDailyCapForInstance(
  _instanceName: string,
  activatedAt: string | null,
): number {
  const activatedMs = activatedAt ? new Date(activatedAt).getTime() : Date.now();
  const weekIndex = Math.max(
    0,
    Math.floor((Date.now() - activatedMs) / (7 * 24 * 60 * 60 * 1000)),
  );
  const scaled = Math.round(
    AQUECEDOR_DAILY_CAP_BASE * AQUECEDOR_DAILY_CAP_WEEKLY_GROWTH ** weekIndex,
  );
  return Math.min(AQUECEDOR_DAILY_CAP_CEILING, scaled);
}

export function isLikelyWhatsAppRestriction(detail: string, httpStatus?: number): boolean {
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
  if (patterns.some((p) => d.includes(p))) return true;
  return httpStatus === 403;
}

function refreshRestrictionPhase(row: AquecedorInstanceLifecycleRow): void {
  if (row.phase !== "restricted_wait" || !row.restrictedUntil) return;
  if (Date.now() >= new Date(row.restrictedUntil).getTime()) {
    row.phase = row.activatedAt ? "active" : "preparing";
    row.restrictedUntil = null;
    row.restrictedReason = null;
    if (row.phase === "preparing" && !row.preparingSince) {
      row.preparingSince = new Date().toISOString();
    }
  }
}

function ensureDailyCap(row: AquecedorInstanceLifecycleRow, instanceName: string): void {
  const today = todayKeySp();
  if (row.dailyDate !== today) {
    row.dailyDate = today;
    row.dailySendCount = 0;
  }
  row.dailyCap = computeDailyCapForInstance(instanceName, row.activatedAt);
}

export async function getAquecedorLifecycleRow(
  instanceName: string,
): Promise<AquecedorInstanceLifecycleRow | null> {
  const found = await findAquecedorLifecycleRow(instanceName);
  if (!found) return null;
  refreshRestrictionPhase(found.row);
  return { ...found.row };
}

export async function removeAquecedorInstanceLifecycle(instanceName: string): Promise<void> {
  const aliasesMap = await loadAliasesMap();
  const keys = collectInstanceNameKeys(instanceName, aliasesMap);
  if (!keys.length) return;
  const store = await loadStore();
  let changed = false;
  for (const key of keys) {
    if (store.instances[key]) {
      delete store.instances[key];
      changed = true;
    }
  }
  if (changed) await saveStore(store);
}

export async function registerAquecedorInstancePreparing(
  instanceName: string,
  preparingSince?: string | null,
  options?: RegisterAquecedorPreparingOptions,
): Promise<void> {
  const name = String(instanceName || "").trim();
  if (!name) return;
  const store = await loadStore();
  const key = normalizeKey(name);
  const evoCreatedAt = await readEvoInstanceCreatedAt(name);
  const explicitSince = String(preparingSince || "").trim() || null;
  const forceNew = options?.forceNewIntegration === true;
  const integrationAt =
    explicitSince || evoCreatedAt || (forceNew ? new Date().toISOString() : null);

  const existing = await findAquecedorLifecycleRow(name);

  if (forceNew) {
    const since = integrationAt || new Date().toISOString();
    if (existing) {
      refreshRestrictionPhase(existing.row);
      applyPreparingPhase(existing.row, since);
      await saveStore(store);
      return;
    }
    store.instances[key] = emptyRow("preparing", since);
    await saveStore(store);
    return;
  }

  if (existing) {
    refreshRestrictionPhase(existing.row);
    if (existing.row.phase === "restricted_wait") return;
    if (existing.row.phase === "preparing") {
      if (!existing.row.preparingSince && integrationAt) {
        existing.row.preparingSince = integrationAt;
        await saveStore(store);
      }
      return;
    }
    if (maybeResetActiveToPreparing(existing.row, integrationAt || evoCreatedAt)) {
      await saveStore(store);
    }
    return;
  }

  // Sem row: sem data de integração → legado (grandfather). Com data pós-cutoff → Preparando.
  if (!integrationAt || isGrandfatherEligible(integrationAt)) {
    await grandfatherAquecedorInstanceActive(name);
    return;
  }
  store.instances[key] = emptyRow("preparing", integrationAt);
  await saveStore(store);
}

export async function grandfatherAquecedorInstanceActive(instanceName: string): Promise<void> {
  const name = String(instanceName || "").trim();
  if (!name) return;
  const store = await loadStore();
  const key = normalizeKey(name);
  if (store.instances[key]) return;
  const row = emptyRow("active");
  row.preparingSince = null;
  row.activatedAt = new Date().toISOString();
  store.instances[key] = row;
  await saveStore(store);
}

export async function markAquecedorInstanceRestricted(
  instanceName: string,
  detail: string,
): Promise<void> {
  const name = String(instanceName || "").trim();
  if (!name) return;
  const store = await loadStore();
  const key = normalizeKey(name);
  const row = store.instances[key] || emptyRow("active");
  const until = new Date(Date.now() + RESTRICTION_WAIT_MS).toISOString();
  row.phase = "restricted_wait";
  row.restrictedUntil = until;
  row.restrictedReason = String(detail || "Restrição temporária WhatsApp.").slice(0, 240);
  store.instances[key] = row;
  await saveStore(store);
  console.warn(
    `[Aquecedor] instância ${name} em espera de 6h por restrição: ${row.restrictedReason}`,
  );
}

export async function syncAquecedorPreparingPromotions(): Promise<string[]> {
  const store = await loadStore();
  const now = Date.now();
  const promoted: string[] = [];

  for (const [key, row] of Object.entries(store.instances)) {
    refreshRestrictionPhase(row);
    if (row.phase !== "preparing") continue;
    const preparingSinceMs = new Date(row.preparingSince || 0).getTime();
    if (!Number.isFinite(preparingSinceMs)) continue;
    if (now < preparingSinceMs + PREPARING_DURATION_MS) continue;

    row.phase = "active";
    row.activatedAt = new Date().toISOString();
    row.preparingSince = null;
    promoted.push(key);
  }

  if (promoted.length) await saveStore(store);
  return promoted;
}

export async function tickAquecedorStaggerPromotions(): Promise<string | null> {
  const promoted = await syncAquecedorPreparingPromotions();
  return promoted[0] ?? null;
}

/** Momento em que a instância sai de Preparando: integração + 6h (sem fila escalonada). */
export function computePreparingPromoteAtMs(row: AquecedorInstanceLifecycleRow): number {
  const preparingSinceMs = new Date(row.preparingSince || 0).getTime();
  if (!Number.isFinite(preparingSinceMs)) return Date.now() + PREPARING_DURATION_MS;
  return preparingSinceMs + PREPARING_DURATION_MS;
}

/** Instâncias em fase ativa (pós-Preparando) — elegíveis para aquecedor e disparo. */
export async function filterInstancesLifecycleReady(instanceNames: string[]): Promise<string[]> {
  await syncAquecedorPreparingPromotions();
  const store = await loadStore();
  const out: string[] = [];
  for (const rawName of instanceNames) {
    const name = String(rawName || "").trim();
    if (!name) continue;
    const found = await findAquecedorLifecycleRow(name);
    const row = found?.row;
    if (!row) {
      const createdAt = await readEvoInstanceCreatedAt(name);
      if (isGrandfatherEligible(createdAt)) out.push(name);
      continue;
    }
    refreshRestrictionPhase(row);
    if (row.phase === "active") out.push(name);
  }
  return out;
}

export function formatAquecedorLifecycleStatusLabel(
  row: AquecedorInstanceLifecycleRow | null,
): string | null {
  if (!row) return null;
  refreshRestrictionPhase(row);
  if (row.phase === "preparing") return "Preparando";
  if (row.phase === "restricted_wait" && row.restrictedUntil) {
    const remainingMs = new Date(row.restrictedUntil).getTime() - Date.now();
    if (remainingMs > 0) return "6 horas de espera";
    return null;
  }
  return null;
}

export async function getAquecedorLifecycleStatusMap(): Promise<
  Record<
    string,
    {
      phase: AquecedorInstancePhase;
      statusLabel: string | null;
      restrictedUntil: string | null;
      promoteAt: string | null;
    }
  >
> {
  await syncAquecedorPreparingPromotions();
  const store = await loadStore();
  let storeDirty = false;
  for (const [key, row] of Object.entries(store.instances)) {
    if (await reconcileGrandfatheredActiveRow(key, row)) storeDirty = true;
  }
  if (storeDirty) await saveStore(store);

  const out: Record<
    string,
    {
      phase: AquecedorInstancePhase;
      statusLabel: string | null;
      restrictedUntil: string | null;
      promoteAt: string | null;
    }
  > = {};
  for (const [key, row] of Object.entries(store.instances)) {
    refreshRestrictionPhase(row);
    let promoteAt: string | null = null;
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

export async function filterAquecedorCycleConnected<T extends { instancia: string }>(
  connected: T[],
): Promise<T[]> {
  await syncAquecedorPreparingPromotions();
  const store = await loadStore();
  const out: T[] = [];
  let storeDirty = false;
  for (const item of connected) {
    let found = await findAquecedorLifecycleRow(item.instancia);
    let row = found?.row;
    if (!row) {
      const createdAt = await readEvoInstanceCreatedAt(item.instancia);
      if (isGrandfatherEligible(createdAt)) {
        await grandfatherAquecedorInstanceActive(item.instancia);
        found = await findAquecedorLifecycleRow(item.instancia);
        row = found?.row;
      } else {
        await registerAquecedorInstancePreparing(item.instancia, createdAt);
        found = await findAquecedorLifecycleRow(item.instancia);
        row = found?.row;
      }
    } else if (await reconcileGrandfatheredActiveRow(item.instancia, row)) {
      storeDirty = true;
    }
    if (!row) continue;
    refreshRestrictionPhase(row);
    if (row.phase === "active") out.push(item);
  }
  if (storeDirty) await saveStore(store);
  return out;
}

/** Zera contadores diários ao virar o dia (SP) e persiste quando necessário. */
export async function refreshAquecedorDailyCapsIfNeeded(): Promise<void> {
  const store = await loadStore();
  let dirty = false;
  for (const [key, row] of Object.entries(store.instances)) {
    refreshRestrictionPhase(row);
    const beforeDate = row.dailyDate;
    const beforeCap = row.dailyCap;
    ensureDailyCap(row, key);
    if (beforeDate !== row.dailyDate || beforeCap !== row.dailyCap) dirty = true;
  }
  if (dirty) await saveStore(store);
}

export async function canAquecedorInstanceSendToday(instanceName: string): Promise<{
  ok: boolean;
  reason: string;
  dailyCap: number;
  dailyCount: number;
}> {
  const store = await loadStore();
  const found = await findAquecedorLifecycleRow(instanceName);
  const row = found?.row;
  if (!row) {
    return { ok: true, reason: "", dailyCap: AQUECEDOR_DAILY_CAP_BASE, dailyCount: 0 };
  }
  refreshRestrictionPhase(row);
  if (row.phase !== "active") {
    return {
      ok: false,
      reason:
        row.phase === "preparing"
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
  const cap = row.dailyCap ?? AQUECEDOR_DAILY_CAP_BASE;
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

export async function recordAquecedorInstanceDailySend(instanceName: string): Promise<void> {
  const name = String(instanceName || "").trim();
  if (!name) return;
  const store = await loadStore();
  const found = await findAquecedorLifecycleRow(name);
  const key = found?.key ?? normalizeKey(name);
  const row = found?.row ?? emptyRow("active");
  ensureDailyCap(row, name);
  row.dailySendCount += 1;
  store.instances[key] = row;
  await saveStore(store);
}

export async function detectAndMarkRestrictionFromSend(
  instanceName: string,
  status: number,
  body: string,
): Promise<boolean> {
  if (!isLikelyWhatsAppRestriction(body, status)) return false;
  await markAquecedorInstanceRestricted(instanceName, body.slice(0, 200));
  return true;
}
