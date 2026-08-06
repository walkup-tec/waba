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

  const base = String(evoApiBase || "").replace(/\/$/, "");
  const urls = [
    `${base}/proxy/set/${encodeURIComponent(name)}`,
    `${base}/proxy/set`,
  ];
  const payload = buildProxyPayload(cfg);
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
    if (result.ok) {
      console.info(
        `[ProxyBrasil] proxy aplicado em ${name} via ${cfg.host}:${cfg.port} (${cfg.slot}/${cfg.source})`,
      );
      return {
        ok: true,
        instanceName: name,
        status: result.status,
        body: lastBody,
        host: cfg.host,
        port: cfg.port,
      };
    }
  }

  console.warn(
    `[ProxyBrasil] falha ao aplicar proxy em ${name}: HTTP ${lastStatus} ${lastBody.slice(0, 160)}`,
  );
  return {
    ok: false,
    instanceName: name,
    status: lastStatus,
    body: lastBody,
    host: cfg.host,
    port: cfg.port,
    reason: `EVO proxy/set falhou (HTTP ${lastStatus})`,
  };
}

export async function maybeApplyProxyBrasilOnInstanceCreate(
  instanceName: string,
  callEvoAction: CallEvoAction,
  evoApiBase: string,
): Promise<EvoProxySetResult | null> {
  const cfg = loadProxyBrasilConfig();
  if (!cfg?.enabled || !cfg.applyOnCreate) return null;
  return applyProxyBrasilToEvoInstance(instanceName, callEvoAction, evoApiBase, { config: cfg });
}

/**
 * Aplica Proxy Brasil nas instâncias selecionadas para campanha, em background.
 * Não bloqueia a UI — o usuário continua nas próximas etapas do wizard.
 */
export function queueApplyProxyBrasilToInstances(
  instanceNames: string[],
  callEvoAction: CallEvoAction,
  evoApiBase: string,
): void {
  const names = Array.from(
    new Set(
      (Array.isArray(instanceNames) ? instanceNames : [])
        .map((n) => String(n || "").trim())
        .filter(Boolean),
    ),
  );
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
