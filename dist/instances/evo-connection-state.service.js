"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEvoLiveStateOpen = isEvoLiveStateOpen;
exports.campaignChipConnectedFromLiveState = campaignChipConnectedFromLiveState;
exports.pickEvoStatusReason = pickEvoStatusReason;
exports.isEvoWhatsAppRestrictedReason = isEvoWhatsAppRestrictedReason;
exports.campaignChipConnectedForDispatch = campaignChipConnectedForDispatch;
exports.runEvoConnectionStateSelfCheck = runEvoConnectionStateSelfCheck;
exports.aquecedorLiveStateAllowsConnected = aquecedorLiveStateAllowsConnected;
exports.isEvoConnectionInProgress = isEvoConnectionInProgress;
exports.waitForEvoInstanceLiveOpen = waitForEvoInstanceLiveOpen;
exports.waitForEvoInstanceLiveOpenLenient = waitForEvoInstanceLiveOpenLenient;
exports.pickEvoConnectionState = pickEvoConnectionState;
exports.fetchEvoInstanceLiveDetail = fetchEvoInstanceLiveDetail;
exports.fetchEvoInstanceLiveState = fetchEvoInstanceLiveState;
exports.invalidateEvoLiveStateCache = invalidateEvoLiveStateCache;
exports.resolveEvoLiveConnectionSnapshots = resolveEvoLiveConnectionSnapshots;
exports.filterInstanceNamesTrulyOpen = filterInstanceNamesTrulyOpen;
exports.describeEvoConnectionMismatch = describeEvoConnectionMismatch;
const evo_api_config_1 = require("../evo-api-config");
const evo_instance_key_1 = require("./evo-instance-key");
const EVO_API_BASE = (0, evo_api_config_1.resolvePrimaryEvoApiBase)();
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const LIVE_STATE_TTL_MS = Math.max(2000, Math.min(120000, Number(process.env.EVO_CONNECTION_STATE_CACHE_MS ?? 4000) || 4000));
let liveStateCache = new Map();
function isEvoLiveStateOpen(state) {
    return String(state || "").trim().toLowerCase() === "open";
}
/**
 * Chip da campanha só fica vermelho com close explícito.
 * Probe vazio/timeout e connecting não são «desconectado» — o fetchInstances e a aba
 * Instâncias tratam o mesmo caso como número ainda no ar.
 */
function campaignChipConnectedFromLiveState(liveState) {
    const s = String(liveState || "").trim().toLowerCase();
    if (!s)
        return true;
    if (s === "open")
        return true;
    if (s === "connecting" || s === "pairing" || s === "qrcode")
        return true;
    return false;
}
/** WhatsApp 403 = ban/restrição. Sessão EVO pode continuar `open` — o chip não pode ficar verde. */
function pickEvoStatusReason(payload) {
    if (!payload || typeof payload !== "object")
        return null;
    const root = payload;
    const inst = root.instance ?? root;
    const candidates = [root.statusReason, inst.statusReason, root.code, inst.code];
    for (const value of candidates) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0)
            return Math.floor(n);
    }
    return null;
}
function isEvoWhatsAppRestrictedReason(statusReason) {
    return Number(statusReason) === 403;
}
/**
 * Verde na campanha = conexão utilizável para disparo.
 * Ban (403) / outbound quebrado / bloqueio de campanha vencem o `open` da Evolution.
 */
