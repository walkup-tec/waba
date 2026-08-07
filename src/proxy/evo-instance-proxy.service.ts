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

export type ProxySessionPrepareStatus = "idle" | "preparing" | "ready" | "failed";

export type ProxySessionPrepareEntry = {
  status: ProxySessionPrepareStatus;
  updatedAt: number;
  state?: string;
  reason?: string;
  restarted?: boolean;
  proxyApplied?: boolean;
};

export type ProxySessionPrepareResult = {
  ok: boolean;
  instanceName: string;
  status: ProxySessionPrepareStatus;
  state?: string;
  reason?: string;
  restarted?: boolean;
  proxyApplied?: boolean;
  skipped?: boolean;
};

type CallEvoAction = (
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, any>,
  options?: { timeoutMs?: number; retries?: number },
) => Promise<{ ok: boolean; status: number; body: string; json?: any; error?: string }>;

export type ProxyBrasilPrepareDeps = {
  callEvoAction: CallEvoAction;
  evoApiBase: string;
  apiKey: string;
  restartInstanceLight: (instanceName: string, apiKey: string) => Promise<boolean>;
  waitForOpenLenient: (
    instanceName: string,
    options?: { maxWaitMs?: number; pollMs?: number },
  ) => Promise<{ open: boolean; state: string }>;
  fetchLiveState: (instanceName: string, options?: { fresh?: boolean }) => Promise<string>;
  isLiveStateOpen: (state: string) => boolean;
};

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

