/**
 * Contrato do Facebook Login for Business / Embedded Signup.
 * Manter o JS inline de index.html alinhado com este módulo.
 *
 * Docs:
 * - https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation/
 * - https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions
 * - https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
 * - https://developers.facebook.com/docs/graph-api/guides/versioning/
 * - https://developers.facebook.com/docs/javascript/reference/FB.init/
 *
 * Embedded Signup v4: extras só com `setup` (objeto vazio ou prefill).
 * FB.init deve usar a Graph latest: o dialog/oauth é versionado e o wizard
 * Login for Business / ES v4 não renderiza no path /v22.0/.
 */

export const META_ES_JS_SDK_GRAPH_VERSION = "v26.0";

export const META_ES_UNAVAILABLE_MESSAGE =
  "Configuração do WhatsApp Embedded Signup indisponível.";

export const META_ES_TECH_PROVIDER_PATHS = {
  config: "/integrations/meta/whatsapp/config",
  start: "/integrations/meta/whatsapp/start",
  callback: "/integrations/meta/whatsapp/callback",
  complete: "/integrations/meta/whatsapp/complete",
  confirm: "/integrations/meta/whatsapp/confirm",
} as const;

export const META_ES_LEGACY_EXCHANGE_PATHS = [
  "/meta-oficial/embedded-signup/exchange-code",
  "/api/meta/embedded-signup/exchange-code",
  "/meta/embedded-signup/exchange-code",
  "/waba-embedded-signup-exchange",
] as const;

export type MetaEsSetupPrefill = {
  business?: { id: string };
  whatsAppBusinessAccount?: { ids: string };
};

export type MetaEsFbLoginOptions = {
  config_id: string;
  response_type: "code";
  override_default_response_type: true;
  extras: { setup: MetaEsSetupPrefill };
};

export type MetaEsPublicConfig = {
  ok: boolean;
  appId?: string;
  configId?: string;
  graphVersion: string;
  callbackPath: string;
  redirectUri?: string;
};

export type MetaEsPopupDecision = {
  open: boolean;
  error?: string;
};

export type MetaEsClickPlan = {
  callFbInit: boolean;
  openGenericOauthUrl: boolean;
  openPageRedirect: boolean;
  loginOptions: MetaEsFbLoginOptions | null;
  configPath: string;
  startPath: string;
  callbackPath: string;
  completePath: string;
  confirmPath: string;
  forbiddenPaths: readonly string[];
};

export type MetaEsOauthReturn = {
  code: string;
  state: string;
  error: string;
  errorDescription: string;
  wabaId: string;
  phoneNumberId: string;
  businessId: string;
};

export const META_ES_OAUTH_STORAGE_KEY = "waba-meta-es-oauth";

/** Host do reauth (senha). */
export const META_ES_OAUTH_HOST = "web.facebook.com";

/** LaunchBridge do Embedded Signup. Só existe em business.facebook.com — web.facebook.com devolve página indisponível. */
export const META_ES_ONBOARD_ORIGIN = "https://business.facebook.com";
export const META_ES_ONBOARD_PATH = "/messaging/whatsapp/onboard/";

/** Host documentado do Login for Business (dialog/oauth). */
export const META_ES_LFB_ORIGIN = "https://www.facebook.com";

/**
 * redirect_uri do JS SDK (FB.login). Mantido só como candidato de troca do code.
 */
export const META_ES_SDK_XD_ARBITER =
  "https://staticxx.facebook.com/x/connect/xd_arbiter/?version=46";

export function readMetaConfigIdFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.META_CONFIG_ID || env.META_ES_CONFIG_ID || "").trim();
}

export function resolveMetaEsJsSdkGraphVersion(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.META_ES_JS_SDK_GRAPH_VERSION || "").trim() || META_ES_JS_SDK_GRAPH_VERSION;
}

export function resolveMetaEsConfigId(payload: { configId?: unknown } | null | undefined): string {
  return String(payload?.configId || "").trim();
}

export function configIdLast4(configId: string): string {
  const id = String(configId || "").trim();
  return id.length >= 4 ? id.slice(-4) : "";
}

