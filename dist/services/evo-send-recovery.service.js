"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEvoSendInternalDbError = isEvoSendInternalDbError;
exports.isEvoSendTransientError = isEvoSendTransientError;
exports.extractEvoInstanceFromSendTextUrl = extractEvoInstanceFromSendTextUrl;
exports.restartEvoInstanceLight = restartEvoInstanceLight;
exports.recoverEvoSendTextAfterFailure = recoverEvoSendTextAfterFailure;
exports.resolveEvoInstancesUrl = resolveEvoInstancesUrl;
const evo_http_client_1 = require("../evo-http.client");
const evo_api_config_1 = require("../evo-api-config");
const evo_connection_state_service_1 = require("../instances/evo-connection-state.service");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
function isEvoSendInternalDbError(detail, status) {
    const text = String(detail || "").toLowerCase();
    if (status >= 500) {
        return (text.includes("integrationsession") ||
            text.includes("prisma") ||
            text.includes("prismaclient") ||
            text.includes("internal server error"));
    }
    return false;
}
function isEvoSendTransientError(detail, status) {
    if (status === 0 || status === 429 || (status >= 500 && status <= 504))
        return true;
    const text = String(detail || "").toLowerCase();
    return (text.includes("connection closed") ||
        text.includes("timeout") ||
        text.includes("econnreset") ||
        text.includes("socket hang up") ||
        text.includes("integrationsession") ||
        text.includes("prisma") ||
        text.includes("internal server error"));
}
function extractEvoInstanceFromSendTextUrl(url) {
    const match = String(url || "").match(/\/sendText\/([^/?#]+)/i);
    if (!match?.[1])
        return "";
    try {
        return decodeURIComponent(match[1]).trim();
    }
    catch {
        return String(match[1]).trim();
    }
}
/** Reinicia sessão WhatsApp na Evolution sem logout (preserva pareamento). */
async function restartEvoInstanceLight(instanceName, apiKey) {
    const name = String(instanceName || "").trim();
    if (!name)
        return false;
    const enc = encodeURIComponent(name);
    const bases = (0, evo_api_config_1.resolveEvoApiBaseCandidates)();
    for (const base of bases) {
        const url = `${base}/instance/restart/${enc}`;
        const result = await (0, evo_http_client_1.evoHttpRequest)(url, "POST", {
            apiKey,
            timeoutMs: 20000,
            retries: 1,
        });
        if (result.ok || (result.status >= 200 && result.status < 300)) {
            (0, evo_connection_state_service_1.invalidateEvoLiveStateCache)(name);
            console.warn(`[evo] restart leve OK: ${name} via ${base}`);
            return true;
        }
    }
    console.warn(`[evo] restart leve falhou para ${name}`);
    return false;
}
async function recoverEvoSendTextAfterFailure(input) {
    const instanceName = extractEvoInstanceFromSendTextUrl(input.url);
    if (!instanceName) {
        return { ok: false, status: input.status, body: input.detail, json: null };
    }
    if (!isEvoSendInternalDbError(input.detail, input.status)) {
        return { ok: false, status: input.status, body: input.detail, json: null };
    }
    console.warn(`[evo] sendText HTTP ${input.status} (${instanceName}) — tentando restart + reenvio único.`);
    const restarted = await restartEvoInstanceLight(instanceName, input.apiKey);
    if (!restarted) {
        return { ok: false, status: input.status, body: input.detail, json: null };
    }
    await sleep(4000);
    (0, evo_connection_state_service_1.invalidateEvoLiveStateCache)(instanceName);
    const retry = await (0, evo_api_config_1.evoHttpRequestWithBaseFailover)(input.url, "POST", {
        apiKey: input.apiKey,
        body: input.body,
        timeoutMs: input.timeoutMs,
        retries: 2,
    });
    const mergedBody = retry.error
        ? [retry.error, retry.body].filter(Boolean).join(" | ")
        : retry.body;
    return {
        ok: retry.ok,
        status: retry.status,
        body: mergedBody,
        json: retry.json,
        error: retry.error,
    };
}
function resolveEvoInstancesUrl() {
    const base = (0, evo_api_config_1.resolvePrimaryEvoApiBase)();
    return (String(process.env.EVO_INSTANCES_URL || "").trim() ||
        `${base}/instance/fetchInstances`);
}
