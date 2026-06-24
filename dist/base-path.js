"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_PATH = void 0;
exports.normalizeBasePath = normalizeBasePath;
exports.stripBasePathMiddleware = stripBasePathMiddleware;
exports.requestUnderBasePath = requestUnderBasePath;
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
    const injection = [
        opts.basePath ? buildBasePathScript(opts.basePath) : "",
        `<script>window.WABA_UI_PROFILE="${opts.uiProfile}";</script>`,
        `<script>window.WABA_FEATURE_FLAGS=${featureFlagsJson};</script>`,
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
