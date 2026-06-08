import type { Request, Response, NextFunction } from "express";

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

export type WabaUiProfile = "production" | "full";

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
  opts: { basePath: string; uiProfile: WabaUiProfile }
): string {
  const injection = [
    opts.basePath ? buildBasePathScript(opts.basePath) : "",
    `<script>window.WABA_UI_PROFILE="${opts.uiProfile}";</script>`,
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
export function injectBasePathIntoIndexHtml(html: string, basePath: string): string {
  return injectRuntimeIntoIndexHtml(html, { basePath, uiProfile: "full" });
}
