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
exports.META_ES_LEGACY_EXCHANGE_PATHS = exports.META_ES_TECH_PROVIDER_PATHS = exports.META_ES_UNAVAILABLE_MESSAGE = exports.META_ES_JS_SDK_GRAPH_VERSION = void 0;
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
exports.isLegacyExchangePath = isLegacyExchangePath;
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
    if (businessId)
        setup.business = { id: businessId };
    if (wabaId)
        setup.whatsAppBusinessAccount = { ids: wabaId };
    return setup;
}
function buildMetaEsFbLoginOptions(configId, setup) {
    const id = String(configId || "").trim();
    if (!id)
        return null;
    return {
        config_id: id,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: setup && Object.keys(setup).length ? setup : {} },
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
function isLegacyExchangePath(path) {
    const raw = String(path || "");
    return exports.META_ES_LEGACY_EXCHANGE_PATHS.some((item) => raw.includes(item));
}
function toPublicMetaEsConfig(input) {
    const appId = String(input.appId || "").trim();
    const configId = String(input.configId || "").trim();
    return {
        ok: Boolean(appId && configId),
        appId: appId || undefined,
        configId: configId || undefined,
        graphVersion: String(input.graphVersion || resolveMetaEsJsSdkGraphVersion()).trim() || exports.META_ES_JS_SDK_GRAPH_VERSION,
        callbackPath: exports.META_ES_TECH_PROVIDER_PATHS.callback,
    };
}
function planMetaEsTechProviderClick(configId) {
    return {
        callFbInit: false,
        openGenericOauthUrl: false,
        loginOptions: buildMetaEsFbLoginOptions(configId),
        configPath: exports.META_ES_TECH_PROVIDER_PATHS.config,
        startPath: exports.META_ES_TECH_PROVIDER_PATHS.start,
        callbackPath: exports.META_ES_TECH_PROVIDER_PATHS.callback,
        completePath: exports.META_ES_TECH_PROVIDER_PATHS.complete,
        confirmPath: exports.META_ES_TECH_PROVIDER_PATHS.confirm,
        forbiddenPaths: exports.META_ES_LEGACY_EXCHANGE_PATHS,
    };
}
