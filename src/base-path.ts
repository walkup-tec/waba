import type { Request, Response, NextFunction } from "express";
import { isWabaDisparadorProductionContainer } from "./waba-container-service";

/** Prefixo público (ex.: /version-01). Vazio = raiz (produção). */
export function normalizeBasePath(raw: string): string {
  const s = String(raw || "").trim();
  if (!s || s === "/") return "";
  const withSlash = s.startsWith("/") ? s : `/${s}`;
  return withSlash.replace(/\/+$/, "");
}

export const BASE_PATH = normalizeBasePath(process.env.WABA_BASE_PATH || "");

export function stripBasePathMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!BASE_PATH) return next();
  const p = req.path || "/";
  if (p === BASE_PATH || p.startsWith(`${BASE_PATH}/`)) {
    (req as Request & { underBasePath?: boolean }).underBasePath = true;
    const rest = p.slice(BASE_PATH.length) || "/";
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    req.url = rest + qs;
  }
  next();
}

export function requestUnderBasePath(req: Request): boolean {
  return Boolean((req as Request & { underBasePath?: boolean }).underBasePath);
}

export type WabaUiProfile = "production" | "full" | "baseline";

export type WabaClientFeatureFlags = {
  alternativaNumbersPurchase: boolean;
  metaOfficialPortfolioLab?: boolean;
};

export type WabaClientRuntimeInject = {
  basePath: string;
  uiProfile: WabaUiProfile;
  featureFlags?: WabaClientFeatureFlags;
  deployResilienceEnabled?: boolean;
};

export function resolveDeployResilienceForClient(): boolean {
  const explicit = String(process.env.WABA_DEPLOY_RESILIENCE || "")
    .trim()
    .toLowerCase();
  if (["0", "false", "off", "no"].includes(explicit)) return false;
  if (["1", "true", "on", "yes"].includes(explicit)) {
    return isWabaDisparadorProductionContainer();
  }
  return isWabaDisparadorProductionContainer();
}

/** Chave de cache da shell HTML — deve coincidir com media/sw-deploy-resilience.js */
export function resolveShellCacheKey(uiProfile: WabaUiProfile, basePath: string = BASE_PATH): string {
  const normalizedBase = normalizeBasePath(basePath);
  if (!normalizedBase) return "waba-shell-production-root";
  const slug = normalizedBase.replace(/^\//, "").replace(/\//g, "-");
  if (uiProfile === "baseline") return `waba-shell-baseline-${slug}`;
  return `waba-shell-${uiProfile}-${slug}`;
}

function buildBasePathScript(basePath: string): string {
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

export function injectRuntimeIntoIndexHtml(
  html: string,
  opts: {
    basePath: string;
    uiProfile: WabaUiProfile;
    featureFlags?: WabaClientFeatureFlags;
    deployResilienceEnabled?: boolean;
  }
): string {
  const featureFlagsJson = JSON.stringify(
    opts.featureFlags ?? { alternativaNumbersPurchase: false, metaOfficialPortfolioLab: false },
  );
  const deployResilienceEnabled =
    typeof opts.deployResilienceEnabled === "boolean"
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
  return patchMetaTplGraphQuotaHtml(patchMetaTplHeaderUploadOnce(out));
}

/** HTML grande não sobe no Contents API; o front antigo ainda faz upload por conexão. */
export function patchMetaTplHeaderUploadOnce(html: string): string {
  const from =
    "for (let i = 0; i < connectionIds.length; i += 1) {\n            const uploaded = await metaTplAiUploadHeaderIfNeeded(connectionIds[i], shell.mediaFormat);\n            if (uploaded) headerHandles[connectionIds[i]] = uploaded;\n            if (uploaded && !headerHandle) headerHandle = uploaded;\n          }";
  if (!html.includes(from)) return html;
  const to =
    'const uploaded = await metaTplAiUploadHeaderIfNeeded(connectionId, shell.mediaFormat);\n          headerHandle = uploaded || "";\n          for (let i = 0; i < connectionIds.length; i += 1) {\n            if (headerHandle) headerHandles[connectionIds[i]] = headerHandle;\n          }';
  return html.replace(from, to);
}

/** Reduz chamadas Graph enquanto a cota do app está fechada (código 4). */
export function patchMetaTplGraphQuotaHtml(html: string): string {
  let out = html.replace("const META_TP_LIVE_MS = 2500;", "const META_TP_LIVE_MS = 180000;");
  const bootFrom =
    "if (document.getElementById(\"tab-whatsapp-oficial\")) {\n        metaTpShowPortfolioLoading();\n        metaTpStartLiveSync();\n        if (typeof window.wabaRefreshMetaWhatsappStatus === \"function\") {\n          window.wabaRefreshMetaWhatsappStatus();\n        }\n      }";
  const bootTo =
    "if (document.getElementById(\"tab-whatsapp-oficial\")) {\n        metaTpStartLiveSync();\n        if (metaTpLabTabVisible()) {\n          metaTpShowPortfolioLoading();\n          if (typeof window.wabaRefreshMetaWhatsappStatus === \"function\") {\n            window.wabaRefreshMetaWhatsappStatus();\n          }\n        }\n      }";
  if (out.includes(bootFrom)) out = out.replace(bootFrom, bootTo);
  const loadFrom =
    "if (typeof metaTpLoadPortfolio === \"function\") {\n          await metaTpLoadPortfolio({ silent: true }).catch(() => null);";
  const loadTo =
    "if (\n          typeof metaTpLoadPortfolio === \"function\" &&\n          !(metaTpSession.portfolios && metaTpSession.portfolios.length)\n        ) {\n          await metaTpLoadPortfolio({ silent: true }).catch(() => null);";
  if (out.includes(loadFrom)) out = out.replace(loadFrom, loadTo);
  return out;
}

/** @deprecated use injectRuntimeIntoIndexHtml */
export function injectBasePathIntoIndexHtml(html: string, basePath: string): string {
  return injectRuntimeIntoIndexHtml(html, { basePath, uiProfile: "full" });
}
