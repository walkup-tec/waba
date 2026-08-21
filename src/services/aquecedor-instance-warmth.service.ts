import { promises as fs } from "fs";
import { resolveDataFile } from "../data-path";
import {
  aquecedorChipKeyFromNumber,
} from "../aquecedor/aquecedor-chip-identity";
import {
  getAquecedorLifecycleRow,
  restoreAquecedorLifecyclesFromHistoryBatch,
} from "./aquecedor-instance-lifecycle.service";
import type { SupabaseClient } from "@supabase/supabase-js";

const WARMTH_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: "Não aquecido",
  1: "Pouco aquecido",
  2: "Aquecimento médio",
  3: "Totalmente aquecido",
};

const STATS_CACHE_MS = 45000;
const WARMTH_OVERRIDE_FILE = resolveDataFile("aquecedor-instance-warmth-overrides.json");
const EVO_INSTANCES_CACHE_FILE = resolveDataFile("evo-instances-cache.json");
const INSTANCE_ALIASES_FILE = resolveDataFile("instance-aliases.json");

type ExchangeStats = {
  sends7d: number;
  receives7d: number;
  sendsLifetime: number;
  receivesLifetime: number;
};

let statsCacheAt = 0;
let statsCache = new Map<string, ExchangeStats>();
let warmthOverrideCache: Map<string, number> | null = null;
let warmthOverrideCacheAt = 0;

export type InstanceWarmthInfo = {
  level: 0 | 1 | 2 | 3;
  label: string;
  ageDays: number;
  avgDailySends: number;
  replyRate: number;
};

type WarmthComputeParams = {
  phase: string | null;
  activatedAt: string | null;
  ageDays: number;
  avgDailySends: number;
  replyRate: number;
  sends7d: number;
  receives7d: number;
  lifetimeSent: number;
  lifetimeRecv: number;
};

function normalizeKey(instanceName: string): string {
  return String(instanceName || "").trim().toLowerCase();
}

function pickEarlierIso(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left) return right || null;
  if (!right) return left || null;
  return left < right ? left : right;
}