function campaignChipConnectedForDispatch(input) {
    if (isEvoWhatsAppRestrictedReason(input.statusReason))
        return false;
    if (input.outboundBroken === true)
        return false;
    if (input.blocked === true)
        return false;
    return campaignChipConnectedFromLiveState(input.liveState);
}
function runEvoConnectionStateSelfCheck() {
    if (campaignChipConnectedForDispatch({ liveState: "open", statusReason: 403 }) !== false) {
        throw new Error("403 tem de deixar o chip da campanha vermelho mesmo com EVO open");
    }
    if (campaignChipConnectedForDispatch({ liveState: "open", outboundBroken: true }) !== false) {
        throw new Error("outbound ERROR tem de deixar o chip vermelho");
    }
    if (campaignChipConnectedForDispatch({ liveState: "open", blocked: true }) !== false) {
        throw new Error("bloqueio de campanha tem de deixar o chip vermelho");
    }
    if (campaignChipConnectedForDispatch({ liveState: "open" }) !== true) {
        throw new Error("open sem 403 continua verde");
    }
    if (campaignChipConnectedForDispatch({ liveState: "" }) !== true) {
        throw new Error("probe vazio não é desconectado");
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
function aquecedorLiveStateAllowsConnected(liveState) {
    const state = String(liveState || "").trim().toLowerCase();
    if (!state)
        return true;
    return isEvoLiveStateOpen(state);
}
function isEvoConnectionInProgress(state) {
    const s = String(state || "").trim().toLowerCase();
    return s === "connecting" || s === "pairing" || s === "qrcode";
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForEvoInstanceLiveOpen(instanceName, options) {
    const maxWaitMs = Math.max(5000, Math.min(120000, options?.maxWaitMs ?? 45000));
    const pollMs = Math.max(300, Math.min(5000, options?.pollMs ?? 600));
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
async function waitForEvoInstanceLiveOpenLenient(instanceName, options) {
    const maxWaitMs = Math.max(10000, Math.min(180000, options?.maxWaitMs ?? 90000));
    const pollMs = Math.max(500, Math.min(5000, options?.pollMs ?? 1500));
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
function pickEvoConnectionState(payload) {
    if (!payload || typeof payload !== "object")
        return "";
    const root = payload;
    const inst = root.instance ?? root;
    const raw = inst.state ??
        inst.connectionStatus ??
        inst.status ??
        root.state ??
        root.connectionStatus ??
        "";
    return String(raw || "").trim().toLowerCase();
}
async function fetchEvoInstanceLiveDetail(instanceName, options) {
    const key = String(instanceName || "").trim().toLowerCase();
    if (!key)
        return { state: "", statusReason: null };
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
        const result = await (0, evo_api_config_1.evoHttpRequestWithBaseFailover)(url, "GET", {
            apiKey: EVO_API_KEY,
            timeoutMs: 10000,
            retries: 1,
        });
        if (!result.ok && result.status === 404)
            continue;
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
async function fetchEvoInstanceLiveState(instanceName, options) {
    const detail = await fetchEvoInstanceLiveDetail(instanceName, options);
    return detail.state;
}
function invalidateEvoLiveStateCache(instanceName) {
    if (!instanceName) {
        liveStateCache.clear();
        return;
    }
    liveStateCache.delete(String(instanceName || "").trim().toLowerCase());
}
async function resolveEvoLiveConnectionSnapshots(instances) {
    const list = Array.isArray(instances) ? instances : [instances];
    const rows = [];
    for (const item of list) {
        if (!item || typeof item !== "object")
            continue;
        const inst = item.instance ?? item;
        const instanceName = (0, evo_instance_key_1.resolveEvoInstanceKey)(inst);
        if (!instanceName)
            continue;
        const fetchStatus = String(inst?.connectionStatus ??
            inst?.status ??
            "")
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
async function filterInstanceNamesTrulyOpen(instanceNames) {
    const out = [];
    for (const name of instanceNames) {
        const state = await fetchEvoInstanceLiveState(name);
        if (isEvoLiveStateOpen(state))
            out.push(name);
    }
    return out;
}
function describeEvoConnectionMismatch(snapshots) {
    const ghostOpen = snapshots.filter((row) => row.fetchStatus.includes("open") && !row.trulyOpen);
    if (!ghostOpen.length)
        return "";
    const sample = ghostOpen
        .slice(0, 6)
        .map((row) => `${row.instanceName} (fetch=${row.fetchStatus || "?"}, live=${row.liveState || "?"})`)
        .join("; ");
    return `O sistema WABA - Drax reporta instâncias como conectadas no fetchInstances, mas connectionState não está open: ${sample}. Reconecte o WhatsApp (QR) ou reinicie o sistema WABA - Drax.`;
}
