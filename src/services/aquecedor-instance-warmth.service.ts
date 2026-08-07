import { promises as fs } from "fs";
import { resolveDataFile } from "../data-path";
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

let statsCacheAt = 0;
let statsCache = new Map<string, { sends7d: number; receives7d: number }>();
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
};

function normalizeKey(instanceName: string): string {
  return String(instanceName || "").trim().toLowerCase();
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
  instanceKey: string
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

export function computeInstanceWarmthLevel(params: WarmthComputeParams): InstanceWarmthInfo {
  const { phase, activatedAt, ageDays, avgDailySends, replyRate, sends7d, receives7d } = params;
  if (phase === "preparing" || phase === "restricted_wait" || !activatedAt || ageDays < 1) {
    return {
      level: 0,
      label: WARMTH_LABELS[0],
      ageDays,
      avgDailySends,
      replyRate,
    };
  }

  let level: 0 | 1 | 2 | 3 = 0;
  if (
    ageDays >= 1 &&
    ageDays <= 7 &&
    avgDailySends >= 20 &&
    avgDailySends <= 50 &&
    replyRate >= 0.3
  ) {
    level = 1;
  }
  if (
    ageDays >= 8 &&
    ageDays <= 15 &&
    avgDailySends >= 50 &&
    avgDailySends <= 150 &&
    hasDailyConversations(sends7d, receives7d)
  ) {
    level = 2;
  }
  if (
    ageDays >= 16 &&
    avgDailySends >= 150 &&
    avgDailySends <= 300 &&
    frequentReplies(replyRate, receives7d)
  ) {
    level = 3;
  } else if (ageDays > 30 && avgDailySends >= 150 && frequentReplies(replyRate, receives7d)) {
    level = 3;
  } else if (ageDays > 15 && level < 2 && avgDailySends >= 50 && hasDailyConversations(sends7d, receives7d)) {
    level = 2;
  } else if (ageDays > 7 && level < 1 && avgDailySends >= 20 && replyRate >= 0.3) {
    level = 1;
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
  exchangeStats?: { sends7d?: number; receives7d?: number }
): InstanceWarmthInfo {
  const activatedAt = row?.activatedAt ?? null;
  const ageDays = ageDaysSince(activatedAt);
  const sends7d = exchangeStats?.sends7d ?? row?.dailySendCount ?? 0;
  const receives7d = exchangeStats?.receives7d ?? 0;
  const avgDailySends = ageDays > 0 ? sends7d / Math.min(7, ageDays) : sends7d;
  const replyRate = sends7d > 0 ? receives7d / sends7d : 0;
  return computeInstanceWarmthLevel({
    phase: row?.phase ?? null,
    activatedAt,
    ageDays,
    avgDailySends,
    replyRate,
    sends7d,
    receives7d,
  });
}

function phoneTail(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length >= 12) return d.slice(-11);
  if (d.length >= 10) return d.slice(-11);
  return d;
}

/**
 * Agrupa nomes técnicos que compartilham o mesmo WhatsApp (controle_instancia).
 * Ex.: 6635 ← 6035, 51981076635.
 */
async function loadCanonicalAliasMap(
  supabase: SupabaseClient,
  instanceNames: string[],
): Promise<Map<string, string[]>> {
  const requested = Array.from(
    new Set(instanceNames.map(normalizeKey).filter(Boolean)),
  );
  const result = new Map<string, string[]>();
  for (const key of requested) result.set(key, [key]);
  if (!requested.length) return result;

  try {
    const { data, error } = await supabase
      .from("controle_instancia")
      .select("instancia, numero_whatsapp")
      .limit(5000);
    if (error || !Array.isArray(data)) return result;

    const phoneToNames = new Map<string, Set<string>>();
    const nameToPhone = new Map<string, string>();
    for (const row of data) {
      const name = normalizeKey(String(row?.instancia || ""));
      const phone = phoneTail(String(row?.numero_whatsapp || ""));
      if (!name || phone.length < 8) continue;
      nameToPhone.set(name, phone);
      let set = phoneToNames.get(phone);
      if (!set) {
        set = new Set<string>();
        phoneToNames.set(phone, set);
      }
      set.add(name);
    }

    for (const key of requested) {
      const phone = nameToPhone.get(key);
      if (!phone) continue;
      const group = phoneToNames.get(phone);
      if (!group?.size) continue;
      result.set(key, Array.from(group));
    }
  } catch {
    /* opcional */
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
  raw: Map<string, { sends7d: number; receives7d: number }>,
): Map<string, { sends7d: number; receives7d: number }> {
  const out = new Map<string, { sends7d: number; receives7d: number }>();
  for (const [canonical, aliases] of aliasMap) {
    let sends7d = 0;
    let receives7d = 0;
    for (const alias of aliases) {
      const row = raw.get(normalizeKey(alias));
      if (!row) continue;
      sends7d += row.sends7d;
      receives7d += row.receives7d;
    }
    out.set(canonical, { sends7d, receives7d });
  }
  return out;
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

async function loadExchangeStatsMap(
  supabase: SupabaseClient,
  instanceNames: string[]
): Promise<Map<string, { sends7d: number; receives7d: number }>> {
  const keys = Array.from(new Set(instanceNames.map(normalizeKey).filter(Boolean)));
  const now = Date.now();
  const cacheHit =
    now - statsCacheAt < STATS_CACHE_MS &&
    statsCache.size > 0 &&
    keys.every((k) => statsCache.has(k));
  if (cacheHit) {
    const hit = new Map<string, { sends7d: number; receives7d: number }>();
    for (const k of keys) hit.set(k, statsCache.get(k)!);
    return hit;
  }

  const out = new Map<string, { sends7d: number; receives7d: number }>();
  for (const key of keys) out.set(key, { sends7d: 0, receives7d: 0 });
  if (!keys.length) return out;

  const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Contagem por instância (evita perder nomes no limite global de 8000 rows).
  const concurrency = 6;
  for (let i = 0; i < keys.length; i += concurrency) {
    const chunk = keys.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (name) => {
        try {
          const { data, error } = await supabase
            .from("logs_envios")
            .select("instancia_origem, instancia_destino")
            .or(`instancia_origem.eq.${name},instancia_destino.eq.${name}`)
            .gte("data_envio", since)
            .limit(5000);
          if (error || !Array.isArray(data)) return;
          const stats = out.get(name)!;
          for (const row of data) {
            if (normalizeKey(String(row?.instancia_origem || "")) === name) stats.sends7d += 1;
            if (normalizeKey(String(row?.instancia_destino || "")) === name) stats.receives7d += 1;
          }
        } catch {
          /* opcional */
        }
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
  instanceNames: string[]
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
  supabase: SupabaseClient | null
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
  supabase: SupabaseClient | null
): Promise<Record<string, InstanceWarmthInfo>> {
  const overrides = await loadWarmthOverrides();
  const out: Record<string, InstanceWarmthInfo> = {};
  const requested = Array.from(
    new Set(instanceNames.map((n) => String(n || "").trim()).filter(Boolean)),
  );
  let exchangeMap = new Map<string, { sends7d: number; receives7d: number }>();
  let earliestMap = new Map<string, string>();

  if (supabase && requested.length) {
    const aliasMap = await loadCanonicalAliasMap(supabase, requested);
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
      const row = await getAquecedorLifecycleRow(name);
      const computed = computeWarmthFromLifecycleRow(row, exchangeMap.get(key));
      out[key] = applyWarmthOverride(computed, overrides, name);
    }),
  );
  return out;
}
