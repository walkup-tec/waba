"use strict";
/** Página pública de manutenção (landings comerciais). Não desliga API, webhooks nem o painel. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_LANDING_MAINTENANCE_MESSAGE = void 0;
exports.isPublicLandingMaintenanceEnabled = isPublicLandingMaintenanceEnabled;
exports.normalizeRequestHostname = normalizeRequestHostname;
exports.resolvePublicLandingHosts = resolvePublicLandingHosts;
exports.isPublicMarketingHost = isPublicMarketingHost;
exports.isPublicLandingPath = isPublicLandingPath;
exports.requestLooksLikePublicLanding = requestLooksLikePublicLanding;
exports.renderPublicMaintenanceHtml = renderPublicMaintenanceHtml;
exports.PUBLIC_LANDING_MAINTENANCE_MESSAGE = "Site em manutenção, temporariamente indisponível. Aguarde, em breve novidades!";
const DEFAULT_PUBLIC_LANDING_HOSTS = [
    "wabadisparos.com.br",
    "www.wabadisparos.com.br",
    "wabadisparador.com.br",
    "www.wabadisparador.com.br",
    "bet.waba.info",
    "www.bet.waba.info",
    "bets.waba.info",
    "www.bets.waba.info",
    "waba-paginadevendas.achpyp.easypanel.host",
    "waba-bets-pv.achpyp.easypanel.host",
];
const PUBLIC_LANDING_PATHS = new Set(["/vendas", "/cadastro", "/bets"]);
function isPublicLandingMaintenanceEnabled() {
    const raw = String(process.env.PUBLIC_LANDING_MAINTENANCE ?? "1")
        .trim()
        .toLowerCase();
    return ["1", "true", "yes", "on"].includes(raw);
}
function normalizeRequestHostname(rawHost) {
    return String(rawHost || "")
        .split(",")[0]
        .trim()
        .toLowerCase()
        .replace(/:\d+$/, "");
}
function resolvePublicLandingHosts() {
    const extra = String(process.env.PUBLIC_LANDING_MAINTENANCE_HOSTS || "")
        .split(",")
        .map((part) => normalizeRequestHostname(part))
        .filter(Boolean);
    return [...new Set([...DEFAULT_PUBLIC_LANDING_HOSTS, ...extra])];
}
function isPublicMarketingHost(rawHost) {
    const host = normalizeRequestHostname(rawHost);
    if (!host)
        return false;
    return resolvePublicLandingHosts().includes(host);
}
function isPublicLandingPath(reqPath) {
    const p = String(reqPath || "/").replace(/\/+$/, "") || "/";
    return PUBLIC_LANDING_PATHS.has(p);
}
function requestLooksLikePublicLanding(input) {
    const host = normalizeRequestHostname(input.forwardedHost || input.host || "");
    return isPublicMarketingHost(host) || isPublicLandingPath(input.path || "/");
}
function renderPublicMaintenanceHtml(message = exports.PUBLIC_LANDING_MAINTENANCE_MESSAGE) {
    const safe = String(message || exports.PUBLIC_LANDING_MAINTENANCE_MESSAGE).replace(/</g, "&lt;");
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Site em manutenção</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="description" content="${safe}" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background:
        radial-gradient(1200px 500px at 50% -10%, rgba(251, 191, 36, 0.16), transparent 55%),
        linear-gradient(180deg, #101318 0%, #07090c 100%);
      color: #f4f1ea;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.25rem;
    }
    .card {
      width: min(36rem, 100%);
      text-align: center;
      background: rgba(16, 19, 24, 0.78);
      border: 1px solid rgba(251, 191, 36, 0.22);
      border-radius: 1.5rem;
      padding: 2.25rem 1.5rem 2rem;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    }
    .art { width: min(280px, 78vw); height: auto; margin: 0 auto 1.35rem; display: block; }
    h1 {
      margin: 0 0 0.75rem;
      font-size: clamp(1.35rem, 4vw, 1.85rem);
      line-height: 1.2;
      font-weight: 800;
    }
    p {
      margin: 0;
      font-size: 1.05rem;
      line-height: 1.55;
      color: rgba(244, 241, 234, 0.86);
    }
  </style>
</head>
<body>
  <main class="card">
    <svg class="art" viewBox="0 0 280 200" role="img" aria-label="Cavalete e cone de obra">
      <rect x="18" y="168" width="244" height="10" rx="5" fill="#1b222b"/>
      <g transform="translate(168,18)">
        <polygon points="46,150 54,42 74,42 82,150" fill="#f97316"/>
        <polygon points="54,42 64,18 74,42" fill="#fb923c"/>
        <rect x="49" y="58" width="30" height="14" transform="rotate(-2 64 65)" fill="#f8fafc"/>
        <rect x="47" y="92" width="34" height="14" transform="rotate(-2 64 99)" fill="#f8fafc"/>
        <rect x="44" y="126" width="40" height="16" transform="rotate(-2 64 134)" fill="#f8fafc"/>
        <ellipse cx="64" cy="150" rx="28" ry="8" fill="#7c2d12"/>
      </g>
      <g transform="translate(28,36)">
        <rect x="18" y="18" width="14" height="132" rx="4" transform="rotate(-18 25 84)" fill="#3f3f46"/>
        <rect x="108" y="18" width="14" height="132" rx="4" transform="rotate(18 115 84)" fill="#3f3f46"/>
        <rect x="8" y="58" width="124" height="38" rx="6" fill="#111827"/>
        <rect x="8" y="58" width="124" height="38" rx="6" fill="url(#stripes)"/>
        <rect x="8" y="58" width="124" height="38" rx="6" fill="none" stroke="#fbbf24" stroke-width="3"/>
      </g>
      <defs>
        <pattern id="stripes" width="18" height="38" patternUnits="userSpaceOnUse" patternTransform="skewX(-28)">
          <rect width="18" height="38" fill="#111827"/>
          <rect width="9" height="38" fill="#fbbf24"/>
        </pattern>
      </defs>
    </svg>
    <h1>Site em manutenção</h1>
    <p>${safe}</p>
  </main>
</body>
</html>
`;
}
