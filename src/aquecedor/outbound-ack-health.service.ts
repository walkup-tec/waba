/**
 * Saúde de outbound EVO (MessageUpdate / findStatusMessage).
 * Instâncias "open" com 100% ERROR no fromMe não aquecem ninguém.
 */
import {
  classifyEvoOutboundSample,
  extractEvoMessageAckStatus,
  isEvoAckFailure,
  isEvoAckProgressed,
  type EvoMessageAckStatus,
  type EvoOutboundHealthClass,
  normalizeEvoMessageAckStatus,
} from "./delivery-verify.helpers";

type CacheEntry = {
  class: EvoOutboundHealthClass;
  checkedAtMs: number;
  sampleSize: number;
  errorCount: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase();
}

export function clearAquecedorOutboundHealthCache(): void {
  cache.clear();
}

export function getCachedAquecedorOutboundHealth(
  instanceName: string,
): CacheEntry | null {
  const key = cacheKey(instanceName);
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() - row.checkedAtMs > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return row;
}

export function rememberAquecedorOutboundHealth(
  instanceName: string,
  health: EvoOutboundHealthClass,
  meta?: { sampleSize?: number; errorCount?: number },
): void {
  const key = cacheKey(instanceName);
  if (!key) return;
  cache.set(key, {
    class: health,
    checkedAtMs: Date.now(),
    sampleSize: meta?.sampleSize ?? 0,
    errorCount: meta?.errorCount ?? 0,
  });
}

export function collectFromMeAckStatusesFromPayload(json: unknown): EvoMessageAckStatus[] {
  const records =
    (json as { messages?: { records?: unknown[] } })?.messages?.records ||
    (json as { records?: unknown[] })?.records ||
    [];
  if (!Array.isArray(records)) return [];
  return records.map((rec) => extractEvoMessageAckStatus(rec));
}

export function evaluateOutboundSamplePayload(json: unknown): {
  class: EvoOutboundHealthClass;
  sampleSize: number;
  errorCount: number;
  statuses: EvoMessageAckStatus[];
} {
  const statuses = collectFromMeAckStatusesFromPayload(json);
  const errorCount = statuses.filter((s) => isEvoAckFailure(s)).length;
  return {
    class: classifyEvoOutboundSample(statuses, { minSamples: 3 }),
    sampleSize: statuses.length,
    errorCount,
    statuses,
  };
}

export {
  extractEvoMessageAckStatus,
  isEvoAckFailure,
  isEvoAckProgressed,
  normalizeEvoMessageAckStatus,
  classifyEvoOutboundSample,
};
