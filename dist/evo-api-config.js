"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePrimaryEvoApiBase = resolvePrimaryEvoApiBase;
exports.resolveEvoApiBaseCandidates = resolveEvoApiBaseCandidates;
exports.rewriteEvoUrlWithBase = rewriteEvoUrlWithBase;
exports.shouldFailoverToNextEvoBase = shouldFailoverToNextEvoBase;
exports.evoHttpRequestWithBaseFailover = evoHttpRequestWithBaseFailover;
const evo_http_client_1 = require("./evo-http.client");
const normalizeEvoApiBase = (raw) => String(raw || "").trim().replace(/\/$/, "");
function resolvePrimaryEvoApiBase() {
    return normalizeEvoApiBase(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080");
}
/** Bases em ordem: primária → fallback explícito → host Docker (produção). */
function resolveEvoApiBaseCandidates() {
    const primary = resolvePrimaryEvoApiBase();
    const explicitFallback = normalizeEvoApiBase(process.env.EVO_API_FALLBACK_URL || "");
    const dockerHost = normalizeEvoApiBase(process.env.EVO_DOCKER_HOST_URL || "http://172.17.0.1:30181");
    const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
    const container = String(process.env.WABA_CONTAINER_SERVICE ?? "").trim().toLowerCase();
    const isProdLike = runtime === "production" || container === "waba_disparador";
    const ordered = [primary];
    if (explicitFallback && explicitFallback !== primary)
        ordered.push(explicitFallback);
    if (isProdLike && dockerHost && dockerHost !== primary && dockerHost !== explicitFallback) {
        ordered.push(dockerHost);
    }
    const seen = new Set();
    return ordered.filter((base) => {
        if (!base || seen.has(base))
            return false;
        seen.add(base);
        return true;
    });
}
function rewriteEvoUrlWithBase(url, base) {
    try {
        const parsed = new URL(url);
        const baseParsed = new URL(base);
        parsed.protocol = baseParsed.protocol;
        parsed.hostname = baseParsed.hostname;
        parsed.port = baseParsed.port;
        return parsed.toString();
    }
    catch {
        return url;
    }
}
function shouldFailoverToNextEvoBase(result) {
    if (result.ok)
        return false;
    if (result.status === 404 || result.status === 401 || result.status === 403)
        return false;
    const hay = `${result.body || ""} ${result.error || ""}`.toLowerCase();
    if (result.status === 0)
        return true;
    if (result.status >= 502 && result.status <= 504)
        return true;
    if (result.status === 500) {
        if (hay.includes("integrationsession") ||
            hay.includes("prisma") ||
            hay.includes("prismaclient")) {
            return false;
        }
        return hay.includes("bad gateway") || hay.includes("gateway") || hay.includes("traefik");
    }
    return (hay.includes("econnrefused") ||
        hay.includes("econnreset") ||
        hay.includes("socket hang up") ||
        hay.includes("fetch failed") ||
        hay.includes("timeout"));
}
async function evoHttpRequestWithBaseFailover(url, method, options) {
    const bases = resolveEvoApiBaseCandidates();
    let last = {
        ok: false,
        status: 0,
        body: "",
        json: null,
        error: "Sistema WABA - Drax sem resposta.",
    };
    let baseUsed = bases[0] || resolvePrimaryEvoApiBase();
    for (let index = 0; index < bases.length; index += 1) {
        const base = bases[index];
        const targetUrl = rewriteEvoUrlWithBase(url, base);
        baseUsed = base;
        last = await (0, evo_http_client_1.evoHttpRequest)(targetUrl, method, options);
        if (!shouldFailoverToNextEvoBase(last) || index >= bases.length - 1) {
            break;
        }
        const nextBase = bases[index + 1];
        console.warn(`[evo] failover ${(0, evo_http_client_1.describeEvoApiBaseForOps)(base)} (HTTP ${last.status}) → ${(0, evo_http_client_1.describeEvoApiBaseForOps)(nextBase)}`);
    }
    return { ...last, evoApiBaseUsed: baseUsed };
}