export function buildMetaEsSetupPrefill(input: {
  businessId?: string;
  wabaId?: string;
}): MetaEsSetupPrefill {
  const setup: MetaEsSetupPrefill = {};
  const businessId = String(input.businessId || "").trim();
  const wabaId = String(input.wabaId || "").trim();
  // Prefill só no fluxo «adicionar número»: BM + WABA juntos.
  if (businessId && wabaId) {
    setup.business = { id: businessId };
    setup.whatsAppBusinessAccount = { ids: wabaId };
  }
  return setup;
}

export function buildMetaEsFbLoginOptions(
  configId: string,
  setup?: MetaEsSetupPrefill,
): MetaEsFbLoginOptions | null {
  const id = String(configId || "").trim();
  if (!id) return null;
  const sanitized = buildMetaEsSetupPrefill({
    businessId: setup?.business?.id,
    wabaId: setup?.whatsAppBusinessAccount?.ids,
  });
  return {
    config_id: id,
    response_type: "code",
    override_default_response_type: true,
    extras: { setup: sanitized },
  };
}

export function shouldOpenMetaEsPopup(input: {
  configId?: string;
  sdkReady?: boolean;
}): MetaEsPopupDecision {
  if (!String(input.configId || "").trim()) {
    return { open: false, error: META_ES_UNAVAILABLE_MESSAGE };
  }
  if (!input.sdkReady) {
    return { open: false, error: "SDK da Meta não carregou." };
  }
  return { open: true };
}

/** Tentativa 1 (clique) e tentativa 2 (reauth) usam as mesmas opções com config_id. */
export function resolveFbLoginOptionsForAttempt(
  configId: string,
  _attempt: 1 | 2,
): MetaEsFbLoginOptions | null {
  return buildMetaEsFbLoginOptions(configId);
}

export function mentionsMissingConfigId(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return m.includes("config_id") && (m.includes("obrigat") || m.includes("required") || m.includes("inválid") || m.includes("invalid"));
}

export function isGenericFacebookOauthUrl(url: string): boolean {
  const raw = String(url || "");
  if (!/dialog\/oauth/i.test(raw)) return false;
  try {
    const parsed = new URL(raw);
    return !String(parsed.searchParams.get("config_id") || "").trim();
  } catch {
    return !/[?&]config_id=/.test(raw);
  }
}

/**
 * Não reescrever o dialog/oauth do JS SDK. No Chrome o wizard usa FB.login.
 */
export function rewriteMetaEsOauthUrl(
  rawUrl: string,
  _input?: { configId?: string; setup?: MetaEsSetupPrefill },
): string {
  void _input;
  return rawUrl;
}

