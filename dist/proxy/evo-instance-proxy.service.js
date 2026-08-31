"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instanceNamesToReleaseAfterCampaignEnd = exports.campaignStatusHoldsProxyBrasil = void 0;
exports.rememberConfirmedProxyFind = rememberConfirmedProxyFind;
exports.getConfirmedProxyFind = getConfirmedProxyFind;
exports.areAllInstanceNamesProxyConfirmedEnabled = areAllInstanceNamesProxyConfirmedEnabled;
exports.fetchEvoProxyFindEnabled = fetchEvoProxyFindEnabled;
exports.refreshConfirmedProxyFindForNames = refreshConfirmedProxyFindForNames;
exports.queueConfirmProxyFindForInstanceNames = queueConfirmProxyFindForInstanceNames;
exports.applyProxyBrasilToEvoInstance = applyProxyBrasilToEvoInstance;
exports.disableProxyBrasilOnEvoInstance = disableProxyBrasilOnEvoInstance;
exports.maybeApplyProxyBrasilOnInstanceCreate = maybeApplyProxyBrasilOnInstanceCreate;
exports.getProxyBrasilSessionPrepareStatus = getProxyBrasilSessionPrepareStatus;
exports.clearProxyBrasilSessionPrepareStatus = clearProxyBrasilSessionPrepareStatus;
exports.isProxyBrasilSessionReadyForSend = isProxyBrasilSessionReadyForSend;
exports.markProxyBrasilSessionReadyForSend = markProxyBrasilSessionReadyForSend;
exports.rollbackProxyBrasilSessionToDirect = rollbackProxyBrasilSessionToDirect;
exports.prepareProxyBrasilSessionForCampaignSend = prepareProxyBrasilSessionForCampaignSend;
exports.prepareProxyBrasilSessionsForCampaign = prepareProxyBrasilSessionsForCampaign;
exports.queueApplyProxyBrasilToInstances = queueApplyProxyBrasilToInstances;
exports.reconcileProxyBrasilForCampaignInstances = reconcileProxyBrasilForCampaignInstances;
exports.queueDisableProxyBrasilOnInstances = queueDisableProxyBrasilOnInstances;
exports.queueSyncProxyBrasilForCampaignSelection = queueSyncProxyBrasilForCampaignSelection;
const proxy_brasil_config_1 = require("./proxy-brasil.config");
const proxy_brasil_campaign_rules_1 = require("./proxy-brasil-campaign.rules");
var proxy_brasil_campaign_rules_2 = require("./proxy-brasil-campaign.rules");
Object.defineProperty(exports, "campaignStatusHoldsProxyBrasil", { enumerable: true, get: function () { return proxy_brasil_campaign_rules_2.campaignStatusHoldsProxyBrasil; } });
Object.defineProperty(exports, "instanceNamesToReleaseAfterCampaignEnd", { enumerable: true, get: function () { return proxy_brasil_campaign_rules_2.instanceNamesToReleaseAfterCampaignEnd; } });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
function buildProxyPayload(cfg) {
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
async function postEvoProxySet(instanceName, callEvoAction, evoApiBase, payload) {
    const name = String(instanceName || "").trim();
    const base = String(evoApiBase || "").replace(/\/$/, "");
    const urls = [
        `${base}/proxy/set/${encodeURIComponent(name)}`,
        `${base}/proxy/set`,
    ];
    let lastStatus = 0;
    let lastBody = "";
    for (const url of urls) {
        const body = url.endsWith("/proxy/set")
            ? { ...payload, instanceName: name, instance: name }
            : payload;
        const result = await callEvoAction(url, "POST", body, {
            timeoutMs: 20000,
            retries: 1,
        });
        lastStatus = result.status;
        lastBody = String(result.body || result.error || "").slice(0, 400);
        if (result.ok)
            return { ok: true, status: result.status, body: lastBody };
    }
    return { ok: false, status: lastStatus, body: lastBody };
}
const PROXY_FIND_CACHE_TTL_MS = 90000;
const proxyFindCache = new Map();
function rememberConfirmedProxyFind(instanceName, enabled) {
    const key = prepareKey(instanceName);
    if (!key)
        return;
    proxyFindCache.set(key, { enabled: Boolean(enabled), at: Date.now() });
}
/** `true`/`false` só com confirmação recente via `/proxy/find` ou set. */
function getConfirmedProxyFind(instanceName) {
    const key = prepareKey(instanceName);
    if (!key)
        return null;
    const hit = proxyFindCache.get(key);
    if (!hit)
        return null;
    if (Date.now() - hit.at > PROXY_FIND_CACHE_TTL_MS)
        return null;
    return hit.enabled;
}
function areAllInstanceNamesProxyConfirmedEnabled(instanceNames) {
    const names = normalizeInstanceNameList(instanceNames);
    if (!names.length)
        return false;
    return names.every((n) => getConfirmedProxyFind(n) === true);
}
async function fetchEvoProxyFindEnabled(instanceName, callEvoAction, evoApiBase, opts) {
    return fetchEvoProxyEnabled(instanceName, callEvoAction, evoApiBase, opts);
}
function readEvoProxyEnabledFlag(json) {
    if (json == null)
        return false;
    if (typeof json !== "object")
        return null;
    const root = json;
    const nested = [root, root.proxy, root.data, root.response];
    for (const node of nested) {
        if (!node || typeof node !== "object")
            continue;
        if ("enabled" in node) {
            return Boolean(node.enabled);
        }
    }
    return null;
}
async function fetchEvoProxyEnabled(instanceName, callEvoAction, evoApiBase, opts) {
    const name = String(instanceName || "").trim();
    if (!name)
        return null;
    const base = String(evoApiBase || "").replace(/\/$/, "");
    const urls = [
        `${base}/proxy/find/${encodeURIComponent(name)}`,
        `${base}/proxy/find?instanceName=${encodeURIComponent(name)}`,
    ];
    for (const url of urls) {
        const result = await callEvoAction(url, "GET", undefined, {
            timeoutMs: opts?.timeoutMs ?? 12000,
            retries: opts?.retries ?? 1,
        });
        if (!result.ok)
            continue;
        const parsed = readEvoProxyEnabledFlag(result.json);
        if (parsed === null)
            continue;
        if (parsed === false && getConfirmedProxyFind(name) === true) {
            // 200+null / enabled:false logo após proxy/set: a Evolution ainda não gravou a linha.
            return true;
        }
        rememberConfirmedProxyFind(name, parsed);
        return parsed;
    }
    if (getConfirmedProxyFind(name) === true)
        return true;
    return null;
}
async function refreshConfirmedProxyFindForNames(instanceNames, callEvoAction, evoApiBase) {
    const names = normalizeInstanceNameList(instanceNames).filter((n) => getConfirmedProxyFind(n) === null);
    if (!names.length)
        return;
    const queue = names.slice(0, 24);
    const concurrency = 4;
    let idx = 0;
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (idx < queue.length) {
            const name = queue[idx];
            idx += 1;
            try {
                await fetchEvoProxyEnabled(name, callEvoAction, evoApiBase, {
                    timeoutMs: 6000,
                    retries: 0,
                });
            }
            catch {
                /* */
            }
        }
    });
    await Promise.all(workers);
}
function queueConfirmProxyFindForInstanceNames(instanceNames, callEvoAction, evoApiBase) {
    const names = normalizeInstanceNameList(instanceNames);
    if (!names.length)
        return;
    void refreshConfirmedProxyFindForNames(names, callEvoAction, evoApiBase).catch(() => {
        /* */
    });
}
async function applyProxyBrasilToEvoInstance(instanceName, callEvoAction, evoApiBase, opts) {
    const name = String(instanceName || "").trim();
    if (!name) {
        return { ok: false, instanceName: "", reason: "instanceName vazio" };
    }
    const cfg = opts?.config === undefined ? (0, proxy_brasil_config_1.loadProxyBrasilConfig)() : opts.config;
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
        rememberConfirmedProxyFind(name, true);
        console.info(`[ProxyBrasil] proxy aplicado em ${name} via ${cfg.host}:${cfg.port} (${cfg.slot}/${cfg.source})`);
        return {
            ok: true,
            instanceName: name,
            status: result.status,
            body: result.body,
            host: cfg.host,
            port: cfg.port,
        };
    }
    console.warn(`[ProxyBrasil] falha ao aplicar proxy em ${name}: HTTP ${result.status} ${result.body.slice(0, 160)}`);
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
async function disableProxyBrasilOnEvoInstance(instanceName, callEvoAction, evoApiBase) {
    const name = String(instanceName || "").trim();
    if (!name) {
        return { ok: false, instanceName: "", reason: "instanceName vazio" };
    }
    const result = await postEvoProxySet(name, callEvoAction, evoApiBase, buildProxyDisablePayload());
    if (result.ok) {
        rememberConfirmedProxyFind(name, false);
        console.info(`[ProxyBrasil] proxy desligado em ${name}`);
        return { ok: true, instanceName: name, status: result.status, body: result.body };
    }
    console.warn(`[ProxyBrasil] falha ao desligar proxy em ${name}: HTTP ${result.status} ${result.body.slice(0, 160)}`);
    return {
        ok: false,
        instanceName: name,
        status: result.status,
        body: result.body,
        reason: `EVO proxy/set (disable) falhou (HTTP ${result.status})`,
    };
}
/** @deprecated Não usar no Aquecedor/QR. */
async function maybeApplyProxyBrasilOnInstanceCreate(instanceName, callEvoAction, evoApiBase) {
    const cfg = (0, proxy_brasil_config_1.loadProxyBrasilConfig)();
    if (!cfg?.enabled || !cfg.applyOnCreate)
        return null;
    return applyProxyBrasilToEvoInstance(instanceName, callEvoAction, evoApiBase, { config: cfg });
}
function normalizeInstanceNameList(instanceNames) {
    return Array.from(new Set((Array.isArray(instanceNames) ? instanceNames : [])
        .map((n) => String(n || "").trim())
        .filter(Boolean)));
}
function prepareKey(instanceName) {
    return String(instanceName || "").trim().toLowerCase();
}
const prepareStatusByInstance = new Map();
const prepareInflightByInstance = new Map();
function setPrepareStatus(instanceName, entry) {
    const key = prepareKey(instanceName);
    const next = {
        ...entry,
        updatedAt: entry.updatedAt ?? Date.now(),
    };
    prepareStatusByInstance.set(key, next);
    return next;
}
function getProxyBrasilSessionPrepareStatus(instanceName) {
    const key = prepareKey(instanceName);
    if (!key)
        return null;
    return prepareStatusByInstance.get(key) || null;
}
function clearProxyBrasilSessionPrepareStatus(instanceName) {
    const key = prepareKey(instanceName);
    if (key)
        prepareStatusByInstance.delete(key);
}
/** Proxy global off → envio liberado. Proxy on → só com `/proxy/find` enabled. */
function isProxyBrasilSessionReadyForSend(instanceName) {
    const cfg = (0, proxy_brasil_config_1.loadProxyBrasilConfig)();
    if (!cfg?.enabled)
        return true;
    return getConfirmedProxyFind(instanceName) === true;
}
/** Marca pronta sem restart (sessão já open no EVO). Usado no disparo para não derrubar Baileys. */
function markProxyBrasilSessionReadyForSend(instanceName, opts) {
    const name = String(instanceName || "").trim();
    if (!name)
        return null;
    return setPrepareStatus(name, {
        status: "ready",
        state: opts?.state,
        reason: opts?.reason || "marcada ready sem restart (sessão open)",
        proxyApplied: false,
        restarted: false,
    });
}
/** open estável (evita falso positivo / flash open). */
async function assertStableOpen(deps, instanceName, opts) {
    const rounds = Math.max(2, Math.min(6, opts?.rounds ?? 3));
    const gapMs = Math.max(500, Math.min(5000, opts?.gapMs ?? 2000));
    let lastState = "";
    for (let i = 0; i < rounds; i += 1) {
        lastState = await deps.fetchLiveState(instanceName, { fresh: true });
        if (!deps.isLiveStateOpen(lastState)) {
            return { ok: false, state: lastState };
        }
        if (i < rounds - 1)
            await sleep(gapMs);
    }
    return { ok: true, state: lastState };
}
/**
 * Se proxy/set derrubar a sessão: desliga proxy + restart e tenta recuperar o pareamento.
 * Nunca deixar proxy ligado com Connection Closed.
 */
