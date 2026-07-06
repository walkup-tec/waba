import { evoHttpRequest } from "../evo-http.client";
import { resolveEvoInstanceKey } from "./evo-instance-key";

const EVO_API_BASE = String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080").replace(
  /\/$/,
  "",
);
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");

export type EvoLiveConnectionSnapshot = {
  instanceName: string;
  fetchStatus: string;
  liveState: string;
  trulyOpen: boolean;
};

const LIVE_STATE_TTL_MS = Math.max(
  2000,
  Math.min(120_000, Number(process.env.EVO_CONNECTION_STATE_CACHE_MS ?? 4_000) || 4_000),
);

let liveStateCache = new Map<string, { state: string; expiresAt: number }>();

export function isEvoLiveStateOpen(state: string): boolean {
  return String(state || "").trim().toLowerCase() === "open";
}

export function isEvoConnectionInProgress(state: string): boolean {
  const s = String(state || "").trim().toLowerCase();
  return s === "connecting" || s === "pairing" || s === "qrcode";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForEvoInstanceLiveOpen(
  instanceName: string,
  options?: { maxWaitMs?: number; pollMs?: number },
): Promise<{ open: boolean; state: string }> {
  const maxWaitMs = Math.max(5_000, Math.min(120_000, options?.maxWaitMs ?? 45_000));
  const pollMs = Math.max(300, Math.min(5_000, options?.pollMs ?? 600));
  const deadline = Date.now() + maxWaitMs;
  let lastState = "";

  while (Date.now() < deadline) {
    invalidateEvoLiveStateCache(instanceName);
    lastState = await fetchEvoInstanceLiveState(instanceName, { fresh: true });
    if (isEvoLiveStateOpen(lastState)) {
      return { open: true, state: lastState };
    }
    if (lastState === "close") {
      return { open: false, state: lastState };
    }
    await sleep(pollMs);
  }

  invalidateEvoLiveStateCache(instanceName);
  lastState = await fetchEvoInstanceLiveState(instanceName, { fresh: true });
  return { open: isEvoLiveStateOpen(lastState), state: lastState };
}

export function pickEvoConnectionState(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  const inst = (root.instance as Record<string, unknown> | undefined) ?? root;
  const raw =
    inst.state ??
    inst.connectionStatus ??
    inst.status ??
    root.state ??
    root.connectionStatus ??
    "";
  return String(raw || "").trim().toLowerCase();
}

export async function fetchEvoInstanceLiveState(
  instanceName: string,
  options?: { fresh?: boolean },
): Promise<string> {
  const key = String(instanceName || "").trim().toLowerCase();
  if (!key) return "";

  if (!options?.fresh) {
    const cached = liveStateCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.state;
    }
  }

  const enc = encodeURIComponent(String(instanceName || "").trim());
  const urls = [
    `${EVO_API_BASE}/instance/connectionState/${enc}`,
    `${EVO_API_BASE}/instance/connection-state/${enc}`,
  ];

  for (const url of urls) {
    const result = await evoHttpRequest(url, "GET", {
      apiKey: EVO_API_KEY,
      timeoutMs: 10_000,
      retries: 1,
    });
    if (!result.ok && result.status === 404) continue;
    const state = pickEvoConnectionState(result.json);
    if (state) {
      liveStateCache.set(key, { state, expiresAt: Date.now() + LIVE_STATE_TTL_MS });
      return state;
    }
  }
  return "";
}

export function invalidateEvoLiveStateCache(instanceName?: string): void {
  if (!instanceName) {
    liveStateCache.clear();
    return;
  }
  liveStateCache.delete(String(instanceName || "").trim().toLowerCase());
}

export async function resolveEvoLiveConnectionSnapshots(
  instances: unknown[],
): Promise<EvoLiveConnectionSnapshot[]> {
  const list = Array.isArray(instances) ? instances : [instances];
  const rows: EvoLiveConnectionSnapshot[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const inst = (item as Record<string, unknown>).instance ?? item;
    const instanceName = resolveEvoInstanceKey(inst);
    if (!instanceName) continue;
    const fetchStatus = String(
      (inst as Record<string, unknown>)?.connectionStatus ??
        (inst as Record<string, unknown>)?.status ??
        "",
    )
      .trim()
      .toLowerCase();
    const liveState = await fetchEvoInstanceLiveState(instanceName);
    rows.push({
      instanceName,
      fetchStatus,
      liveState,
      trulyOpen: isEvoLiveStateOpen(liveState),
    });
  }
  return rows;
}

export async function filterInstanceNamesTrulyOpen(instanceNames: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const name of instanceNames) {
    const state = await fetchEvoInstanceLiveState(name);
    if (isEvoLiveStateOpen(state)) out.push(name);
  }
  return out;
}

export function describeEvoConnectionMismatch(
  snapshots: EvoLiveConnectionSnapshot[],
): string {
  const ghostOpen = snapshots.filter((row) => row.fetchStatus.includes("open") && !row.trulyOpen);
  if (!ghostOpen.length) return "";
  const sample = ghostOpen
    .slice(0, 6)
    .map((row) => `${row.instanceName} (fetch=${row.fetchStatus || "?"}, live=${row.liveState || "?"})`)
    .join("; ");
  return `O sistema WABA - Drax reporta instâncias como conectadas no fetchInstances, mas connectionState não está open: ${sample}. Reconecte o WhatsApp (QR) ou reinicie o sistema WABA - Drax.`;
}