async function loadWarmthOverrides(): Promise<Map<string, number>> {
  const now = Date.now();
  if (warmthOverrideCache && now - warmthOverrideCacheAt < 5000) {
    return warmthOverrideCache;
  }
  const map = new Map<string, number>();
  try {
    const raw = await fs.readFile(WARMTH_OVERRIDE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { instances?: Record<string, unknown> };
    for (const [key, levelRaw] of Object.entries(parsed?.instances || {})) {
      const level = Math.max(0, Math.min(3, Number(levelRaw) || 0)) as 0 | 1 | 2 | 3;
      map.set(normalizeKey(key), level);
    }
  } catch {
    /* arquivo opcional de teste */
  }
  warmthOverrideCache = map;
  warmthOverrideCacheAt = now;
  return map;
}

function applyWarmthOverride(
  info: InstanceWarmthInfo,
  overrides: Map<string, number>,
  instanceKey: string,
): InstanceWarmthInfo {
  const override = overrides.get(normalizeKey(instanceKey));
  if (override == null) return info;
  const level = Math.max(0, Math.min(3, override)) as 0 | 1 | 2 | 3;
  return {
    ...info,
    level,
    label: WARMTH_LABELS[level],
  };
}

function ageDaysSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function hasDailyConversations(sends7d: number, receives7d: number): boolean {
  if (receives7d < 1) return false;
  const daysWithActivity = Math.min(7, Math.max(1, Math.ceil(sends7d / 8)));
  return receives7d >= daysWithActivity;
}

function frequentReplies(replyRate: number, receives7d: number): boolean {
  return replyRate >= 0.45 && receives7d >= 5;
}

/**
 * Nível de aquecimento por chip.
 * - Sem teto superior de média diária (volume alto não zera foguinho).
 * - Pisos por volume vitalício do chip (histórico de renomes conta).
 */
export function computeInstanceWarmthLevel(params: WarmthComputeParams): InstanceWarmthInfo {
  const {
    phase,
    activatedAt,
    ageDays,
    avgDailySends,
    replyRate,
    sends7d,
    receives7d,
    lifetimeSent,
    lifetimeRecv,
  } = params;
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

  let level: 0 | 1 | 2 | 3 = 0;

  if (ageDays >= 1 && avgDailySends >= 20 && replyRate >= 0.3) {
    level = 1;
  }
  if (ageDays >= 8 && avgDailySends >= 50 && hasDailyConversations(sends7d, receives7d)) {
    level = 2;
  }
  if (ageDays >= 16 && avgDailySends >= 150 && frequentReplies(replyRate, receives7d)) {
    level = 3;
  } else if (ageDays > 30 && avgDailySends >= 150 && frequentReplies(replyRate, receives7d)) {
    level = 3;
  } else if (ageDays > 15 && level < 2 && avgDailySends >= 50 && hasDailyConversations(sends7d, receives7d)) {
    level = 2;
  } else if (ageDays > 7 && level < 1 && avgDailySends >= 20 && replyRate >= 0.3) {
    level = 1;
  }

  // Pisos pelo histórico real do chip (não só janela de 7 dias / rename recente).
  if (lifetimeSent >= 150 && ageDays >= 5 && (replyRate >= 0.25 || lifetimeRecv >= 100)) {
    level = Math.max(level, 1) as 0 | 1 | 2 | 3;
  }
  if (
    lifetimeSent >= 300 &&
    ageDays >= 14 &&
    (replyRate >= 0.3 || receives7d >= 5 || lifetimeRecv >= 250)
  ) {
    level = Math.max(level, 2) as 0 | 1 | 2 | 3;
  }
  if (lifetimeSent >= 700 && ageDays >= 30 && (replyRate >= 0.4 || lifetimeRecv >= 500)) {
    level = Math.max(level, 3) as 0 | 1 | 2 | 3;
  }

  return {
    level,
    label: WARMTH_LABELS[level],
    ageDays,
    avgDailySends: Math.round(avgDailySends * 10) / 10,
    replyRate: Math.round(replyRate * 100) / 100,
  };
}

export function computeWarmthFromLifecycleRow(
  row: { phase?: string | null; activatedAt?: string | null; dailySendCount?: number } | null,
  exchangeStats?: Partial<ExchangeStats>,
  earliestActivityAt?: string | null,
): InstanceWarmthInfo {
  const activatedAt = pickEarlierIso(row?.activatedAt ?? null, earliestActivityAt ?? null);
  const ageDays = ageDaysSince(activatedAt);
  const sends7d = exchangeStats?.sends7d ?? row?.dailySendCount ?? 0;
  const receives7d = exchangeStats?.receives7d ?? 0;
  const lifetimeSent = exchangeStats?.sendsLifetime ?? sends7d;
  const lifetimeRecv = exchangeStats?.receivesLifetime ?? receives7d;
  const avgRecent = ageDays > 0 ? sends7d / Math.min(7, Math.max(1, ageDays)) : sends7d;
  const avgLifetime = ageDays > 0 ? lifetimeSent / Math.max(1, ageDays) : lifetimeSent;
  const avgDailySends = Math.max(avgRecent, avgLifetime);
  const replyRate =
    sends7d > 0 ? receives7d / sends7d : lifetimeSent > 0 ? lifetimeRecv / lifetimeSent : 0;
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

function numericTokenFromInstanceName(name: string): string {
  const digits = String(name || "").replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return digits;
}

async function loadInstanceAliasesFile(): Promise<Map<string, string>> {
  try {
    const raw = await fs.readFile(INSTANCE_ALIASES_FILE, "utf-8");
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
    const map = new Map<string, string>();
    for (const [key, value] of Object.entries(parsed || {})) {
      const k = String(key || "").trim();
      const v = String(value || "").trim();
      if (k && v) map.set(normalizeKey(k), v);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function loadEvoCacheNameToChip(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const raw = await fs.readFile(EVO_INSTANCES_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw || "{}") as { items?: Array<{ name?: string; number?: string }> };
    for (const item of Array.isArray(parsed?.items) ? parsed.items : []) {
      const name = normalizeKey(String(item?.name || ""));
      const chip = aquecedorChipKeyFromNumber(String(item?.number || ""));
      if (name && chip) map.set(name, chip);
    }
  } catch {
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
async function loadChipAliasMap(
  supabase: SupabaseClient,
  instanceNames: string[],
): Promise<Map<string, string[]>> {
  const requested = Array.from(new Set(instanceNames.map(normalizeKey).filter(Boolean)));
  const result = new Map<string, string[]>();
  for (const key of requested) result.set(key, [key]);
  if (!requested.length) return result;

  const chipToNames = new Map<string, Set<string>>();
  const nameToChip = new Map<string, string>();

  const addNameChip = (rawName: string, rawNumber: string) => {
    const name = normalizeKey(rawName);
    const chip = aquecedorChipKeyFromNumber(rawNumber);
    if (!name || !chip) return;
    nameToChip.set(name, chip);
    let set = chipToNames.get(chip);
    if (!set) {
      set = new Set<string>();
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
  } catch {
    /* opcional */
  }

  const evoMap = await loadEvoCacheNameToChip();
  for (const [name, chip] of evoMap.entries()) {
    nameToChip.set(name, chip);
    let set = chipToNames.get(chip);
    if (!set) {
      set = new Set<string>();
      chipToNames.set(chip, set);
    }
    set.add(name);
  }

  const aliasesFile = await loadInstanceAliasesFile();
  for (const [technical, alias] of aliasesFile.entries()) {
    const techChip = nameToChip.get(normalizeKey(technical));
    const aliasChip = nameToChip.get(normalizeKey(alias));
    const chip = techChip || aliasChip;
    if (!chip) continue;
    for (const n of [technical, alias]) {
      const key = normalizeKey(n);
      nameToChip.set(key, chip);
      let set = chipToNames.get(chip);
      if (!set) {
        set = new Set<string>();
        chipToNames.set(chip, set);
      }
      set.add(key);
    }
  }

  // Descoberta de renomes históricos órfãos (fora do controle) pelo token do nome.
  for (const key of requested) {
    const chip = nameToChip.get(key);
    if (!chip) continue;
    const token = numericTokenFromInstanceName(key);
    if (token.length < 4) continue;
    try {
      const { data } = await supabase
        .from("logs_envios")
        .select("instancia_origem, instancia_destino")
        .or(`instancia_origem.ilike.%${token}%,instancia_destino.ilike.%${token}%`)
        .limit(2000);
      for (const row of Array.isArray(data) ? data : []) {
        for (const raw of [row?.instancia_origem, row?.instancia_destino]) {
          const name = normalizeKey(String(raw || ""));
          if (!name || !name.includes(token)) continue;
          const mapped = nameToChip.get(name);
          if (mapped && mapped !== chip) continue; // outro chip (ex.: nome "2477" no chip 6973)
          let set = chipToNames.get(chip);
          if (!set) {
            set = new Set<string>();
            chipToNames.set(chip, set);
          }
          set.add(name);
          if (!mapped) nameToChip.set(name, chip);
        }
      }
    } catch {
      /* opcional */
    }
  }

  for (const key of requested) {
    const chip = nameToChip.get(key);
    if (!chip) continue;
    const group = chipToNames.get(chip);
    if (!group?.size) continue;
    result.set(key, Array.from(group));
  }
  return result;
}

function expandAliasNames(aliasMap: Map<string, string[]>): string[] {
  const all = new Set<string>();
  for (const names of aliasMap.values()) {
    for (const n of names) all.add(normalizeKey(n));
  }
  return Array.from(all);
}

function foldStatsToCanonical(
  aliasMap: Map<string, string[]>,
  raw: Map<string, ExchangeStats>,
): Map<string, ExchangeStats> {
  const out = new Map<string, ExchangeStats>();
  for (const [canonical, aliases] of aliasMap) {
    const stats: ExchangeStats = {
      sends7d: 0,
      receives7d: 0,
      sendsLifetime: 0,
      receivesLifetime: 0,
    };
    for (const alias of aliases) {
      const row = raw.get(normalizeKey(alias));
      if (!row) continue;
      stats.sends7d += row.sends7d;
      stats.receives7d += row.receives7d;
      stats.sendsLifetime += row.sendsLifetime;
      stats.receivesLifetime += row.receivesLifetime;
    }
    out.set(canonical, stats);
  }
  return out;
}

async function pickLifecycleFromAliases(
  names: string[],
): Promise<Awaited<ReturnType<typeof getAquecedorLifecycleRow>>> {
  const rows = (
    await Promise.all(names.map((name) => getAquecedorLifecycleRow(name)))
  ).filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (!rows.length) return null;
  const active = rows.filter((row) => row.phase === "active" && row.activatedAt);
  const pool = active.length ? active : rows;
  return pool.reduce((best, row) => {
    if (!best?.activatedAt) return row;
    if (!row.activatedAt) return best;
    return row.activatedAt < best.activatedAt ? row : best;
  });
}

function foldEarliestToCanonical(
  aliasMap: Map<string, string[]>,
  raw: Map<string, string>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const [canonical, aliases] of aliasMap) {
    let best: string | null = null;
    for (const alias of aliases) {
      const at = raw.get(normalizeKey(alias));
      if (!at) continue;
      if (!best || at < best) best = at;
    }
    if (best) out.set(canonical, best);
  }
  return out;
}

async function countLogsForName(
  supabase: SupabaseClient,
  name: string,
  column: "instancia_origem" | "instancia_destino",
  sinceIso?: string,
): Promise<number> {
  try {
    let query = supabase
      .from("logs_envios")
      .select("id", { count: "exact", head: true })
      .eq(column, name);
    if (sinceIso) query = query.gte("data_envio", sinceIso);
    const { count, error } = await query;
    if (error || count == null) return 0;
    return Number(count) || 0;
  } catch {
    return 0;
  }
}

async function loadExchangeStatsMap(
  supabase: SupabaseClient,
  instanceNames: string[],
): Promise<Map<string, ExchangeStats>> {
  const keys = Array.from(new Set(instanceNames.map(normalizeKey).filter(Boolean)));
  const now = Date.now();
  const cacheHit =
    now - statsCacheAt < STATS_CACHE_MS &&
    statsCache.size > 0 &&
    keys.every((k) => statsCache.has(k));
  if (cacheHit) {
    const hit = new Map<string, ExchangeStats>();
    for (const k of keys) hit.set(k, statsCache.get(k)!);
    return hit;
  }

  const out = new Map<string, ExchangeStats>();
  for (const key of keys) {
    out.set(key, { sends7d: 0, receives7d: 0, sendsLifetime: 0, receivesLifetime: 0 });
  }
  if (!keys.length) return out;

  const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const concurrency = 4;
  for (let i = 0; i < keys.length; i += concurrency) {
    const chunk = keys.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (name) => {
        const [sendsLifetime, receivesLifetime, sends7d, receives7d] = await Promise.all([
          countLogsForName(supabase, name, "instancia_origem"),
          countLogsForName(supabase, name, "instancia_destino"),
          countLogsForName(supabase, name, "instancia_origem", since),
          countLogsForName(supabase, name, "instancia_destino", since),
        ]);
        out.set(name, { sendsLifetime, receivesLifetime, sends7d, receives7d });
      }),
    );
  }

  statsCacheAt = now;
  statsCache = new Map(out);
  return out;
}

/** Primeira data_envio por instância (origem ou destino) — restaura aquecimento após recreate. */
async function loadEarliestActivityMap(
  supabase: SupabaseClient,
  instanceNames: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const keys = Array.from(new Set(instanceNames.map(normalizeKey).filter(Boolean)));
  if (!keys.length) return out;

  const concurrency = 6;
  for (let i = 0; i < keys.length; i += concurrency) {
    const chunk = keys.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (name) => {
        try {
          const { data, error } = await supabase
            .from("logs_envios")
            .select("data_envio")
            .or(`instancia_origem.eq.${name},instancia_destino.eq.${name}`)
            .order("data_envio", { ascending: true })
            .limit(1);
          if (error || !Array.isArray(data) || !data[0]?.data_envio) return;
          out.set(name, String(data[0].data_envio));
        } catch {
          /* opcional */
        }
      }),
    );
  }
  return out;
}

export async function getInstanceWarmthInfo(
  instanceName: string,
  supabase: SupabaseClient | null,
): Promise<InstanceWarmthInfo> {
  const map = await getAquecedorWarmthMapForInstances([instanceName], supabase);
  return (
    map[normalizeKey(instanceName)] || {
      level: 0,
      label: WARMTH_LABELS[0],
      ageDays: 0,
      avgDailySends: 0,
      replyRate: 0,
    }
  );
}

export async function getAquecedorWarmthMapForInstances(
  instanceNames: string[],
  supabase: SupabaseClient | null,
): Promise<Record<string, InstanceWarmthInfo>> {
  const overrides = await loadWarmthOverrides();
  const out: Record<string, InstanceWarmthInfo> = {};
  const requested = Array.from(
    new Set(instanceNames.map((n) => String(n || "").trim()).filter(Boolean)),
  );
  let exchangeMap = new Map<string, ExchangeStats>();
  let earliestMap = new Map<string, string>();
  let aliasMap = new Map<string, string[]>();

  if (supabase && requested.length) {
    aliasMap = await loadChipAliasMap(supabase, requested);
    const expanded = expandAliasNames(aliasMap);
    const [rawExchange, rawEarliest] = await Promise.all([
      loadExchangeStatsMap(supabase, expanded),
      loadEarliestActivityMap(supabase, expanded),
    ]);
    exchangeMap = foldStatsToCanonical(aliasMap, rawExchange);
    earliestMap = foldEarliestToCanonical(aliasMap, rawEarliest);
    await restoreAquecedorLifecyclesFromHistoryBatch(
      requested.map((name) => ({
        instanceName: name,
        earliestActivityAt: earliestMap.get(normalizeKey(name)) || null,
      })),
    );
  }

  await Promise.all(
    requested.map(async (name) => {
      const key = normalizeKey(name);
      const aliases = aliasMap.get(key) || [key];
      const row = await pickLifecycleFromAliases(aliases);
      const computed = computeWarmthFromLifecycleRow(
        row,
        exchangeMap.get(key),
        earliestMap.get(key) || null,
      );
      out[key] = applyWarmthOverride(computed, overrides, name);
    }),
  );
  return out;
}
