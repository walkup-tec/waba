import { evoHttpRequest } from "../evo-http.client";
import {
  evoHttpRequestWithBaseFailover,
  resolveEvoApiBaseCandidates,
  resolvePrimaryEvoApiBase,
} from "../evo-api-config";
import { invalidateEvoLiveStateCache } from "../instances/evo-connection-state.service";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

export function isEvoSendInternalDbError(detail: string, status: number): boolean {
  const text = String(detail || "").toLowerCase();
  if (status >= 500) {
    return (
      text.includes("integrationsession") ||
      text.includes("prisma") ||
      text.includes("prismaclient") ||
      text.includes("internal server error")
    );
  }
  return false;
}

export function isEvoSendTransientError(detail: string, status: number): boolean {
  if (status === 0 || status === 429 || (status >= 500 && status <= 504)) return true;
  const text = String(detail || "").toLowerCase();
  return (
    text.includes("connection closed") ||
    text.includes("timeout") ||
    text.includes("econnreset") ||
    text.includes("socket hang up") ||
    text.includes("integrationsession") ||
    text.includes("prisma") ||
    text.includes("internal server error")
  );
}

export function extractEvoInstanceFromSendTextUrl(url: string): string {
  const match = String(url || "").match(/\/sendText\/([^/?#]+)/i);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return String(match[1]).trim();
  }
}

/** Reinicia sessão WhatsApp na Evolution sem logout (preserva pareamento). */
export async function restartEvoInstanceLight(
  instanceName: string,
  apiKey: string,
): Promise<boolean> {
  const name = String(instanceName || "").trim();
  if (!name) return false;

  const enc = encodeURIComponent(name);
  const bases = resolveEvoApiBaseCandidates();

  for (const base of bases) {
    const url = `${base}/instance/restart/${enc}`;
    const result = await evoHttpRequest(url, "POST", {
      apiKey,
      timeoutMs: 20_000,
      retries: 1,
    });
    if (result.ok || (result.status >= 200 && result.status < 300)) {
      invalidateEvoLiveStateCache(name);
      console.warn(`[evo] restart leve OK: ${name} via ${base}`);
      return true;
    }
  }

  console.warn(`[evo] restart leve falhou para ${name}`);
  return false;
}

export async function recoverEvoSendTextAfterFailure(input: {
  url: string;
  body: Record<string, unknown>;
  apiKey: string;
  timeoutMs: number;
  status: number;
  detail: string;
}): Promise<{ ok: boolean; status: number; body: string; json: unknown | null; error?: string }> {
  const instanceName = extractEvoInstanceFromSendTextUrl(input.url);
  if (!instanceName) {
    return { ok: false, status: input.status, body: input.detail, json: null };
  }

  if (!isEvoSendInternalDbError(input.detail, input.status)) {
    return { ok: false, status: input.status, body: input.detail, json: null };
  }

  console.warn(
    `[evo] sendText HTTP ${input.status} (${instanceName}) — tentando restart + reenvio único.`,
  );
  const restarted = await restartEvoInstanceLight(instanceName, input.apiKey);
  if (!restarted) {
    return { ok: false, status: input.status, body: input.detail, json: null };
  }

  await sleep(4_000);
  invalidateEvoLiveStateCache(instanceName);

  const retry = await evoHttpRequestWithBaseFailover(input.url, "POST", {
    apiKey: input.apiKey,
    body: input.body,
    timeoutMs: input.timeoutMs,
    retries: 2,
  });

  const mergedBody = retry.error
    ? [retry.error, retry.body].filter(Boolean).join(" | ")
    : retry.body;

  return {
    ok: retry.ok,
    status: retry.status,
    body: mergedBody,
    json: retry.json,
    error: retry.error,
  };
}

export function resolveEvoInstancesUrl(): string {
  const base = resolvePrimaryEvoApiBase();
  return (
    String(process.env.EVO_INSTANCES_URL || "").trim() ||
    `${base}/instance/fetchInstances`
  );
}
