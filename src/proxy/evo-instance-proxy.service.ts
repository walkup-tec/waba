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
  rolledBack?: boolean;
  needsProxyPairing?: boolean;
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
  rolledBack?: boolean;
  needsProxyPairing?: boolean;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

function buildProxyPayload(cfg: ProxyBrasilResolved) {
  return {
    enabled: true,
    host: cfg.host,
    port: cfg.port,
    protocol: cfg.protocol,
    username: cfg.username,
    password: cfg.password,
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

/** @deprecated Não usar no Aquecedor/QR. */
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

export function clearProxyBrasilSessionPrepareStatus(instanceName: string): void {
  const key = prepareKey(instanceName);
  if (key) prepareStatusByInstance.delete(key);
}

/** Proxy global off → envio liberado. Proxy on → só após prepare ready. */
export function isProxyBrasilSessionReadyForSend(instanceName: string): boolean {
  const cfg = loadProxyBrasilConfig();
  if (!cfg?.enabled) return true;
  const entry = getProxyBrasilSessionPrepareStatus(instanceName);
  return entry?.status === "ready";
}

/** Marca pronta sem restart (sessão já open no EVO). Usado no disparo para não derrubar Baileys. */
export function markProxyBrasilSessionReadyForSend(
  instanceName: string,
  opts?: { state?: string; reason?: string },
): ProxySessionPrepareEntry | null {
  const name = String(instanceName || "").trim();
  if (!name) return null;
  return setPrepareStatus(name, {
    status: "ready",
    state: opts?.state,
    reason: opts?.reason || "marcada ready sem restart (sessão open)",
    proxyApplied: false,
    restarted: false,
  });
}

/** open estável (evita falso positivo / flash open). */
async function assertStableOpen(
  deps: ProxyBrasilPrepareDeps,
  instanceName: string,
  opts?: { rounds?: number; gapMs?: number },
): Promise<{ ok: boolean; state: string }> {
  const rounds = Math.max(2, Math.min(6, opts?.rounds ?? 3));
  const gapMs = Math.max(500, Math.min(5_000, opts?.gapMs ?? 2_000));
  let lastState = "";
  for (let i = 0; i < rounds; i += 1) {
    lastState = await deps.fetchLiveState(instanceName, { fresh: true });
    if (!deps.isLiveStateOpen(lastState)) {
      return { ok: false, state: lastState };
    }
    if (i < rounds - 1) await sleep(gapMs);
  }
  return { ok: true, state: lastState };
}

/**
 * Se proxy/set derrubar a sessão: desliga proxy + restart e tenta recuperar o pareamento.
 * Nunca deixar proxy ligado com Connection Closed.
 */
export async function rollbackProxyBrasilSessionToDirect(
  instanceName: string,
  deps: ProxyBrasilPrepareDeps,
  opts?: { maxWaitMs?: number },
): Promise<{ restored: boolean; state: string }> {
  const name = String(instanceName || "").trim();
  if (!name) return { restored: false, state: "" };

  console.warn(`[ProxyBrasil] ${name}: rollback — desligar proxy e tentar restaurar sessão direta.`);
  try {
    await disableProxyBrasilOnEvoInstance(name, deps.callEvoAction, deps.evoApiBase);
  } catch (err: any) {
    console.warn(`[ProxyBrasil] ${name}: rollback disable falhou:`, err?.message || err);
  }

  try {
    await deps.restartInstanceLight(name, deps.apiKey);
  } catch (err: any) {
    console.warn(`[ProxyBrasil] ${name}: rollback restart falhou:`, err?.message || err);
  }

  const waited = await deps.waitForOpenLenient(name, {
    maxWaitMs: opts?.maxWaitMs ?? 90_000,
    pollMs: 1_500,
  });
  if (waited.open) {
    const stable = await assertStableOpen(deps, name);
    console.info(
      `[ProxyBrasil] ${name}: rollback ${stable.ok ? "restaurou" : "parcial"} (state=${stable.state || waited.state}).`,
    );
    return { restored: stable.ok, state: stable.state || waited.state };
  }
  console.warn(
    `[ProxyBrasil] ${name}: rollback não restaurou open (state=${waited.state || "desconhecido"}). Pode ser necessário QR.`,
  );
  return { restored: false, state: waited.state };
}

/**
 * Liga proxy (se preciso), restart leve, exige open estável.
 * Se falhar: rollback (desliga proxy) para não perder a conexão do número.
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

    const failAndRollback = async (
      reason: string,
      extra?: { proxyApplied?: boolean; restarted?: boolean; state?: string },
    ): Promise<ProxySessionPrepareResult> => {
      const rb = await rollbackProxyBrasilSessionToDirect(name, deps, {
        maxWaitMs: opts?.maxWaitMs ?? 90_000,
      });
      const entry = setPrepareStatus(name, {
        status: "failed",
        state: rb.state || extra?.state,
        reason: `${reason} Sessão ${rb.restored ? "restaurada sem proxy" : "não restaurada — reconecte no QR"}. Para enviar com proxy, reconecte o QR com «Proxy Campanha» ligado.`,
        proxyApplied: extra?.proxyApplied,
        restarted: extra?.restarted,
        rolledBack: true,
        needsProxyPairing: true,
      });
      console.warn(`[ProxyBrasil] ${name}: ${entry.reason}`);
      return {
        ok: false,
        instanceName: name,
        status: entry.status,
        state: entry.state,
        reason: entry.reason,
        proxyApplied: extra?.proxyApplied,
        restarted: extra?.restarted,
        rolledBack: true,
        needsProxyPairing: true,
      };
    };

    try {
      const liveBefore = await deps.fetchLiveState(name, { fresh: true });
      const wasOpen = deps.isLiveStateOpen(liveBefore);
      const proxyEnabled = await fetchEvoProxyEnabled(
        name,
        deps.callEvoAction,
        deps.evoApiBase,
      );

      if (proxyEnabled === true && wasOpen && !opts?.forceRestart) {
        const stable = await assertStableOpen(deps, name);
        if (stable.ok) {
          const entry = setPrepareStatus(name, {
            status: "ready",
            state: stable.state,
            reason: "proxy já ligado e sessão open estável",
            proxyApplied: false,
            restarted: false,
          });
          console.info(`[ProxyBrasil] ${name}: sessão já pronta com proxy (open estável).`);
          return {
            ok: true,
            instanceName: name,
            status: entry.status,
            state: stable.state,
            reason: entry.reason,
            proxyApplied: false,
            restarted: false,
          };
        }
        // Proxy on mas sessão instável/morta: rollback para recuperar.
        return failAndRollback(
          `Proxy ligado mas sessão instável (state=${stable.state || liveBefore}).`,
          { state: stable.state || liveBefore },
        );
      }

      // Proxy ligado + sessão morta: recuperar conexão direta (não deixar travado).
      if (proxyEnabled === true && !wasOpen) {
        return failAndRollback(
          `Proxy ligado com sessão morta (state=${liveBefore || "desconhecido"}).`,
          { state: liveBefore },
        );
      }

      // Proxy a quente em sessão já pareada derruba o Baileys.
      // Se já está open: libera envio SEM aplicar proxy e SEM restart/rollback.
      if (proxyEnabled !== true && wasOpen) {
        const stable = await assertStableOpen(deps, name, { rounds: 2, gapMs: 800 });
        if (stable.ok) {
          const entry = setPrepareStatus(name, {
            status: "ready",
            state: stable.state,
            reason: "sessão open — envio liberado sem hot-apply de proxy (preserva pareamento)",
            proxyApplied: false,
            restarted: false,
          });
          console.info(`[ProxyBrasil] ${name}: ${entry.reason}`);
          return {
            ok: true,
            instanceName: name,
            status: entry.status,
            state: stable.state,
            reason: entry.reason,
            proxyApplied: false,
            restarted: false,
          };
        }
        // Flicker transitório: NÃO dar restart (pode gerar device_removed no meio do disparo).
        const waited = await deps.waitForOpenLenient(name, { maxWaitMs: 20_000, pollMs: 1_000 });
        if (waited.open) {
          const entry = setPrepareStatus(name, {
            status: "ready",
            state: waited.state,
            reason: "sessão open após wait — sem restart",
            proxyApplied: false,
            restarted: false,
          });
          return {
            ok: true,
            instanceName: name,
            status: entry.status,
            state: waited.state,
            reason: entry.reason,
          };
        }
        const entry = setPrepareStatus(name, {
          status: "failed",
          state: waited.state || stable.state || liveBefore,
          reason:
            "Sessão não está open de forma estável. Campanha deve pausar — sem restart automático (protege o número).",
          proxyApplied: false,
          restarted: false,
          rolledBack: false,
          needsProxyPairing: false,
        });
        console.warn(`[ProxyBrasil] ${name}: ${entry.reason}`);
        return {
          ok: false,
          instanceName: name,
          status: entry.status,
          state: entry.state,
          reason: entry.reason,
        };
      }

      // Sem sessão open: arma proxy e exige pareamento via QR com proxy.
      if (proxyEnabled !== true) {
        const apply = await applyProxyBrasilToEvoInstance(name, deps.callEvoAction, deps.evoApiBase, {
          config: cfg,
        });
        if (!apply.ok && !apply.skipped) {
          const entry = setPrepareStatus(name, {
            status: "failed",
            state: liveBefore,
            reason: apply.reason || "falha ao aplicar proxy",
            needsProxyPairing: true,
          });
          return {
            ok: false,
            instanceName: name,
            status: entry.status,
            state: liveBefore,
            reason: entry.reason,
            needsProxyPairing: true,
          };
        }
      }

      if (opts?.forceRestart && proxyEnabled === true) {
        const restarted = await deps.restartInstanceLight(name, deps.apiKey);
        const waited = await deps.waitForOpenLenient(name, {
          maxWaitMs: opts?.maxWaitMs ?? 75_000,
          pollMs: 1_500,
        });
        if (waited.open) {
          const stable = await assertStableOpen(deps, name);
          if (stable.ok) {
            const proxyAfter = await fetchEvoProxyEnabled(name, deps.callEvoAction, deps.evoApiBase);
            if (proxyAfter === true) {
              const entry = setPrepareStatus(name, {
                status: "ready",
                state: stable.state,
                reason: "proxy ligado e sessão open estável após restart",
                proxyApplied: false,
                restarted,
              });
              return {
                ok: true,
                instanceName: name,
                status: entry.status,
                state: stable.state,
                reason: entry.reason,
                restarted,
              };
            }
          }
        }
        return failAndRollback(
          `Proxy ligado mas sessão não estabilizou após restart (state=${waited.state || "desconhecido"}).`,
          { restarted: true, state: waited.state },
        );
      }

      const entry = setPrepareStatus(name, {
        status: "failed",
        state: liveBefore,
        reason:
          "Instância precisa ser pareada com Proxy Brasil (QR com campaignProxy). Depois ative a campanha.",
        proxyApplied: proxyEnabled !== true,
        restarted: false,
        needsProxyPairing: true,
      });
      console.warn(`[ProxyBrasil] ${name}: ${entry.reason}`);
      return {
        ok: false,
        instanceName: name,
        status: entry.status,
        state: liveBefore,
        reason: entry.reason,
        needsProxyPairing: true,
      };
    } catch (err: any) {
      const reason = String(err?.message || err || "erro ao preparar proxy");
      try {
        return await failAndRollback(reason);
      } catch {
        setPrepareStatus(name, { status: "failed", reason, rolledBack: false, needsProxyPairing: true });
        return {
          ok: false,
          instanceName: name,
          status: "failed",
          reason,
          needsProxyPairing: true,
        };
      }
    } finally {
      prepareInflightByInstance.delete(key);
    }
  })();

  prepareInflightByInstance.set(key, run);
  return run;
}

export async function prepareProxyBrasilSessionsForCampaign(
  instanceNames: string[],
  deps: ProxyBrasilPrepareDeps,
): Promise<ProxySessionPrepareResult[]> {
  const names = normalizeInstanceNameList(instanceNames);
  const out: ProxySessionPrepareResult[] = [];
  for (const name of names) {
    out.push(await prepareProxyBrasilSessionForCampaignSend(name, deps));
  }
  return out;
}

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
          // Sem prepareDeps: ainda assim não deixar proxy on sem sessão —
          // preferir prepare completo quando disponível.
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
        prepareStatusByInstance.delete(prepareKey(name));
      } catch (err: any) {
        console.warn(
          `[ProxyBrasil] falha ao desligar em background para ${name}:`,
          err?.message || err,
        );
      }
    }
  })();
}

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
