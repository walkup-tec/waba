import { promises as fs } from "fs";
import { resolveDataFile } from "../data-path";
import { getAquecedorLifecycleRow } from "./aquecedor-instance-lifecycle.service";
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

async function loadExchangeStatsMap(
  supabase: SupabaseClient,
  instanceNames: string[]
): Promise<Map<string, { sends7d: number; receives7d: number }>> {
  const now = Date.now();
  if (now - statsCacheAt < STATS_CACHE_MS && statsCache.size > 0) {
    return statsCache;
  }
  const out = new Map<string, { sends7d: number; receives7d: number }>();
  for (const name of instanceNames) {
    const key = normalizeKey(name);
    out.set(key, { sends7d: 0, receives7d: 0 });
  }
  if (!instanceNames.length) return out;

  const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const allowed = new Set(instanceNames.map(normalizeKey));
  try {
    const { data, error } = await supabase
      .from("logs_envios")
      .select("instancia_origem, instancia_destino, data_envio")
      .gte("data_envio", since)
      .limit(5000);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const from = normalizeKey(String(row?.instancia_origem || ""));
        const to = normalizeKey(String(row?.instancia_destino || ""));
        if (allowed.has(from)) {
          const stats = out.get(from)!;
          stats.sends7d += 1;
        }
        if (allowed.has(to)) {
          const stats = out.get(to)!;
          stats.receives7d += 1;
        }
      }
    }
  } catch {
    /* Supabase opcional */
  }
  statsCacheAt = now;
  statsCache = out;
  return out;
}

export async function getInstanceWarmthInfo(
  instanceName: string,
  supabase: SupabaseClient | null
): Promise<InstanceWarmthInfo> {
  const overrides = await loadWarmthOverrides();
  const row = await getAquecedorLifecycleRow(instanceName);
  let exchangeStats: { sends7d?: number; receives7d?: number } | undefined;
  if (supabase) {
    const map = await loadExchangeStatsMap(supabase, [instanceName]);
    exchangeStats = map.get(normalizeKey(instanceName));
  }
  const computed = computeWarmthFromLifecycleRow(row, exchangeStats);
  return applyWarmthOverride(computed, overrides, instanceName);
}

export async function getAquecedorWarmthMapForInstances(
  instanceNames: string[],
  supabase: SupabaseClient | null
): Promise<Record<string, InstanceWarmthInfo>> {
  const overrides = await loadWarmthOverrides();
  const out: Record<string, InstanceWarmthInfo> = {};
  let exchangeMap = new Map<string, { sends7d: number; receives7d: number }>();
  if (supabase && instanceNames.length) {
    exchangeMap = await loadExchangeStatsMap(supabase, instanceNames);
  }
  await Promise.all(
    instanceNames.map(async (name) => {
      const key = normalizeKey(name);
      const row = await getAquecedorLifecycleRow(name);
      const computed = computeWarmthFromLifecycleRow(row, exchangeMap.get(key));
      out[key] = applyWarmthOverride(computed, overrides, name);
    })
  );
  return out;
}
