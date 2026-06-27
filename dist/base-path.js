"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_PATH = void 0;
exports.normalizeBasePath = normalizeBasePath;
exports.stripBasePathMiddleware = stripBasePathMiddleware;
exports.requestUnderBasePath = requestUnderBasePath;
exports.resolveDeployResilienceForClient = resolveDeployResilienceForClient;
exports.resolveShellCacheKey = resolveShellCacheKey;
exports.injectRuntimeIntoIndexHtml = injectRuntimeIntoIndexHtml;
exports.injectBasePathIntoIndexHtml = injectBasePathIntoIndexHtml;
/** Prefixo público (ex.: /version-01). Vazio = raiz (produção). */
function normalizeBasePath(raw) {
    const s = String(raw || "").trim();
    if (!s || s === "/")
        return "";
    const withSlash = s.startsWith("/") ? s : `/${s}`;
    return withSlash.replace(/\/+$/, "");
}
exports.BASE_PATH = normalizeBasePath(process.env.WABA_BASE_PATH || "");
function stripBasePathMiddleware(req, _res, next) {
    if (!exports.BASE_PATH)
        return next();
    const p = req.path || "/";
    if (p === exports.BASE_PATH || p.startsWith(`${exports.BASE_PATH}/`)) {
        req.underBasePath = true;
        const rest = p.slice(exports.BASE_PATH.length) || "/";
        const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        req.url = rest + qs;
    }
    next();
}
function requestUnderBasePath(req) {
    return Boolean(req.underBasePath);
}
function resolveDeployResilienceForClient() {
    const explicit = String(process.env.WABA_DEPLOY_RESILIENCE || "")
        .trim()
        .toLowerCase();
    if (["0", "false", "off", "no"].includes(explicit))
        return false;
    if (["1", "true", "on", "yes"].includes(explicit))
        return true;
    const runtimeMode = String(process.env.RUNTIME_MODE || "production").toLowerCase();
    if (runtimeMode === "development")
        return false;
    const wabaEnv = String(process.env.WABA_ENV || "")
        .trim()
        .toLowerCase();
    if (wabaEnv === "v01" || wabaEnv === "v02")
        return false;
    const entry = String(process.argv[1] || "");
    if (/\.ts$/i.test(entry))
        return false;
    return runtimeMode === "production";
}
/** Chave de cache da shell HTML — deve coincidir com media/sw-deploy-resilience.js */
function resolveShellCacheKey(uiProfile, basePath = exports.BASE_PATH) {
    const normalizedBase = normalizeBasePath(basePath);
    if (!normalizedBase)
        return "waba-shell-production-root";
    const slug = normalizedBase.replace(/^\//, "").replace(/\//g, "-");
    if (uiProfile === "baseline")
        return `waba-shell-baseline-${slug}`;
    return `waba-shell-${uiProfile}-${slug}`;
}
function buildBasePathScript(basePath) {
    const safe = basePath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `<meta name="waba-base-path" content="${basePath}" />
<script>
window.WABA_BASE_PATH="${safe}";
(function () {
  var base = (window.WABA_BASE_PATH || "").replace(/\\/$/, "");
  if (!base) return;
  var orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.charAt(0) === "/" && input.indexOf(base + "/") !== 0 && input !== base) {
      input = base + input;
    }
    return orig(input, init);
  };
})();
</script>`;
}
function injectRuntimeIntoIndexHtml(html, opts) {
    const featureFlagsJson = JSON.stringify(opts.featureFlags ?? { alternativaNumbersPurchase: false });
    const deployResilienceEnabled = typeof opts.deployResilienceEnabled === "boolean"
        ? opts.deployResilienceEnabled
        : resolveDeployResilienceForClient();
    const injection = [
        opts.basePath ? buildBasePathScript(opts.basePath) : "",
        `<script>window.WABA_UI_PROFILE="${opts.uiProfile}";</script>`,
        `<script>window.WABA_FEATURE_FLAGS=${featureFlagsJson};</script>`,
        `<script>window.WABA_DEPLOY_RESILIENCE_ENABLED=${deployResilienceEnabled ? "true" : "false"};</script>`,
    ]
        .filter(Boolean)
        .join("\n");
    let out = html.includes("<head>")
        ? html.replace("<head>", `<head>\n${injection}`)
        : injection + html;
    if (opts.basePath) {
        out = out
            .replace(/href="\//g, `href="${opts.basePath}/`)
            .replace(/src="\//g, `src="${opts.basePath}/`);
    }
    return out;
}
/** @deprecated use injectRuntimeIntoIndexHtml */
function injectBasePathIntoIndexHtml(html, basePath) {
    return injectRuntimeIntoIndexHtml(html, { basePath, uiProfile: "full" });
}
