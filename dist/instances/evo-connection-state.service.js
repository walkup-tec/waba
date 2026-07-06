"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEvoLiveStateOpen = isEvoLiveStateOpen;
exports.isEvoConnectionInProgress = isEvoConnectionInProgress;
exports.waitForEvoInstanceLiveOpen = waitForEvoInstanceLiveOpen;
exports.pickEvoConnectionState = pickEvoConnectionState;
exports.fetchEvoInstanceLiveState = fetchEvoInstanceLiveState;
exports.invalidateEvoLiveStateCache = invalidateEvoLiveStateCache;
exports.resolveEvoLiveConnectionSnapshots = resolveEvoLiveConnectionSnapshots;
exports.filterInstanceNamesTrulyOpen = filterInstanceNamesTrulyOpen;
exports.describeEvoConnectionMismatch = describeEvoConnectionMismatch;
const evo_http_client_1 = require("../evo-http.client");
const evo_instance_key_1 = require("./evo-instance-key");
const EVO_API_BASE = String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080").replace(/\/$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const LIVE_STATE_TTL_MS = Math.max(2000, Math.min(120000, Number(process.env.EVO_CONNECTION_STATE_CACHE_MS ?? 4000) || 4000));
let liveStateCache = new Map();
function isEvoLiveStateOpen(state) {
    return String(state || "").trim().toLowerCase() === "open";
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
async function fetchEvoInstanceLiveState(instanceName, options) {
    const key = String(instanceName || "").trim().toLowerCase();
    if (!key)
        return "";
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
        const result = await (0, evo_http_client_1.evoHttpRequest)(url, "GET", {
            apiKey: EVO_API_KEY,
            timeoutMs: 10000,
            retries: 1,
        });
        if (!result.ok && result.status === 404)
            continue;
        const state = pickEvoConnectionState(result.json);
        if (state) {
            liveStateCache.set(key, { state, expiresAt: Date.now() + LIVE_STATE_TTL_MS });
            return state;
        }
    }
    return "";
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
