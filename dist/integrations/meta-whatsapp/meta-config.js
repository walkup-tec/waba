"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMetaConfigId = readMetaConfigId;
exports.readMetaAppId = readMetaAppId;
exports.readMetaAppSecret = readMetaAppSecret;
exports.readMetaBusinessId = readMetaBusinessId;
exports.readMetaGraphBase = readMetaGraphBase;
exports.readMetaGraphVersion = readMetaGraphVersion;
exports.readMetaOauthRedirectUri = readMetaOauthRedirectUri;
exports.readMetaWebhookVerifyToken = readMetaWebhookVerifyToken;
exports.isMetaTechProviderConfigured = isMetaTechProviderConfigured;
exports.readMetaInboxPollMs = readMetaInboxPollMs;
const readEnv = (key) => String(process.env[key] || "").trim();
/** Config ID do Embedded Signup. Novo nome oficial; fallback legado. */
function readMetaConfigId() {
    return readEnv("META_CONFIG_ID") || readEnv("META_ES_CONFIG_ID");
}
function readMetaAppId() {
    return readEnv("META_APP_ID");
}
function readMetaAppSecret() {
    return readEnv("META_APP_SECRET");
}
function readMetaBusinessId() {
    return readEnv("META_BUSINESS_ID");
}
function readMetaGraphBase() {
    return (readEnv("META_GRAPH_BASE") || "https://graph.facebook.com").replace(/\/+$/, "");
}
function readMetaGraphVersion() {
    return readEnv("META_GRAPH_VERSION") || "v22.0";
}
function readMetaOauthRedirectUri() {
    return readEnv("META_OAUTH_REDIRECT_URI");
}
function readMetaWebhookVerifyToken() {
    return readEnv("META_WEBHOOK_VERIFY_TOKEN");
}
function isMetaTechProviderConfigured() {
    return Boolean(readMetaAppId() && readMetaAppSecret() && readMetaConfigId());
}
function clampPollMs(raw, fallback) {
    const n = Number(raw);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(30000, Math.max(2000, Math.floor(n)));
}
function readMetaInboxPollMs() {
    return {
        listMs: clampPollMs(readEnv("META_INBOX_LIST_POLL_MS"), 8000),
        threadMs: clampPollMs(readEnv("META_INBOX_THREAD_POLL_MS"), 3000),
    };
}
