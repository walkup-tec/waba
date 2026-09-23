import type { AdsPowerBridgeStatus, AdsPowerIngestItem } from "./waba-adspower.types";

export function resolveAdsPowerApiBase(): string {
  return String(process.env.ADSPOWER_API_BASE || "http://local.adspower.net:50325")
    .trim()
    .replace(/\/+$/, "");
}

export function resolveAdsPowerApiToken(): string {
  return String(process.env.ADSPOWER_API_TOKEN || "").trim();
}

export function resolveAdsPowerIngestToken(): string {
  return String(process.env.ADSPOWER_INGEST_TOKEN || "").trim();
}

function authHeaders(): Record<string, string> {
  const token = resolveAdsPowerApiToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function adsPowerGet(pathname: string, search: Record<string, string>, timeoutMs = 8000): Promise<{
  ok: boolean;
  code: number;
  msg: string;
  data: unknown;
}> {
  const base = resolveAdsPowerApiBase();
  const url = new URL(pathname, `${base}/`);
  for (const [key, value] of Object.entries(search)) {
    if (value) url.searchParams.set(key, value);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: authHeaders(), signal: ac.signal });
    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      msg?: string;
      data?: unknown;
    };
    return {
      ok: res.ok && Number(json.code) === 0,
      code: Number(json.code ?? (res.ok ? -1 : res.status)),
      msg: String(json.msg || res.statusText || ""),
      data: json.data,
    };
  } catch (error) {
    return {
      ok: false,
      code: -1,
      msg: error instanceof Error ? error.message : String(error || "offline"),
      data: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeAdsPowerBridge(): Promise<AdsPowerBridgeStatus> {
  const ingestToken = resolveAdsPowerIngestToken();
  const apiToken = resolveAdsPowerApiToken();
  const baseUrl = resolveAdsPowerApiBase();
  /** EasyPanel só tem ingest: não pingar local.adspower.net (fetch failed na nuvem). */
  if (ingestToken && !apiToken) {
    return {
      configured: true,
      reachable: false,
      mode: "ingest",
      baseUrl,
      detail: "Perfis chegam do PC com AdsPower. Atualize a lista depois de rodar o script no computador.",
    };
  }
  const ping = await adsPowerGet("/api/v1/user/list", { page: "1", page_size: "1" }, 800);
  if (ping.ok) {
    return {
      configured: true,
      reachable: true,
      mode: "local-api",
      baseUrl,
      detail: "Local API do AdsPower respondeu neste servidor.",
    };
  }
  if (ingestToken) {
    return {
      configured: true,
      reachable: false,
      mode: "ingest",
      baseUrl,
      detail: "AdsPower roda no PC do operador. Atualize a lista depois de rodar o script no computador.",
    };
  }
  return {
    configured: false,
    reachable: false,
    mode: "offline",
    baseUrl,
    detail:
      "Configure ADSPOWER_INGEST_TOKEN (nuvem) ou ADSPOWER_API_BASE/ADSPOWER_API_TOKEN (mesmo PC do AdsPower).",
  };
}

export async function listAdsPowerRemoteProfiles(): Promise<AdsPowerIngestItem[]> {
  const rows: AdsPowerIngestItem[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const ping = await adsPowerGet("/api/v1/user/list", { page: String(page), page_size: "100" });
    if (!ping.ok) {
      throw new Error(ping.msg || "Local API do AdsPower indisponível.");
    }
    const data = ping.data as { list?: AdsPowerIngestItem[] } | null;
    const batch = Array.isArray(data?.list) ? data.list : [];
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows;
}

export async function startAdsPowerProfile(userId: string): Promise<{ debugPort: string | null }> {
  const id = String(userId || "").trim();
  if (!id) throw new Error("Informe o perfil AdsPower.");
  const ping = await adsPowerGet("/api/v1/browser/start", {
    user_id: id,
    open_tabs: "1",
    ip_tab: "0",
  }, 20_000);
  if (!ping.ok) {
    throw new Error(ping.msg || "Não foi possível abrir o perfil no AdsPower.");
  }
  const data = ping.data as { debug_port?: string } | null;
  return { debugPort: data?.debug_port ? String(data.debug_port) : null };
}
