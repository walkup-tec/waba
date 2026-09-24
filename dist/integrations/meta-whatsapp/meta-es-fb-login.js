"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_ES_CONNECT_METHOD_STORAGE_KEY = exports.META_ES_CONNECT_METHODS = exports.META_ES_SDK_XD_ARBITER = exports.META_ES_LFB_ORIGIN = exports.META_ES_ONBOARD_PATH = exports.META_ES_ONBOARD_ORIGIN = exports.META_ES_OAUTH_HOST = exports.META_ES_OAUTH_STORAGE_KEY = exports.META_ES_LEGACY_EXCHANGE_PATHS = exports.META_ES_TECH_PROVIDER_PATHS = exports.META_ES_UNAVAILABLE_MESSAGE = exports.META_ES_JS_SDK_GRAPH_VERSION = void 0;
exports.readMetaConfigIdFromEnv = readMetaConfigIdFromEnv;
exports.resolveMetaEsJsSdkGraphVersion = resolveMetaEsJsSdkGraphVersion;
exports.resolveMetaEsConfigId = resolveMetaEsConfigId;
exports.configIdLast4 = configIdLast4;
exports.buildMetaEsSetupPrefill = buildMetaEsSetupPrefill;
exports.buildMetaEsFbLoginOptions = buildMetaEsFbLoginOptions;
exports.shouldOpenMetaEsPopup = shouldOpenMetaEsPopup;
exports.resolveFbLoginOptionsForAttempt = resolveFbLoginOptionsForAttempt;
exports.mentionsMissingConfigId = mentionsMissingConfigId;
exports.isGenericFacebookOauthUrl = isGenericFacebookOauthUrl;
exports.rewriteMetaEsOauthUrl = rewriteMetaEsOauthUrl;
exports.normalizeMetaEsRedirectUri = normalizeMetaEsRedirectUri;
exports.resolveMetaEsRedirectUri = resolveMetaEsRedirectUri;
exports.metaEsStrictOauthRedirectUri = metaEsStrictOauthRedirectUri;
exports.isNativeWindowOpen = isNativeWindowOpen;
exports.isAdsPowerLikeBrowser = isAdsPowerLikeBrowser;
exports.parseMetaEsConnectMethod = parseMetaEsConnectMethod;
exports.resolveMetaEsConnectMethod = resolveMetaEsConnectMethod;
exports.metaEsConnectMethodUsesPageRedirect = metaEsConnectMethodUsesPageRedirect;
exports.metaEsConnectMethodUsesLoginForBusiness = metaEsConnectMethodUsesLoginForBusiness;
exports.shouldUseMetaEsPageRedirect = shouldUseMetaEsPageRedirect;
exports.createMetaEsOauthState = createMetaEsOauthState;
exports.siteHostFromMetaEsOrigin = siteHostFromMetaEsOrigin;
exports.isMetaEsFacebookMessageOrigin = isMetaEsFacebookMessageOrigin;
exports.parseMetaEsFacebookOauthMessage = parseMetaEsFacebookOauthMessage;
exports.buildMetaEsOauthDialogUrl = buildMetaEsOauthDialogUrl;
exports.metaEsOauthPopupFeatures = metaEsOauthPopupFeatures;
exports.buildMetaEsLoginForBusinessDialogUrl = buildMetaEsLoginForBusinessDialogUrl;
exports.buildMetaEsOauthLaunchUrl = buildMetaEsOauthLaunchUrl;
exports.parseMetaEsOauthReturn = parseMetaEsOauthReturn;
exports.stripMetaEsOauthSearch = stripMetaEsOauthSearch;
exports.isLegacyExchangePath = isLegacyExchangePath;
exports.describeMetaEsBrowserSurface = describeMetaEsBrowserSurface;
exports.toPublicMetaEsConfig = toPublicMetaEsConfig;
exports.planMetaEsTechProviderClick = planMetaEsTechProviderClick;
exports.META_ES_JS_SDK_GRAPH_VERSION = "v26.0";
exports.META_ES_UNAVAILABLE_MESSAGE = "Configuração do WhatsApp Embedded Signup indisponível.";
exports.META_ES_TECH_PROVIDER_PATHS = {
    config: "/integrations/meta/whatsapp/config",
    start: "/integrations/meta/whatsapp/start",
    callback: "/integrations/meta/whatsapp/callback",
    complete: "/integrations/meta/whatsapp/complete",
    confirm: "/integrations/meta/whatsapp/confirm",
};
exports.META_ES_LEGACY_EXCHANGE_PATHS = [
    "/meta-oficial/embedded-signup/exchange-code",
    "/api/meta/embedded-signup/exchange-code",
    "/meta/embedded-signup/exchange-code",
    "/waba-embedded-signup-exchange",
];
exports.META_ES_OAUTH_STORAGE_KEY = "waba-meta-es-oauth";
/** Host do reauth (senha). */
exports.META_ES_OAUTH_HOST = "web.facebook.com";
/** LaunchBridge do Embedded Signup. Só existe em business.facebook.com — web.facebook.com devolve página indisponível. */
exports.META_ES_ONBOARD_ORIGIN = "https://business.facebook.com";
exports.META_ES_ONBOARD_PATH = "/messaging/whatsapp/onboard/";
/**
 * Host documentado do Login for Business (dialog/oauth).
 * business.facebook.com/v26.0/dialog/oauth com config_id em claro ainda
 * devolveu Recurso indisponível no SunBrowser (marker 135200).
 */