async function rollbackProxyBrasilSessionToDirect(instanceName, deps, opts) {
    const name = String(instanceName || "").trim();
    if (!name)
        return { restored: false, state: "" };
    console.warn(`[ProxyBrasil] ${name}: rollback — desligar proxy e tentar restaurar sessão direta.`);
    try {
        await disableProxyBrasilOnEvoInstance(name, deps.callEvoAction, deps.evoApiBase);
    }
    catch (err) {
        console.warn(`[ProxyBrasil] ${name}: rollback disable falhou:`, err?.message || err);
    }
    try {
        await deps.restartInstanceLight(name, deps.apiKey);
    }
    catch (err) {
        console.warn(`[ProxyBrasil] ${name}: rollback restart falhou:`, err?.message || err);
    }
    const waited = await deps.waitForOpenLenient(name, {
        maxWaitMs: opts?.maxWaitMs ?? 90000,
        pollMs: 1500,
    });
    if (waited.open) {
        const stable = await assertStableOpen(deps, name);
        console.info(`[ProxyBrasil] ${name}: rollback ${stable.ok ? "restaurou" : "parcial"} (state=${stable.state || waited.state}).`);
        return { restored: stable.ok, state: stable.state || waited.state };
    }
    console.warn(`[ProxyBrasil] ${name}: rollback não restaurou open (state=${waited.state || "desconhecido"}). Pode ser necessário QR.`);
    return { restored: false, state: waited.state };
}
/**
 * Liga Proxy Brasil no número selecionado para campanha Alternativa.
 * Se a sessão cair ao aplicar, a Proxy permanece ligada e exige QR com Proxy Campanha.
 */
