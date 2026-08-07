import { loadProxyBrasilConfig, type ProxyBrasilResolved } from "./proxy-brasil.config";

export type EvoProxySetResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  instanceName: string;
  status?: number;
  body?: string;
  host?: string;
  port?: string;
};

type CallEvoAction = (
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, any>,
  options?: { timeoutMs?: number; retries?: number },
) => Promise<{ ok: boolean; status: number; body: string; json?: any; error?: string }>;

function buildProxyPayload(cfg: ProxyBrasilResolved) {
  return {
    enabled: true,
    host: cfg.host,
    port: cfg.port,
    protocol: cfg.protocol,
    username: cfg.username,
    password: cfg.password,
    // aliases usados por algumas builds da Evolution
    proxyHost: cfg.host,
    proxyPort: cfg.port,
    proxyProtocol: cfg.protocol,
    proxyUsername: cfg.username,
    proxyPassword: cfg.password,
  };
}

function buildProxyDisablePayload() {
  return {
    enabled: false,
    host: "",
    port: "",
    protocol: "http",
    username: "",
    password: "",
    proxyHost: "",
    proxyPort: "",
    proxyProtocol: "http",
    proxyUsername: "",
    proxyPassword: "",
  };
}

async function postEvoProxySet(
  instanceName: string,
  callEvoAction: CallEvoAction,
  evoApiBase: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const name = String(instanceName || "").trim();
  const base = String(evoApiBase || "").replace(/\/$/, "");
  const urls = [
    `${base}/proxy/set/${encodeURIComponent(name)}`,
    `${base}/proxy/set`,
  ];
  let lastStatus = 0;
  let lastBody = "";
  for (const url of urls) {
    const body =
      url.endsWith("/proxy/set")
        ? { ...payload, instanceName: name, instance: name }
        : payload;
    const result = await callEvoAction(url, "POST", body, {
      timeoutMs: 20_000,
      retries: 1,
    });
    lastStatus = result.status;
    lastBody = String(result.body || result.error || "").slice(0, 400);
    if (result.ok) return { ok: true, status: result.status, body: lastBody };
  }
  return { ok: false, status: lastStatus, body: lastBody };
}

/**
 * Aplica Proxy Brasil na instância Evolution (POST /proxy/set/:instance).
 * Não falha o fluxo de QR se a EVO rejeitar — retorna ok:false com detalhe.
 */
export async function applyProxyBrasilToEvoInstance(
  instanceName: string,
  callEvoAction: CallEvoAction,
  evoApiBase: string,
  opts?: { force?: boolean; config?: ProxyBrasilResolved | null },
): Promise<EvoProxySetResult> {
  const name = String(instanceName || "").trim();
  if (!name) {
    return { ok: false, instanceName: "", reason: "instanceName vazio" };
  }

  const cfg = opts?.config === undefined ? loadProxyBrasilConfig() : opts.config;
  if (!cfg) {
    return {
      ok: false,
      skipped: true,
      instanceName: name,
      reason: "Proxy Brasil não configurado no .env",
    };
  }
  if (!cfg.enabled && !opts?.force) {
    return {
      ok: false,
      skipped: true,
      instanceName: name,
      reason: "PROXY_BRASIL_ENABLED=0",
      host: cfg.host,
      port: cfg.port,
    };
  }

  const result = await postEvoProxySet(name, callEvoAction, evoApiBase, buildProxyPayload(cfg));
  if (result.ok) {
    console.info(
      `[ProxyBrasil] proxy aplicado em ${name} via ${cfg.host}:${cfg.port} (${cfg.slot}/${cfg.source})`,
    );
    return {
      ok: true,
      instanceName: name,
      status: result.status,
      body: result.body,
      host: cfg.host,
      port: cfg.port,
    };
  }

  console.warn(
    `[ProxyBrasil] falha ao aplicar proxy em ${name}: HTTP ${result.status} ${result.body.slice(0, 160)}`,
  );
  return {
    ok: false,
    instanceName: name,
    status: result.status,
    body: result.body,
    host: cfg.host,
    port: cfg.port,
    reason: `EVO proxy/set falhou (HTTP ${result.status})`,
  };
}

