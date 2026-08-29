import { evoHttpRequestWithBaseFailover, resolvePrimaryEvoApiBase } from "../evo-api-config";
import { resolveEvoInstanceKey } from "./evo-instance-key";

const EVO_API_BASE = resolvePrimaryEvoApiBase();
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

export type EvoLiveStateDetail = {
  state: string;
  statusReason: number | null;
};

let liveStateCache = new Map<string, { state: string; statusReason: number | null; expiresAt: number }>();

export function isEvoLiveStateOpen(state: string): boolean {
  return String(state || "").trim().toLowerCase() === "open";
}

/**
 * Chip da campanha só é «ativo» com sessão utilizável (`open`).
 * `close` / `connecting` / probe vazio não contam como ativo — não dá para enviar.
 * Timeout (string vazia) o caller preserva o `fetchInstances` via `fallbackConnected`.
 */
export function campaignChipConnectedFromLiveState(liveState: string): boolean {
  return isEvoLiveStateOpen(liveState);
}

/** WhatsApp 403 = ban/restrição. Sessão EVO pode continuar `open` — o chip não pode ficar verde. */
export function pickEvoStatusReason(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const inst = (root.instance as Record<string, unknown> | undefined) ?? root;
  const candidates = [root.statusReason, inst.statusReason, root.code, inst.code];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return null;
}

export function isEvoWhatsAppRestrictedReason(statusReason: number | null | undefined): boolean {
  return Number(statusReason) === 403;
}

/**
 * Verde na campanha = conexão utilizável para disparo.
 * Ban (403) / outbound quebrado / bloqueio / tag Restrição vencem o `open` da Evolution.
 * Chip inapto entra na troca 1:1 para não ficar travado sem enviar.
 */
export function campaignChipConnectedForDispatch(input: {
  liveState: string;
  statusReason?: number | null;
  outboundBroken?: boolean;
  blocked?: boolean;
  restricted?: boolean;
  /** Só usado quando o probe live veio vazio (timeout). Não inventa verde em cima de `close`. */
  fallbackConnected?: boolean;
}): boolean {
  if (isEvoWhatsAppRestrictedReason(input.statusReason)) return false;
  if (input.outboundBroken === true) return false;
  if (input.blocked === true) return false;
  if (input.restricted === true) return false;
  const live = String(input.liveState || "").trim();
  if (!live) return input.fallbackConnected === true;
  return campaignChipConnectedFromLiveState(live);
}

export function runEvoConnectionStateSelfCheck(): void {
  if (campaignChipConnectedForDispatch({ liveState: "open", statusReason: 403 }) !== false) {
    throw new Error("403 tem de deixar o chip da campanha vermelho mesmo com EVO open");
  }
  if (campaignChipConnectedForDispatch({ liveState: "open", outboundBroken: true }) !== false) {
    throw new Error("outbound ERROR tem de deixar o chip vermelho");
  }
  if (campaignChipConnectedForDispatch({ liveState: "open", blocked: true }) !== false) {
    throw new Error("bloqueio de campanha tem de deixar o chip vermelho");
  }
  if (campaignChipConnectedForDispatch({ liveState: "open", restricted: true }) !== false) {
    throw new Error("tag Restrição tem de deixar o chip vermelho e apto à troca");
  }
  if (campaignChipConnectedForDispatch({ liveState: "open" }) !== true) {
    throw new Error("open sem 403 continua verde");
  }
  if (campaignChipConnectedForDispatch({ liveState: "" }) !== false) {
    throw new Error("probe vazio não pode pintar desconectado como ativo");
  }
  if (campaignChipConnectedForDispatch({ liveState: "", fallbackConnected: true }) !== true) {
    throw new Error("timeout com fetchInstances=open preserva ativo");
  }
  if (campaignChipConnectedForDispatch({ liveState: "", fallbackConnected: false }) !== false) {
    throw new Error("timeout com fetchInstances=close permanece desconectado");
  }
  if (campaignChipConnectedForDispatch({ liveState: "connecting" }) !== false) {
    throw new Error("connecting não é ativo na campanha");
  }
  if (campaignChipConnectedFromLiveState("close") !== false) {
    throw new Error("close continua vermelho");
  }
}

/**
 * fetchInstances já marcou a linha como open. Só descarta quando o
 * connectionState vier explícito e diferente de open (close/connecting).
 * Estado vazio (timeout/404) não é ghost.
 */
export function aquecedorLiveStateAllowsConnected(liveState: string): boolean {
  const state = String(liveState || "").trim().toLowerCase();
  if (!state) return true;
  return isEvoLiveStateOpen(state);
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

/**
 * Após proxy/set + restart a sessão pode piscar close/connecting antes de voltar open.
 * Não aborta no primeiro close — espera até open ou timeout.
 */
export async function waitForEvoInstanceLiveOpenLenient(
  instanceName: string,
  options?: { maxWaitMs?: number; pollMs?: number },
): Promise<{ open: boolean; state: string }> {
  const maxWaitMs = Math.max(10_000, Math.min(180_000, options?.maxWaitMs ?? 90_000));
  const pollMs = Math.max(500, Math.min(5_000, options?.pollMs ?? 1_500));
  const deadline = Date.now() + maxWaitMs;
  let lastState = "";

  while (Date.now() < deadline) {
    invalidateEvoLiveStateCache(instanceName);
    lastState = await fetchEvoInstanceLiveState(instanceName, { fresh: true });
    if (isEvoLiveStateOpen(lastState)) {
      return { open: true, state: lastState };
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

export async function fetchEvoInstanceLiveDetail(
  instanceName: string,
  options?: { fresh?: boolean },
): Promise<EvoLiveStateDetail> {
  const key = String(instanceName || "").trim().toLowerCase();
  if (!key) return { state: "", statusReason: null };

  if (!options?.fresh) {
    const cached = liveStateCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return { state: cached.state, statusReason: cached.statusReason };
    }
  }

  const enc = encodeURIComponent(String(instanceName || "").trim());
  const urls = [
    `${EVO_API_BASE}/instance/connectionState/${enc}`,
    `${EVO_API_BASE}/instance/connection-state/${enc}`,
  ];

  for (const url of urls) {
    const result = await evoHttpRequestWithBaseFailover(url, "GET", {
      apiKey: EVO_API_KEY,
      timeoutMs: 10_000,
      retries: 1,
    });
    if (!result.ok && result.status === 404) continue;
    const state = pickEvoConnectionState(result.json);
    const statusReason = pickEvoStatusReason(result.json);
    if (state || statusReason != null) {
      liveStateCache.set(key, {
        state,
        statusReason,
        expiresAt: Date.now() + LIVE_STATE_TTL_MS,
      });
      return { state, statusReason };
    }
  }
  return { state: "", statusReason: null };
}

export async function fetchEvoInstanceLiveState(
  instanceName: string,
  options?: { fresh?: boolean },
): Promise<string> {
  const detail = await fetchEvoInstanceLiveDetail(instanceName, options);
  return detail.state;
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