export function normalizeMetaEsRedirectUri(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.search = "";
    if (parsed.pathname === "/" || parsed.pathname === "") {
      return `${parsed.protocol}//${parsed.host}`;
    }
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

export function resolveMetaEsRedirectUri(input: {
  configRedirectUri?: string;
  locationOrigin?: string;
}): string {
  return (
    normalizeMetaEsRedirectUri(String(input.configRedirectUri || "")) ||
    normalizeMetaEsRedirectUri(String(input.locationOrigin || ""))
  );
}

/**
 * Modo estrito do App Dashboard lista `https://waba.draxsistemas.com.br/`
 * (com barra). normalize() tira a barra; o dialog do 135200 foi sem ela.
 */
export function metaEsStrictOauthRedirectUri(raw: string): string {
  const origin = resolveMetaEsRedirectUri({ configRedirectUri: raw, locationOrigin: raw });
  if (!origin) return "";
  try {
    const parsed = new URL(origin);
    if (parsed.pathname === "" || parsed.pathname === "/") {
      return `${parsed.protocol}//${parsed.host}/`;
    }
    return origin;
  } catch {
    return origin.endsWith("/") ? origin : `${origin}/`;
  }
}

export function isNativeWindowOpen(openFn: unknown): boolean {
  if (typeof openFn !== "function") return false;
  try {
    return /\[native code\]/.test(Function.prototype.toString.call(openFn));
  } catch {
    return false;
  }
}

/** Página completa só quando o caller pede; o Laboratório usa FB.login (Chrome). */
export function shouldUseMetaEsPageRedirect(input: {
  userAgent?: string;
  windowOpen?: unknown;
  globals?: Record<string, unknown> | null;
  preferPage?: boolean;
  method?: unknown;
}): boolean {
  void input.userAgent;
  void input.windowOpen;
  void input.globals;
  void input.method;
  return input.preferPage === true;
}

export function createMetaEsOauthState(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function siteHostFromMetaEsOrigin(origin: string): string {
  const value = resolveMetaEsRedirectUri({ locationOrigin: origin });
  if (!value) return "";
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

export function isMetaEsFacebookMessageOrigin(origin: string): boolean {
  const raw = String(origin || "").trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return /(?:^|\.)facebook\.com$/i.test(raw);
  }
}

export function parseMetaEsFacebookOauthMessage(data: unknown): MetaEsOauthReturn | null {
  if (data == null) return null;
  if (typeof data === "string") {
    const text = String(data).trim();
    if (!text) return null;
    if (text.charAt(0) === "{" || text.charAt(0) === "[") {
      try {
        return parseMetaEsFacebookOauthMessage(JSON.parse(text));
      } catch {
        /* query string abaixo */
      }
    }
    const queryStart = text.search(/[?#]/);
    const query = queryStart >= 0 ? text.slice(queryStart) : `?${text}`;
    const parsed = parseMetaEsOauthReturn(query);
    return parsed.code || parsed.error ? parsed : null;
  }
  if (typeof data !== "object" || Array.isArray(data)) return null;
  const rec = data as Record<string, unknown>;
  if (String(rec.type || "") === "WABA_META_ES_OAUTH_RETURN") return null;
  const auth =
    rec.authResponse && typeof rec.authResponse === "object" && !Array.isArray(rec.authResponse)
      ? (rec.authResponse as Record<string, unknown>)
      : null;
  const direct = parseMetaEsOauthReturn(
    `?code=${encodeURIComponent(String(auth?.code || rec.code || ""))}&state=${encodeURIComponent(
      String(auth?.state || rec.state || ""),
    )}&error=${encodeURIComponent(String(auth?.error || rec.error || ""))}&error_description=${encodeURIComponent(
      String(auth?.error_description || rec.error_description || rec.errorDescription || ""),
    )}`,
  );
  if (direct.code || direct.error) return direct;
  for (const key of ["result", "query", "params", "data", "payload"]) {
    const nested = parseMetaEsFacebookOauthMessage(rec[key]);
    if (nested) return nested;
  }
  return null;
}

export type MetaEsOauthDialogInput = {
  appId: string;
  configId: string;
  redirectUri: string;
  graphVersion?: string;
  setup?: MetaEsSetupPrefill;
  businessId?: string;
  wabaId?: string;
  state?: string;
  display?: "page" | "popup";
  cbt?: string | number;
  /** LFB em www.facebook.com: o next do reauth tem de ser facebook.com. */
  loginForBusiness?: boolean;
};

/**
 * Hosted ES (doc Meta): app_id, config_id, extras={"setup":{}}.
 * Não usa Página do Facebook — o Business Suite (whatsapp_accounts) exige Página
 * e não serve para essas BMs.
 */
export function buildMetaEsOauthDialogUrl(input: MetaEsOauthDialogInput): string | null {
  const appId = String(input.appId || "").trim();
  const configId = String(input.configId || "").trim();
  const siteOrigin = resolveMetaEsRedirectUri({ configRedirectUri: input.redirectUri });
  if (!appId || !configId || !siteOrigin) return null;
  const businessId = String(
    input.setup?.business?.id || input.businessId || "",
  ).trim();
  const wabaId = String(input.setup?.whatsAppBusinessAccount?.ids || input.wabaId || "").trim();
  const setup = buildMetaEsSetupPrefill({ businessId, wabaId });
  const parsed = new URL(`${META_ES_ONBOARD_ORIGIN}${META_ES_ONBOARD_PATH}`);
  parsed.searchParams.set("app_id", appId);
  parsed.searchParams.set("config_id", configId);
  parsed.searchParams.set("extras", JSON.stringify({ setup }));
  const state = String(input.state || "").trim();
  if (state) parsed.searchParams.set("state", state);
  void input.display;
  void input.cbt;
  void input.graphVersion;
  return parsed.toString();
}

export function metaEsOauthPopupFeatures(): string {
  return "popup=yes,width=1100,height=820,scrollbars=yes,resizable=yes,toolbar=yes,location=yes,menubar=no";
}

/**
 * Login for Business em display=page (doc LFB), sem JS SDK.
 * redirect_uri com barra final: Valid OAuth + Strict Mode no App Dashboard.
 */
export function buildMetaEsLoginForBusinessDialogUrl(
  input: MetaEsOauthDialogInput,
): string | null {
  const appId = String(input.appId || "").trim();
  const configId = String(input.configId || "").trim();
  const redirectUri = metaEsStrictOauthRedirectUri(input.redirectUri);
  if (!appId || !configId || !redirectUri) return null;
  const version =
    String(input.graphVersion || META_ES_JS_SDK_GRAPH_VERSION).trim() || META_ES_JS_SDK_GRAPH_VERSION;
  const businessId = String(input.setup?.business?.id || input.businessId || "").trim();
  const wabaId = String(input.setup?.whatsAppBusinessAccount?.ids || input.wabaId || "").trim();
  const setup = buildMetaEsSetupPrefill({ businessId, wabaId });
  const parsed = new URL(`${META_ES_LFB_ORIGIN}/${version}/dialog/oauth`);
  parsed.searchParams.set("client_id", appId);
  parsed.searchParams.set("redirect_uri", redirectUri);
  parsed.searchParams.set("response_type", "code");
  parsed.searchParams.set("override_default_response_type", "true");
  parsed.searchParams.set("config_id", configId);
  parsed.searchParams.set("display", "page");
  parsed.searchParams.set("extras", JSON.stringify({ setup }));
  const state = String(input.state || "").trim();
  if (state) parsed.searchParams.set("state", state);
  void input.cbt;
  return parsed.toString();
}

/**
 * Senha em reauth.php.
 * Sem loginForBusiness: web.facebook.com → Hosted ES.
 * Com loginForBusiness: www.facebook.com → LFB no mesmo host.
 * next fora do facebook.com (ex.: DRAX) é ignorado e a Meta abre home.php.
 * signed_next copia o host da senha: senha no web + LFB no www vira
 * web.facebook.com/dialog/oauth (Recurso indisponível).
 */
export function buildMetaEsOauthLaunchUrl(
  input: MetaEsOauthDialogInput,
): string | null {
  const loginForBusiness = Boolean(input.loginForBusiness);
  const dialog = loginForBusiness
    ? buildMetaEsLoginForBusinessDialogUrl(input)
    : buildMetaEsOauthDialogUrl(input);
  const appId = String(input.appId || "").trim();
  if (!dialog || !appId) return null;
  const reauthHost = loginForBusiness ? new URL(META_ES_LFB_ORIGIN).hostname : META_ES_OAUTH_HOST;
  const reauth = new URL(`https://${reauthHost}/login/reauth.php`);
  reauth.searchParams.set("app_id", appId);
  reauth.searchParams.set("signed_next", "1");
  reauth.searchParams.set("next", dialog);
  return reauth.toString();
}

function readJsonObject(raw: string): Record<string, unknown> {
  const text = String(raw || "").trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function parseMetaEsOauthReturn(search: string): MetaEsOauthReturn {
  let params: URLSearchParams;
  try {
    const raw = String(search || "");
    params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  } catch {
    params = new URLSearchParams();
  }
  const extras = readJsonObject(String(params.get("extras") || params.get("session_info") || ""));
  const nested =
    extras.data && typeof extras.data === "object" && !Array.isArray(extras.data)
      ? (extras.data as Record<string, unknown>)
      : extras;
  const wabaId = String(
    params.get("waba_id") || extras.waba_id || nested.waba_id || nested.current_waba_id || "",
  ).trim();
  const phoneNumberId = String(
    params.get("phone_number_id") ||
      extras.phone_number_id ||
      nested.phone_number_id ||
      nested.current_phone_number_id ||
      "",
  ).trim();
  const businessId = String(
    params.get("business_id") || extras.business_id || nested.business_id || "",
  ).trim();
  return {
    code: String(params.get("code") || "").trim(),
    state: String(params.get("state") || "").trim(),
    error: String(params.get("error") || "").trim(),
    errorDescription: String(params.get("error_description") || params.get("error_reason") || "").trim(),
    wabaId,
    phoneNumberId,
    businessId,
  };
}

export function stripMetaEsOauthSearch(search: string): string {
  let params: URLSearchParams;
  try {
    const raw = String(search || "");
    params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  } catch {
    return "";
  }
  [
    "code",
    "state",
    "error",
    "error_description",
    "error_reason",
    "extras",
    "session_info",
    "waba_id",
    "phone_number_id",
    "business_id",
  ].forEach((key) => params.delete(key));
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function isLegacyExchangePath(path: string): boolean {
  const raw = String(path || "");
  return META_ES_LEGACY_EXCHANGE_PATHS.some((item) => raw.includes(item));
}

/** web.facebook.com + #_rdc é redirect da Meta. */
export function describeMetaEsBrowserSurface(input: {
  userAgent?: string;
  userAgentData?: { mobile?: boolean; platform?: string } | null;
  windowOpen?: unknown;
  globals?: Record<string, unknown> | null;
}): {
  mobileHint: boolean;
  platform: string;
  usePageRedirect: boolean;
} {
  const ua = String(input.userAgent || "");
  const chMobile = Boolean(input.userAgentData && input.userAgentData.mobile === true);
  const uaMobile = /Mobile|iPhone|iPad|Android.+Mobile|IEMobile/i.test(ua);
  void input.windowOpen;
  void input.globals;
  return {
    mobileHint: chMobile || uaMobile,
    platform: String(input.userAgentData?.platform || "").trim(),
    usePageRedirect: shouldUseMetaEsPageRedirect({
      userAgent: ua,
      windowOpen: input.windowOpen,
      globals: input.globals,
    }),
  };
}

export function toPublicMetaEsConfig(input: {
  appId?: string;
  configId?: string;
  graphVersion?: string;
  redirectUri?: string;
  appSecret?: string;
  accessToken?: string;
  encryptionKey?: string;
}): MetaEsPublicConfig {
  const appId = String(input.appId || "").trim();
  const configId = String(input.configId || "").trim();
  const redirectUri = resolveMetaEsRedirectUri({ configRedirectUri: input.redirectUri });
  return {
    ok: Boolean(appId && configId),
    appId: appId || undefined,
    configId: configId || undefined,
    graphVersion:
      String(input.graphVersion || resolveMetaEsJsSdkGraphVersion()).trim() || META_ES_JS_SDK_GRAPH_VERSION,
    callbackPath: META_ES_TECH_PROVIDER_PATHS.callback,
    redirectUri: redirectUri || undefined,
  };
}

export function planMetaEsTechProviderClick(configId: string): MetaEsClickPlan {
  return {
    callFbInit: false,
    openGenericOauthUrl: false,
    openPageRedirect: false,
    loginOptions: buildMetaEsFbLoginOptions(configId),
    configPath: META_ES_TECH_PROVIDER_PATHS.config,
    startPath: META_ES_TECH_PROVIDER_PATHS.start,
    callbackPath: META_ES_TECH_PROVIDER_PATHS.callback,
    completePath: META_ES_TECH_PROVIDER_PATHS.complete,
    confirmPath: META_ES_TECH_PROVIDER_PATHS.confirm,
    forbiddenPaths: META_ES_LEGACY_EXCHANGE_PATHS,
  };
}