/** Desliga proxy na Evolution (não remove credenciais do .env — só enabled:false na instância). */
export async function disableProxyBrasilOnEvoInstance(
  instanceName: string,
  callEvoAction: CallEvoAction,
  evoApiBase: string,
): Promise<EvoProxySetResult> {
  const name = String(instanceName || "").trim();
  if (!name) {
    return { ok: false, instanceName: "", reason: "instanceName vazio" };
  }
  const result = await postEvoProxySet(
    name,
    callEvoAction,
    evoApiBase,
    buildProxyDisablePayload(),
  );
  if (result.ok) {
    console.info(`[ProxyBrasil] proxy desligado em ${name}`);
    return { ok: true, instanceName: name, status: result.status, body: result.body };
  }
  console.warn(
    `[ProxyBrasil] falha ao desligar proxy em ${name}: HTTP ${result.status} ${result.body.slice(0, 160)}`,
  );
  return {
    ok: false,
    instanceName: name,
    status: result.status,
    body: result.body,
    reason: `EVO proxy/set (disable) falhou (HTTP ${result.status})`,
  };
}

/**
 * @deprecated Não usar no Aquecedor/QR. Proxy só na criação da campanha Alternativa.
 */
export async function maybeApplyProxyBrasilOnInstanceCreate(
  instanceName: string,
  callEvoAction: CallEvoAction,
  evoApiBase: string,
): Promise<EvoProxySetResult | null> {
  const cfg = loadProxyBrasilConfig();
  if (!cfg?.enabled || !cfg.applyOnCreate) return null;
  return applyProxyBrasilToEvoInstance(instanceName, callEvoAction, evoApiBase, { config: cfg });
}

function normalizeInstanceNameList(instanceNames: string[]): string[] {
  return Array.from(
    new Set(
      (Array.isArray(instanceNames) ? instanceNames : [])
        .map((n) => String(n || "").trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Aplica Proxy Brasil nas instâncias da campanha (Gerar Campanha / add instances).
 */
export function queueApplyProxyBrasilToInstances(
  instanceNames: string[],
  callEvoAction: CallEvoAction,
  evoApiBase: string,
): void {
  const names = normalizeInstanceNameList(instanceNames);
  if (!names.length) return;
  const cfg = loadProxyBrasilConfig();
  if (!cfg?.enabled) return;

  void (async () => {
    for (const name of names) {
      try {
        await applyProxyBrasilToEvoInstance(name, callEvoAction, evoApiBase, { config: cfg });
      } catch (err: any) {
        console.warn(
          `[ProxyBrasil] falha em background para ${name}:`,
          err?.message || err,
        );
      }
    }
  })();
}

/** Desliga proxy em background (números removidos da seleção final da campanha). */
export function queueDisableProxyBrasilOnInstances(
  instanceNames: string[],
  callEvoAction: CallEvoAction,
  evoApiBase: string,
): void {
  const names = normalizeInstanceNameList(instanceNames);
  if (!names.length) return;
  const cfg = loadProxyBrasilConfig();
  if (!cfg?.enabled) return;

  void (async () => {
    for (const name of names) {
      try {
        await disableProxyBrasilOnEvoInstance(name, callEvoAction, evoApiBase);
      } catch (err: any) {
        console.warn(
          `[ProxyBrasil] falha ao desligar em background para ${name}:`,
          err?.message || err,
        );
      }
    }
  })();
}

/**
 * Sincroniza proxy no «Gerar Campanha»: liga nos selecionados e desliga os que saíram da seleção.
 */
export function queueSyncProxyBrasilForCampaignSelection(opts: {
  selectedInstanceNames: string[];
  previouslySelectedInstanceNames?: string[];
  callEvoAction: CallEvoAction;
  evoApiBase: string;
}): void {
  const selected = normalizeInstanceNameList(opts.selectedInstanceNames);
  const previous = normalizeInstanceNameList(opts.previouslySelectedInstanceNames || []);
  const selectedLower = new Set(selected.map((n) => n.toLowerCase()));
  const toDisable = previous.filter((n) => !selectedLower.has(n.toLowerCase()));
  queueDisableProxyBrasilOnInstances(toDisable, opts.callEvoAction, opts.evoApiBase);
  queueApplyProxyBrasilToInstances(selected, opts.callEvoAction, opts.evoApiBase);
}