async function prepareProxyBrasilSessionForCampaignSend(instanceName, deps, opts) {
    const name = String(instanceName || "").trim();
    if (!name) {
        return { ok: false, instanceName: "", status: "failed", reason: "instanceName vazio" };
    }
    const key = prepareKey(name);
    const inflight = prepareInflightByInstance.get(key);
    if (inflight)
        return inflight;
    const run = (async () => {
        const cfg = (0, proxy_brasil_config_1.loadProxyBrasilConfig)();
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
        const failAndRollback = async (reason, extra) => {
            const rb = await rollbackProxyBrasilSessionToDirect(name, deps, {
                maxWaitMs: opts?.maxWaitMs ?? 90000,
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
            const proxyEnabled = await fetchEvoProxyEnabled(name, deps.callEvoAction, deps.evoApiBase);
            if ((0, proxy_brasil_campaign_rules_1.shouldSkipProxySetBecauseSessionOpen)(wasOpen) && !opts?.forceRestart) {
                if (proxyEnabled === true) {
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
                    const entry = setPrepareStatus(name, {
                        status: "failed",
                        state: stable.state || liveBefore,
                        reason: `Proxy ligado mas sessão instável (state=${stable.state || liveBefore}). Reconecte o QR com Proxy Campanha.`,
                        needsProxyPairing: true,
                    });
                    return {
                        ok: false,
                        instanceName: name,
                        status: entry.status,
                        state: entry.state,
                        reason: entry.reason,
                        needsProxyPairing: true,
                    };
                }
                const entry = setPrepareStatus(name, {
                    status: "failed",
                    state: liveBefore,
                    reason: "sessão open sem Proxy Brasil: proxy/set omitido para preservar o pareamento. Reconecte no Aquecedor com Proxy Campanha para disparar.",
                    proxyApplied: false,
                    restarted: false,
                    needsProxyPairing: true,
                });
                console.warn(`[ProxyBrasil] ${name}: ${entry.reason}`);
                return {
                    ok: false,
                    skipped: true,
                    instanceName: name,
                    status: entry.status,
                    state: liveBefore,
                    reason: entry.reason,
                    proxyApplied: false,
                    restarted: false,
                    needsProxyPairing: true,
                };
            }
            if (proxyEnabled === true && !wasOpen) {
                const entry = setPrepareStatus(name, {
                    status: "failed",
                    state: liveBefore,
                    reason: `Proxy ligado com sessão morta (state=${liveBefore || "desconhecido"}). Reconecte o QR com Proxy Campanha.`,
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
            // Número selecionado na campanha Alternativa: Proxy Brasil é obrigatória.
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
                const enabledAfter = await fetchEvoProxyEnabled(name, deps.callEvoAction, deps.evoApiBase);
                const proxyOn = enabledAfter === true || (apply.ok && getConfirmedProxyFind(name) === true);
                if (!proxyOn) {
                    const entry = setPrepareStatus(name, {
                        status: "failed",
                        state: liveBefore,
                        reason: "Proxy Brasil não ficou ligado na Evolution após proxy/set.",
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
                const liveAfter = await deps.fetchLiveState(name, { fresh: true });
                if (deps.isLiveStateOpen(liveAfter)) {
                    const stable = await assertStableOpen(deps, name, { rounds: 2, gapMs: 800 });
                    if (stable.ok) {
                        const entry = setPrepareStatus(name, {
                            status: "ready",
                            state: stable.state,
                            reason: "proxy ligado na seleção da campanha",
                            proxyApplied: true,
                            restarted: false,
                        });
                        console.info(`[ProxyBrasil] ${name}: ${entry.reason}`);
                        return {
                            ok: true,
                            instanceName: name,
                            status: entry.status,
                            state: stable.state,
                            reason: entry.reason,
                            proxyApplied: true,
                            restarted: false,
                        };
                    }
                }
                const waited = await deps.waitForOpenLenient(name, { maxWaitMs: 45000, pollMs: 1500 });
                if (waited.open) {
                    const entry = setPrepareStatus(name, {
                        status: "ready",
                        state: waited.state,
                        reason: "proxy ligado na seleção da campanha (sessão restabelecida)",
                        proxyApplied: true,
                        restarted: false,
                    });
                    return {
                        ok: true,
                        instanceName: name,
                        status: entry.status,
                        state: waited.state,
                        reason: entry.reason,
                        proxyApplied: true,
                    };
                }
                const entry = setPrepareStatus(name, {
                    status: "failed",
                    state: waited.state || liveAfter || liveBefore,
                    reason: "Proxy ligado. A sessão caiu ao aplicar — reconecte o QR com Proxy Campanha e ative de novo.",
                    proxyApplied: true,
                    needsProxyPairing: true,
                });
                console.warn(`[ProxyBrasil] ${name}: ${entry.reason}`);
                return {
                    ok: false,
                    instanceName: name,
                    status: entry.status,
                    state: entry.state,
                    reason: entry.reason,
                    proxyApplied: true,
                    needsProxyPairing: true,
                };
            }
            if (opts?.forceRestart && proxyEnabled === true) {
                const restarted = await deps.restartInstanceLight(name, deps.apiKey);
                const waited = await deps.waitForOpenLenient(name, {
                    maxWaitMs: opts?.maxWaitMs ?? 75000,
                    pollMs: 1500,
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
                return failAndRollback(`Proxy ligado mas sessão não estabilizou após restart (state=${waited.state || "desconhecido"}).`, { restarted: true, state: waited.state });
            }
            const entry = setPrepareStatus(name, {
                status: "failed",
                state: liveBefore,
                reason: "Instância precisa ser pareada com Proxy Brasil (QR com campaignProxy). Depois ative a campanha.",
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
        }
        catch (err) {
            const reason = String(err?.message || err || "erro ao preparar proxy");
            try {
                return await failAndRollback(reason);
            }
            catch {
                setPrepareStatus(name, { status: "failed", reason, rolledBack: false, needsProxyPairing: true });
                return {
                    ok: false,
                    instanceName: name,
                    status: "failed",
                    reason,
                    needsProxyPairing: true,
                };
            }
        }
        finally {
            prepareInflightByInstance.delete(key);
        }
    })();
    prepareInflightByInstance.set(key, run);
    return run;
}
async function prepareProxyBrasilSessionsForCampaign(instanceNames, deps) {
    const names = normalizeInstanceNameList(instanceNames);
    const out = [];
    for (const name of names) {
        out.push(await prepareProxyBrasilSessionForCampaignSend(name, deps));
    }
    return out;
}
function queueApplyProxyBrasilToInstances(instanceNames, callEvoAction, evoApiBase, prepareDeps) {
    const names = normalizeInstanceNameList(instanceNames);
    if (!names.length)
        return;
    const cfg = (0, proxy_brasil_config_1.loadProxyBrasilConfig)();
    if (!cfg?.enabled)
        return;
    void (async () => {
        for (const name of names) {
            try {
                if (prepareDeps) {
                    await prepareProxyBrasilSessionForCampaignSend(name, {
                        callEvoAction,
                        evoApiBase,
                        ...prepareDeps,
                    });
                }
                else {
                    // Sem prepareDeps: ainda assim não deixar proxy on sem sessão —
                    // preferir prepare completo quando disponível.
                    await applyProxyBrasilToEvoInstance(name, callEvoAction, evoApiBase, { config: cfg });
                }
            }
            catch (err) {
                console.warn(`[ProxyBrasil] falha em background para ${name}:`, err?.message || err);
            }
        }
    })();
}
const lastProxyEnableAt = new Map();
const PROXY_ENABLE_COOLDOWN_MS = 120000;
/**
 * No tick: não liga nem desliga Proxy nos números que permanecem na campanha.
 * Ligar (`proxy/set`) em sessão `open` derruba o pareamento (device_removed).
 */
async function reconcileProxyBrasilForCampaignInstances(opts) {
    const enabled = [];
    const disabled = [];
    const cfg = (0, proxy_brasil_config_1.loadProxyBrasilConfig)();
    if (!cfg?.enabled)
        return { enabled, disabled };
    const selected = normalizeInstanceNameList(opts.selectedInstanceNames);
    const extra = normalizeInstanceNameList(opts.extraReleaseInstanceNames || []);
    const heldLower = new Set(normalizeInstanceNameList(opts.heldInstanceNames).map((n) => n.toLowerCase()));
    const selectedLower = new Set(selected.map((n) => n.toLowerCase()));
    const names = normalizeInstanceNameList([...selected, ...extra]);
    const fetchLive = opts.prepareDeps?.fetchLiveState;
    for (const name of names) {
        const inHeld = heldLower.has(name.toLowerCase()) || selectedLower.has(name.toLowerCase());
        let live = "";
        if (fetchLive) {
            try {
                live = await fetchLive(name, { fresh: true });
            }
            catch {
                live = "";
            }
        }
        const connection = (0, proxy_brasil_campaign_rules_1.classifyProxyBrasilConnection)(live);
        let find = getConfirmedProxyFind(name);
        if (find === null) {
            find = await fetchEvoProxyEnabled(name, opts.callEvoAction, opts.evoApiBase, {
                timeoutMs: 6000,
                retries: 0,
            });
        }
        if (opts.allowEnable !== false &&
            (0, proxy_brasil_campaign_rules_1.shouldEnableProxyBrasil)({
                selectedInLiveCampaign: inHeld,
                connection,
                proxyFindEnabled: find,
            })) {
            const key = prepareKey(name);
            const last = lastProxyEnableAt.get(key) || 0;
            if (Date.now() - last < PROXY_ENABLE_COOLDOWN_MS)
                continue;
            lastProxyEnableAt.set(key, Date.now());
            try {
                if (opts.prepareDeps) {
                    await prepareProxyBrasilSessionForCampaignSend(name, {
                        callEvoAction: opts.callEvoAction,
                        evoApiBase: opts.evoApiBase,
                        ...opts.prepareDeps,
                    });
                }
                else if (connection !== "open") {
                    await applyProxyBrasilToEvoInstance(name, opts.callEvoAction, opts.evoApiBase, {
                        config: cfg,
                    });
                }
                else {
                    console.warn(`[ProxyBrasil] ${name}: reconcile não aplica proxy/set em sessão open (preserva pareamento).`);
                }
                enabled.push(name);
            }
            catch (err) {
                console.warn(`[ProxyBrasil] reconcile enable falhou em ${name}:`, err?.message || err);
            }
            continue;
        }
        const mayDisable = opts.allowDisableHeld === false
            ? (0, proxy_brasil_campaign_rules_1.shouldDisableProxyBrasilOnLiveCampaignTick)({
                selectedInLiveCampaign: inHeld,
                connection,
            })
            : (0, proxy_brasil_campaign_rules_1.shouldDisableProxyBrasil)({
                selectedInLiveCampaign: inHeld,
                connection,
            });
        if (mayDisable && find !== false && connection !== "open") {
            try {
                await disableProxyBrasilOnEvoInstance(name, opts.callEvoAction, opts.evoApiBase);
                prepareStatusByInstance.delete(prepareKey(name));
                disabled.push(name);
            }
            catch (err) {
                console.warn(`[ProxyBrasil] reconcile disable falhou em ${name}:`, err?.message || err);
            }
        }
    }
    return { enabled, disabled };
}
function queueDisableProxyBrasilOnInstances(instanceNames, callEvoAction, evoApiBase) {
    const names = normalizeInstanceNameList(instanceNames);
    if (!names.length)
        return;
    const cfg = (0, proxy_brasil_config_1.loadProxyBrasilConfig)();
    if (!cfg?.enabled)
        return;
    void (async () => {
        for (const name of names) {
            try {
                await disableProxyBrasilOnEvoInstance(name, callEvoAction, evoApiBase);
                prepareStatusByInstance.delete(prepareKey(name));
            }
            catch (err) {
                console.warn(`[ProxyBrasil] falha ao desligar em background para ${name}:`, err?.message || err);
            }
        }
    })();
}
function queueSyncProxyBrasilForCampaignSelection(opts) {
    const selected = normalizeInstanceNameList(opts.selectedInstanceNames);
    const previous = normalizeInstanceNameList(opts.previouslySelectedInstanceNames || []);
    const selectedLower = new Set(selected.map((n) => n.toLowerCase()));
    const toDisable = previous.filter((n) => !selectedLower.has(n.toLowerCase()));
    queueDisableProxyBrasilOnInstances(toDisable, opts.callEvoAction, opts.evoApiBase);
    queueApplyProxyBrasilToInstances(selected, opts.callEvoAction, opts.evoApiBase, opts.prepareDeps);
}
