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
};

export type MetaEsPopupDecision = {
  open: boolean;
  error?: string;
};

export type MetaEsClickPlan = {
  callFbInit: boolean;
  openGenericOauthUrl: boolean;
  loginOptions: MetaEsFbLoginOptions | null;
  configPath: string;
  startPath: string;
  callbackPath: string;
  completePath: string;
  confirmPath: string;
  forbiddenPaths: readonly string[];
};

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
  // Só BM (card AdsPower com WABA —) quebra o Login for Business (Recurso indisponível).
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
 * O SDK abre web.facebook.com (barra do popup travada no AdsPower) e, neste hop,
 * o dialog/oauth chega só com app_id/cbt/channel_url — sem config_id. Sem config_id
 * a Meta trata como Facebook Login comum e responde Recurso indisponível.
 * Encrypted query: só troca o host. Não injeta params no blob.
 */
export function rewriteMetaEsOauthUrl(
  rawUrl: string,
  input: { configId?: string; setup?: MetaEsSetupPrefill },
): string {
  const raw = String(rawUrl || "").trim();
  if (!raw || !/dialog\/oauth/i.test(raw)) return rawUrl;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return rawUrl;
  }
  if (!/facebook\.com$/i.test(parsed.hostname)) return rawUrl;
  if (/^(web|m|mobile)\./i.test(parsed.hostname)) {
    parsed.hostname = "www.facebook.com";
  }
  const encrypted = String(parsed.searchParams.get("encrypted_query_string") || "").trim();
  const configId = String(input.configId || "").trim();
  if (!encrypted && configId && !String(parsed.searchParams.get("config_id") || "").trim()) {
    parsed.searchParams.set("config_id", configId);
    parsed.searchParams.set("response_type", "code");
    parsed.searchParams.set("override_default_response_type", "true");
    if (!String(parsed.searchParams.get("extras") || "").trim()) {
      const setup = buildMetaEsSetupPrefill({
        businessId: input.setup?.business?.id,
        wabaId: input.setup?.whatsAppBusinessAccount?.ids,
      });
      parsed.searchParams.set("extras", JSON.stringify({ setup }));
    }
  }
  return parsed.toString();
}

export function isLegacyExchangePath(path: string): boolean {
  const raw = String(path || "");
  return META_ES_LEGACY_EXCHANGE_PATHS.some((item) => raw.includes(item));
}

/** web.facebook.com + #_rdc é redirect da Meta, não um recurso nativo do AdsPower. */
export function describeMetaEsBrowserSurface(input: {
  userAgent?: string;
  userAgentData?: { mobile?: boolean; platform?: string } | null;
}): {
  mobileHint: boolean;
  platform: string;
  adsPowerNativeWebHost: false;
} {
  const ua = String(input.userAgent || "");
  const chMobile = Boolean(input.userAgentData && input.userAgentData.mobile === true);
  const uaMobile = /Mobile|iPhone|iPad|Android.+Mobile|IEMobile/i.test(ua);
  return {
    mobileHint: chMobile || uaMobile,
    platform: String(input.userAgentData?.platform || "").trim(),
    adsPowerNativeWebHost: false,
  };
}

export function toPublicMetaEsConfig(input: {
  appId?: string;
  configId?: string;
  graphVersion?: string;
  appSecret?: string;
  accessToken?: string;
  encryptionKey?: string;
}): MetaEsPublicConfig {
  const appId = String(input.appId || "").trim();
  const configId = String(input.configId || "").trim();
  return {
    ok: Boolean(appId && configId),
    appId: appId || undefined,
    configId: configId || undefined,
    graphVersion:
      String(input.graphVersion || resolveMetaEsJsSdkGraphVersion()).trim() || META_ES_JS_SDK_GRAPH_VERSION,
    callbackPath: META_ES_TECH_PROVIDER_PATHS.callback,
  };
}

export function planMetaEsTechProviderClick(configId: string): MetaEsClickPlan {
  return {
    callFbInit: false,
    openGenericOauthUrl: false,
    loginOptions: buildMetaEsFbLoginOptions(configId),
    configPath: META_ES_TECH_PROVIDER_PATHS.config,
    startPath: META_ES_TECH_PROVIDER_PATHS.start,
    callbackPath: META_ES_TECH_PROVIDER_PATHS.callback,
    completePath: META_ES_TECH_PROVIDER_PATHS.complete,
    confirmPath: META_ES_TECH_PROVIDER_PATHS.confirm,
    forbiddenPaths: META_ES_LEGACY_EXCHANGE_PATHS,
  };
}