exports.META_ES_LFB_ORIGIN = "https://www.facebook.com";
/**
 * redirect_uri do JS SDK (FB.login). Mantido só como candidato de troca do code.
 */
exports.META_ES_SDK_XD_ARBITER = "https://staticxx.facebook.com/x/connect/xd_arbiter/?version=46";
function readMetaConfigIdFromEnv(env = process.env) {
    return String(env.META_CONFIG_ID || env.META_ES_CONFIG_ID || "").trim();
}
function resolveMetaEsJsSdkGraphVersion(env = process.env) {
    return String(env.META_ES_JS_SDK_GRAPH_VERSION || "").trim() || exports.META_ES_JS_SDK_GRAPH_VERSION;
}
function resolveMetaEsConfigId(payload) {
    return String(payload?.configId || "").trim();
}
function configIdLast4(configId) {
    const id = String(configId || "").trim();
    return id.length >= 4 ? id.slice(-4) : "";
}
function buildMetaEsSetupPrefill(input) {
    const setup = {};
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
function buildMetaEsFbLoginOptions(configId, setup) {
    const id = String(configId || "").trim();
    if (!id)
        return null;
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
function shouldOpenMetaEsPopup(input) {
    if (!String(input.configId || "").trim()) {
        return { open: false, error: exports.META_ES_UNAVAILABLE_MESSAGE };
    }
    if (!input.sdkReady) {
        return { open: false, error: "SDK da Meta não carregou." };
    }
    return { open: true };
}
/** Tentativa 1 (clique) e tentativa 2 (reauth) usam as mesmas opções com config_id. */
function resolveFbLoginOptionsForAttempt(configId, _attempt) {
    return buildMetaEsFbLoginOptions(configId);
}
function mentionsMissingConfigId(message) {
    const m = String(message || "").toLowerCase();
    return m.includes("config_id") && (m.includes("obrigat") || m.includes("required") || m.includes("inválid") || m.includes("invalid"));
}
function isGenericFacebookOauthUrl(url) {
    const raw = String(url || "");
    if (!/dialog\/oauth/i.test(raw))
        return false;
    try {
        const parsed = new URL(raw);
        return !String(parsed.searchParams.get("config_id") || "").trim();
    }
    catch {
        return !/[?&]config_id=/.test(raw);
    }
}
/**
 * Não reescrever o dialog/oauth do JS SDK.
 * No Chrome o wizard funciona em web.facebook.com com app_id/cbt.
 * Trocar para www e injetar query no popup do AdsPower gera encrypted_query_string
 * e Recurso indisponível. O AdsPower usa o dialog construído (buildMetaEsOauthDialogUrl).
 */
function rewriteMetaEsOauthUrl(rawUrl, _input) {
    void _input;
    return rawUrl;
}
function normalizeMetaEsRedirectUri(raw) {
    const value = String(raw || "").trim();
    if (!value)
        return "";
    try {
        const parsed = new URL(value);
        parsed.hash = "";
        parsed.search = "";
        if (parsed.pathname === "/" || parsed.pathname === "") {
            return `${parsed.protocol}//${parsed.host}`;
        }
        return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`;
    }
    catch {
        return value.replace(/\/+$/, "");
    }
}
function resolveMetaEsRedirectUri(input) {
    return (normalizeMetaEsRedirectUri(String(input.configRedirectUri || "")) ||
        normalizeMetaEsRedirectUri(String(input.locationOrigin || "")));
}
/**
 * Modo estrito do App Dashboard lista `https://waba.draxsistemas.com.br/`
 * (com barra). normalize() tira a barra; o dialog do 135200 foi sem ela.
 */
function metaEsStrictOauthRedirectUri(raw) {
    const origin = resolveMetaEsRedirectUri({ configRedirectUri: raw, locationOrigin: raw });
    if (!origin)
        return "";
    try {
        const parsed = new URL(origin);
        if (parsed.pathname === "" || parsed.pathname === "/") {
            return `${parsed.protocol}//${parsed.host}/`;
        }
        return origin;
    }
    catch {
        return origin.endsWith("/") ? origin : `${origin}/`;
    }
}
function isNativeWindowOpen(openFn) {
    if (typeof openFn !== "function")
        return false;
    try {
        return /\[native code\]/.test(Function.prototype.toString.call(openFn));
    }
    catch {
        return false;
    }
}
function isAdsPowerLikeBrowser(input) {
    const ua = String(input.userAgent || "");
    if (/AdsPower|SunBrowser|ADSPower/i.test(ua))
        return true;
    const brands = input.userAgentData?.brands || [];
    if (brands.some((item) => /AdsPower|SunBrowser/i.test(String(item?.brand || ""))))
        return true;
    const globals = input.globals || {};
    if (globals.adsPower || globals.__adspower || globals.Adspower)
        return true;
    if (input.windowOpen !== undefined && !isNativeWindowOpen(input.windowOpen))
        return true;
    return false;
}
/**
 * Popup do FB.login no AdsPower caía em Recurso indisponível (query criptografada).
 * O dialog/oauth em página (web/www) também: a Meta reescreve para
 * web.facebook.com e o Login do Facebook fica indisponível (etapa 2, 162000).
 * O método fica explícito no Laboratório — não forçar LFB por UA.
 * No AdsPower (SunBrowser Chromium, mesmo com UA = kernel 153) o Começar do
 * Hosted ES abre dialog/oauth criptografado e a Meta devolve Recurso indisponível.
 * O grant da app conclui no Google Chrome com a mesma conta Facebook.
 */
exports.META_ES_CONNECT_METHODS = ["sdk", "hosted", "lfb"];
exports.META_ES_CONNECT_METHOD_STORAGE_KEY = "waba-meta-es-connect-method-v2";
function parseMetaEsConnectMethod(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (value === "sdk" || value === "hosted" || value === "lfb")
        return value;
    return "";
}
function resolveMetaEsConnectMethod(stored) {
    return parseMetaEsConnectMethod(stored) || "hosted";
}
function metaEsConnectMethodUsesPageRedirect(method) {
    return method === "hosted" || method === "lfb";
}
function metaEsConnectMethodUsesLoginForBusiness(method) {
    return method === "lfb";
}
function shouldUseMetaEsPageRedirect(input) {
    if (input.preferPage === true)
        return true;
    const method = parseMetaEsConnectMethod(input.method) || resolveMetaEsConnectMethod();
    return metaEsConnectMethodUsesPageRedirect(method);
}
function createMetaEsOauthState() {
    const bytes = new Uint8Array(16);
    if (typeof globalThis.crypto?.getRandomValues === "function") {
        globalThis.crypto.getRandomValues(bytes);
    }
    else {
        for (let i = 0; i < bytes.length; i += 1)
            bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function siteHostFromMetaEsOrigin(origin) {
    const value = resolveMetaEsRedirectUri({ locationOrigin: origin });
    if (!value)
        return "";
    try {
        return new URL(value).host;
    }
    catch {
        return "";
    }
}
function isMetaEsFacebookMessageOrigin(origin) {
    const raw = String(origin || "").trim();
    if (!raw)
        return false;
    try {
        const host = new URL(raw).hostname.toLowerCase();
        return host === "facebook.com" || host.endsWith(".facebook.com");
    }
    catch {
        return /(?:^|\.)facebook\.com$/i.test(raw);
    }
}
function parseMetaEsFacebookOauthMessage(data) {
    if (data == null)
        return null;
    if (typeof data === "string") {
        const text = String(data).trim();
        if (!text)
            return null;
        if (text.charAt(0) === "{" || text.charAt(0) === "[") {
            try {
                return parseMetaEsFacebookOauthMessage(JSON.parse(text));
            }
            catch {
                /* query string abaixo */
            }
        }
        const queryStart = text.search(/[?#]/);
        const query = queryStart >= 0 ? text.slice(queryStart) : `?${text}`;
        const parsed = parseMetaEsOauthReturn(query);
        return parsed.code || parsed.error ? parsed : null;
    }
    if (typeof data !== "object" || Array.isArray(data))
        return null;
    const rec = data;
    if (String(rec.type || "") === "WABA_META_ES_OAUTH_RETURN")
        return null;
    const auth = rec.authResponse && typeof rec.authResponse === "object" && !Array.isArray(rec.authResponse)
        ? rec.authResponse
        : null;
    const direct = parseMetaEsOauthReturn(`?code=${encodeURIComponent(String(auth?.code || rec.code || ""))}&state=${encodeURIComponent(String(auth?.state || rec.state || ""))}&error=${encodeURIComponent(String(auth?.error || rec.error || ""))}&error_description=${encodeURIComponent(String(auth?.error_description || rec.error_description || rec.errorDescription || ""))}`);
    if (direct.code || direct.error)
        return direct;
    for (const key of ["result", "query", "params", "data", "payload"]) {
        const nested = parseMetaEsFacebookOauthMessage(rec[key]);
        if (nested)
            return nested;
    }
    return null;
}
/**
 * Hosted ES (doc Meta): app_id, config_id, extras={"setup":{}}.
 * Não usa Página do Facebook — o Business Suite (whatsapp_accounts) exige Página
 * e não serve para essas BMs.
 */
function buildMetaEsOauthDialogUrl(input) {
    const appId = String(input.appId || "").trim();
    const configId = String(input.configId || "").trim();
    const siteOrigin = resolveMetaEsRedirectUri({ configRedirectUri: input.redirectUri });
    if (!appId || !configId || !siteOrigin)
        return null;
    const businessId = String(input.setup?.business?.id || input.businessId || "").trim();
    const wabaId = String(input.setup?.whatsAppBusinessAccount?.ids || input.wabaId || "").trim();
    const setup = buildMetaEsSetupPrefill({ businessId, wabaId });
    const parsed = new URL(`${exports.META_ES_ONBOARD_ORIGIN}${exports.META_ES_ONBOARD_PATH}`);
    parsed.searchParams.set("app_id", appId);
    parsed.searchParams.set("config_id", configId);
    parsed.searchParams.set("extras", JSON.stringify({ setup }));
    const state = String(input.state || "").trim();
    if (state)
        parsed.searchParams.set("state", state);
    void input.display;
    void input.cbt;
    void input.graphVersion;
    return parsed.toString();
}
function metaEsOauthPopupFeatures() {
    return "popup=yes,width=1100,height=820,scrollbars=yes,resizable=yes,toolbar=yes,location=yes,menubar=no";
}
/**
 * Login for Business em display=page (doc LFB), sem JS SDK.
 * Host: www.facebook.com — business.facebook.com/dialog/oauth com config_id
 * visível ainda caiu em Recurso indisponível (SunBrowser, marker 135200).
 * redirect_uri com barra final: Valid OAuth + Strict Mode no App Dashboard.
 */
function buildMetaEsLoginForBusinessDialogUrl(input) {
    const appId = String(input.appId || "").trim();
    const configId = String(input.configId || "").trim();
    const redirectUri = metaEsStrictOauthRedirectUri(input.redirectUri);
    if (!appId || !configId || !redirectUri)
        return null;
    const version = String(input.graphVersion || exports.META_ES_JS_SDK_GRAPH_VERSION).trim() || exports.META_ES_JS_SDK_GRAPH_VERSION;
    const businessId = String(input.setup?.business?.id || input.businessId || "").trim();
    const wabaId = String(input.setup?.whatsAppBusinessAccount?.ids || input.wabaId || "").trim();
    const setup = buildMetaEsSetupPrefill({ businessId, wabaId });
    const parsed = new URL(`${exports.META_ES_LFB_ORIGIN}/${version}/dialog/oauth`);
    parsed.searchParams.set("client_id", appId);
    parsed.searchParams.set("redirect_uri", redirectUri);
    parsed.searchParams.set("response_type", "code");
    parsed.searchParams.set("override_default_response_type", "true");
    parsed.searchParams.set("config_id", configId);
    parsed.searchParams.set("display", "page");
    parsed.searchParams.set("extras", JSON.stringify({ setup }));
    const state = String(input.state || "").trim();
    if (state)
        parsed.searchParams.set("state", state);
    void input.cbt;
    return parsed.toString();
}
/**
 * Senha em reauth.php.
 * Sem loginForBusiness: web.facebook.com → Hosted ES.
 * Com loginForBusiness: www.facebook.com → LFB no mesmo host.
 * next fora do facebook.com (ex.: DRAX) é ignorado e a Meta abre home.php
 * (SunBrowser, marker 161200). signed_next copia o host da senha: senha no
 * web + LFB no www vira web.facebook.com/dialog/oauth (Recurso indisponível).
 */
function buildMetaEsOauthLaunchUrl(input) {
    const loginForBusiness = Boolean(input.loginForBusiness);
    const dialog = loginForBusiness
        ? buildMetaEsLoginForBusinessDialogUrl(input)
        : buildMetaEsOauthDialogUrl(input);
    const appId = String(input.appId || "").trim();
    if (!dialog || !appId)
        return null;
    const reauthHost = loginForBusiness ? new URL(exports.META_ES_LFB_ORIGIN).hostname : exports.META_ES_OAUTH_HOST;
    const reauth = new URL(`https://${reauthHost}/login/reauth.php`);
    reauth.searchParams.set("app_id", appId);
    reauth.searchParams.set("signed_next", "1");
    reauth.searchParams.set("next", dialog);
    return reauth.toString();
}
function readJsonObject(raw) {
    const text = String(raw || "").trim();
    if (!text)
        return {};
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
function parseMetaEsOauthReturn(search) {
    let params;
    try {
        const raw = String(search || "");
        params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
    }
    catch {
        params = new URLSearchParams();
    }
    const extras = readJsonObject(String(params.get("extras") || params.get("session_info") || ""));
    const nested = extras.data && typeof extras.data === "object" && !Array.isArray(extras.data)
        ? extras.data
        : extras;
    const wabaId = String(params.get("waba_id") || extras.waba_id || nested.waba_id || nested.current_waba_id || "").trim();
    const phoneNumberId = String(params.get("phone_number_id") ||
        extras.phone_number_id ||
        nested.phone_number_id ||
        nested.current_phone_number_id ||
        "").trim();
    const businessId = String(params.get("business_id") || extras.business_id || nested.business_id || "").trim();
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
function stripMetaEsOauthSearch(search) {
    let params;
    try {
        const raw = String(search || "");
        params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
    }
    catch {
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
function isLegacyExchangePath(path) {
    const raw = String(path || "");
    return exports.META_ES_LEGACY_EXCHANGE_PATHS.some((item) => raw.includes(item));
}
/** web.facebook.com + #_rdc é redirect da Meta, não um recurso nativo do AdsPower. */
function describeMetaEsBrowserSurface(input) {
    const ua = String(input.userAgent || "");
    const chMobile = Boolean(input.userAgentData && input.userAgentData.mobile === true);
    const uaMobile = /Mobile|iPhone|iPad|Android.+Mobile|IEMobile/i.test(ua);
    const adsPowerLike = isAdsPowerLikeBrowser({
        userAgent: ua,
        windowOpen: input.windowOpen,
        globals: input.globals,
    });
    return {
        mobileHint: chMobile || uaMobile,
        platform: String(input.userAgentData?.platform || "").trim(),
        adsPowerNativeWebHost: false,
        adsPowerLike,
        usePageRedirect: adsPowerLike,
    };
}
function toPublicMetaEsConfig(input) {
    const appId = String(input.appId || "").trim();
    const configId = String(input.configId || "").trim();
    const redirectUri = resolveMetaEsRedirectUri({ configRedirectUri: input.redirectUri });
    return {
        ok: Boolean(appId && configId),
        appId: appId || undefined,
        configId: configId || undefined,
        graphVersion: String(input.graphVersion || resolveMetaEsJsSdkGraphVersion()).trim() || exports.META_ES_JS_SDK_GRAPH_VERSION,
        callbackPath: exports.META_ES_TECH_PROVIDER_PATHS.callback,
        redirectUri: redirectUri || undefined,
    };
}
function planMetaEsTechProviderClick(configId) {
    return {
        callFbInit: false,
        openGenericOauthUrl: false,
        openPageRedirect: true,
        loginOptions: buildMetaEsFbLoginOptions(configId),
        configPath: exports.META_ES_TECH_PROVIDER_PATHS.config,
        startPath: exports.META_ES_TECH_PROVIDER_PATHS.start,
        callbackPath: exports.META_ES_TECH_PROVIDER_PATHS.callback,
        completePath: exports.META_ES_TECH_PROVIDER_PATHS.complete,
        confirmPath: exports.META_ES_TECH_PROVIDER_PATHS.confirm,
        forbiddenPaths: exports.META_ES_LEGACY_EXCHANGE_PATHS,
    };
}