async function fetchEvoProxyEnabled(
  instanceName: string,
  callEvoAction: CallEvoAction,
  evoApiBase: string,
): Promise<boolean | null> {
  const name = String(instanceName || "").trim();
  if (!name) return null;
  const base = String(evoApiBase || "").replace(/\/$/, "");
  const urls = [
    `${base}/proxy/find/${encodeURIComponent(name)}`,
    `${base}/proxy/find?instanceName=${encodeURIComponent(name)}`,
  ];
  for (const url of urls) {
    const result = await callEvoAction(url, "GET", undefined, {
      timeoutMs: 12_000,
      retries: 1,
    });
    if (!result.ok) continue;
    const json = result.json;
    if (json == null) return null;
    if (typeof json === "object" && json !== null && "enabled" in json) {
      return Boolean((json as { enabled?: unknown }).enabled);
    }
  }
  return null;
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

function prepareKey(instanceName: string): string {
  return String(instanceName || "").trim().toLowerCase();
}

const prepareStatusByInstance = new Map<string, ProxySessionPrepareEntry>();
const prepareInflightByInstance = new Map<string, Promise<ProxySessionPrepareResult>>();

function setPrepareStatus(
  instanceName: string,
  entry: Omit<ProxySessionPrepareEntry, "updatedAt"> & { updatedAt?: number },
): ProxySessionPrepareEntry {
  const key = prepareKey(instanceName);
  const next: ProxySessionPrepareEntry = {
    ...entry,
    updatedAt: entry.updatedAt ?? Date.now(),
  };
  prepareStatusByInstance.set(key, next);
  return next;
}

export function getProxyBrasilSessionPrepareStatus(
  instanceName: string,
): ProxySessionPrepareEntry | null {
  const key = prepareKey(instanceName);
  if (!key) return null;
  return prepareStatusByInstance.get(key) || null;
}

/** Proxy global off → envio liberado. Proxy on → só após prepare ready. */
export function isProxyBrasilSessionReadyForSend(instanceName: string): boolean {
  const cfg = loadProxyBrasilConfig();
  if (!cfg?.enabled) return true;
  const entry = getProxyBrasilSessionPrepareStatus(instanceName);
  return entry?.status === "ready";
}

/**
 * Liga proxy (se preciso), restart leve e espera connectionState=open.
 * Evita disparar com sessão morta após proxy/set em número já pareado.
 */
export async function prepareProxyBrasilSessionForCampaignSend(
  instanceName: string,
  deps: ProxyBrasilPrepareDeps,
  opts?: { forceRestart?: boolean; maxWaitMs?: number },
): Promise<ProxySessionPrepareResult> {
  const name = String(instanceName || "").trim();
  if (!name) {
    return { ok: false, instanceName: "", status: "failed", reason: "instanceName vazio" };
  }

  const key = prepareKey(name);
  const inflight = prepareInflightByInstance.get(key);
  if (inflight) return inflight;

  const run = (async (): Promise<ProxySessionPrepareResult> => {
    const cfg = loadProxyBrasilConfig();
    if (!cfg?.enabled) {
      const entry = setPrepareStatus(name, {
        status: "ready",
        reason: "PROXY_BRASIL_ENABLED=0",
        proxyApplied: false,
        restarted: false,
      });
      return {
        ok: true,
        skipped: true,
        instanceName: name,
        status: entry.status,
        reason: entry.reason,
      };
    }

    setPrepareStatus(name, { status: "preparing", reason: "preparando proxy+sessão" });

    try {
      const liveBefore = await deps.fetchLiveState(name, { fresh: true });
      const wasOpen = deps.isLiveStateOpen(liveBefore);
      const proxyEnabled = await fetchEvoProxyEnabled(
        name,
        deps.callEvoAction,
        deps.evoApiBase,
      );

      if (proxyEnabled === true && wasOpen && !opts?.forceRestart) {
        const entry = setPrepareStatus(name, {
          status: "ready",
          state: liveBefore,
          reason: "proxy já ligado e sessão open",
          proxyApplied: false,
          restarted: false,
        });
        console.info(`[ProxyBrasil] ${name}: sessão já pronta com proxy (open).`);
        return {
          ok: true,
          instanceName: name,
          status: entry.status,
          state: liveBefore,
          reason: entry.reason,
          proxyApplied: false,
          restarted: false,
        };
      }

      let proxyApplied = false;
      if (proxyEnabled !== true) {
        const apply = await applyProxyBrasilToEvoInstance(name, deps.callEvoAction, deps.evoApiBase, {
          config: cfg,
        });
        if (!apply.ok && !apply.skipped) {
          const entry = setPrepareStatus(name, {
            status: "failed",
            state: liveBefore,
            reason: apply.reason || "falha ao aplicar proxy",
            proxyApplied: false,
            restarted: false,
          });
          return {
            ok: false,
            instanceName: name,
            status: entry.status,
            state: liveBefore,
            reason: entry.reason,
          };
        }
        proxyApplied = Boolean(apply.ok);
      }

      const shouldRestart =
        Boolean(opts?.forceRestart) ||
        proxyApplied ||
        proxyEnabled !== true ||
        !wasOpen;

      let restarted = false;
      if (shouldRestart) {
        restarted = await deps.restartInstanceLight(name, deps.apiKey);
        if (!restarted) {
          console.warn(`[ProxyBrasil] ${name}: restart leve falhou após proxy; seguindo wait open.`);
        } else {
          console.info(`[ProxyBrasil] ${name}: restart leve após proxy.`);
        }
      }

      const waited = await deps.waitForOpenLenient(name, {
        maxWaitMs: opts?.maxWaitMs ?? 90_000,
        pollMs: 1_500,
      });

      if (waited.open) {
        const entry = setPrepareStatus(name, {
          status: "ready",
          state: waited.state,
          reason: "proxy ligado e sessão open",
          proxyApplied,
          restarted,
        });
        console.info(`[ProxyBrasil] ${name}: pronta para envio (open + proxy).`);
        return {
          ok: true,
          instanceName: name,
          status: entry.status,
          state: waited.state,
          reason: entry.reason,
          proxyApplied,
          restarted,
        };
      }

      const entry = setPrepareStatus(name, {
        status: "failed",
        state: waited.state,
        reason: `sessão não voltou open após proxy (state=${waited.state || "desconhecido"}). Reconecte o QR com o número e retome a campanha.`,
        proxyApplied,
        restarted,
      });
      console.warn(`[ProxyBrasil] ${name}: ${entry.reason}`);
      return {
        ok: false,
        instanceName: name,
        status: entry.status,
        state: waited.state,
        reason: entry.reason,
        proxyApplied,
        restarted,
      };
    } catch (err: any) {
      const reason = String(err?.message || err || "erro ao preparar proxy");
      setPrepareStatus(name, { status: "failed", reason });
      console.warn(`[ProxyBrasil] ${name}: prepare falhou:`, reason);
      return { ok: false, instanceName: name, status: "failed", reason };
    } finally {
      prepareInflightByInstance.delete(key);
    }
  })();

  prepareInflightByInstance.set(key, run);
  return run;
}

/**
 * Aplica Proxy Brasil nas instâncias da campanha e restabelece a sessão (Gerar Campanha / add).
 */
export function queueApplyProxyBrasilToInstances(
  instanceNames: string[],
  callEvoAction: CallEvoAction,
  evoApiBase: string,
  prepareDeps?: Omit<ProxyBrasilPrepareDeps, "callEvoAction" | "evoApiBase">,
): void {
  const names = normalizeInstanceNameList(instanceNames);
  if (!names.length) return;
  const cfg = loadProxyBrasilConfig();
  if (!cfg?.enabled) return;

  void (async () => {
    for (const name of names) {
      try {
        if (prepareDeps) {
          await prepareProxyBrasilSessionForCampaignSend(name, {
            callEvoAction,
            evoApiBase,
            ...prepareDeps,
          });
        } else {
          await applyProxyBrasilToEvoInstance(name, callEvoAction, evoApiBase, { config: cfg });
        }
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
        const key = prepareKey(name);
        prepareStatusByInstance.delete(key);
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
 * Sincroniza proxy no «Gerar Campanha»: liga+restaura nos selecionados e desliga os que saíram.
 */
export function queueSyncProxyBrasilForCampaignSelection(opts: {
  selectedInstanceNames: string[];
  previouslySelectedInstanceNames?: string[];
  callEvoAction: CallEvoAction;
  evoApiBase: string;
  prepareDeps?: Omit<ProxyBrasilPrepareDeps, "callEvoAction" | "evoApiBase">;
}): void {
  const selected = normalizeInstanceNameList(opts.selectedInstanceNames);
  const previous = normalizeInstanceNameList(opts.previouslySelectedInstanceNames || []);
  const selectedLower = new Set(selected.map((n) => n.toLowerCase()));
  const toDisable = previous.filter((n) => !selectedLower.has(n.toLowerCase()));
  queueDisableProxyBrasilOnInstances(toDisable, opts.callEvoAction, opts.evoApiBase);
  queueApplyProxyBrasilToInstances(
    selected,
    opts.callEvoAction,
    opts.evoApiBase,
    opts.prepareDeps,
  );
}
