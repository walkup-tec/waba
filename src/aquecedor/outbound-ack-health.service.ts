/**
 * Saúde de outbound EVO (MessageUpdate / findStatusMessage).
 * Instâncias "open" com ERROR recente no fromMe não aquecem ninguém.
 * Amostras velhas não expulsam: senão um QR reconectado fica fora para sempre.
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

/** Só conta fromMe nesta janela. Padrão 12h. */
export const AQUECEDOR_OUTBOUND_SAMPLE_MAX_AGE_MS = Math.max(
  10 * 60 * 1000,
  Number(process.env.AQUECEDOR_OUTBOUND_SAMPLE_MAX_AGE_MS ?? 12 * 60 * 60 * 1000) ||
    12 * 60 * 60 * 1000,
);

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

export function evoRecordTimestampMs(rec: unknown): number | null {
  if (!rec || typeof rec !== "object") return null;
  const obj = rec as Record<string, unknown>;
  const nested =
    obj.message && typeof obj.message === "object"
      ? (obj.message as Record<string, unknown>)
      : null;
  const raw = obj.messageTimestamp ?? nested?.messageTimestamp ?? obj.timestamp;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? n : n * 1000;
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

export function collectFromMeAckStatusesFromPayload(
  json: unknown,
  options?: { nowMs?: number; maxAgeMs?: number },
): EvoMessageAckStatus[] {
  const records =
    (json as { messages?: { records?: unknown[] } })?.messages?.records ||
    (json as { records?: unknown[] })?.records ||
    [];
  if (!Array.isArray(records)) return [];
  const nowMs = options?.nowMs ?? Date.now();
  const maxAgeMs = options?.maxAgeMs ?? AQUECEDOR_OUTBOUND_SAMPLE_MAX_AGE_MS;
  const out: EvoMessageAckStatus[] = [];
  for (const rec of records) {
    const ts = evoRecordTimestampMs(rec);
    if (ts != null && nowMs - ts > maxAgeMs) continue;
    out.push(extractEvoMessageAckStatus(rec));
  }
  return out;
}

export function evaluateOutboundSamplePayload(
  json: unknown,
  options?: { nowMs?: number; maxAgeMs?: number },
): {
  class: EvoOutboundHealthClass;
  sampleSize: number;
  errorCount: number;
  statuses: EvoMessageAckStatus[];
} {
  const statuses = collectFromMeAckStatusesFromPayload(json, options);
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
