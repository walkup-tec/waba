"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicBaseHintsFromExpressRequest = exports.peekWabaShortPublicBaseUrl = exports.resolveWabaShortPublicBaseUrl = exports.resolveWabaPublicBaseUrl = exports.rememberPublicBaseFromRequest = exports.resolveRequestPublicBase = exports.isLocalHostname = void 0;
const load_env_1 = require("../load-env");
let cachedPublicBaseFromRequest = "";
const pickFirstHttpBase = (...candidates) => {
    for (const candidate of candidates) {
        const value = String(candidate || "")
            .trim()
            .replace(/\/+$/, "");
        if (value && /^https?:\/\//i.test(value))
            return value;
    }
    return "";
};
const isLocalHostname = (host) => {
    const normalized = String(host || "")
        .toLowerCase()
        .split(":")[0];
    if (!normalized)
        return true;
    if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]") {
        return true;
    }
    return (/^10\./.test(normalized) ||
        /^192\.168\./.test(normalized) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalized));
};
exports.isLocalHostname = isLocalHostname;
const resolveRequestPublicBase = (hints) => {
    if (!hints)
        return "";
    const proto = String(hints.forwardedProto || hints.protocol || "https")
        .split(",")[0]
        .trim()
        .replace(/:$/, "");
    const host = String(hints.forwardedHost || hints.host || "")
        .split(",")[0]
        .trim();
    if (!host || (0, exports.isLocalHostname)(host))
        return "";
    return `${proto}://${host}`.replace(/\/+$/, "");
};
exports.resolveRequestPublicBase = resolveRequestPublicBase;
const rememberPublicBaseFromRequest = (hints) => {
    const base = (0, exports.resolveRequestPublicBase)(hints);
    if (base)
        cachedPublicBaseFromRequest = base;
};
exports.rememberPublicBaseFromRequest = rememberPublicBaseFromRequest;
const resolveWabaPublicBaseUrl = (hints) => {
    const fromEnv = pickFirstHttpBase(process.env.WABA_PUBLIC_BASE_URL, process.env.WABA_WEBHOOK_BASE_URL, process.env.WABA_APP_LOGIN_URL);
    if (fromEnv)
        return fromEnv;
    const fromRequest = (0, exports.resolveRequestPublicBase)(hints);
    if (fromRequest)
        return fromRequest;
    if (cachedPublicBaseFromRequest)
        return cachedPublicBaseFromRequest;
    if (load_env_1.WABA_ENV === "v01" || load_env_1.WABA_ENV === "v02" || process.env.NODE_ENV === "development") {
        const port = String(process.env.PORT || "3012").trim();
        return `http://localhost:${port}`;
    }
    return "";
};
exports.resolveWabaPublicBaseUrl = resolveWabaPublicBaseUrl;
const resolveWabaShortPublicBaseUrl = (hints) => {
    const shortSpecific = pickFirstHttpBase(process.env.WABA_SHORT_PUBLIC_BASE, process.env.BASE_SHORT_DOMAIN, process.env.WABA_SHORTENER_PUBLIC_BASE);
    if (shortSpecific)
        return shortSpecific;
    const general = (0, exports.resolveWabaPublicBaseUrl)(hints);
    if (general)
        return general;
    if (load_env_1.WABA_ENV === "v01" || load_env_1.WABA_ENV === "v02" || process.env.NODE_ENV === "development") {
        const port = String(process.env.PORT || "3012").trim();
        return `http://localhost:${port}`;
    }
    throw new Error("URL pública do encurtador não configurada. Defina WABA_SHORT_PUBLIC_BASE ou WABA_PUBLIC_BASE_URL no painel.");
};
exports.resolveWabaShortPublicBaseUrl = resolveWabaShortPublicBaseUrl;
const peekWabaShortPublicBaseUrl = (hints) => {
    const shortSpecific = pickFirstHttpBase(process.env.WABA_SHORT_PUBLIC_BASE, process.env.BASE_SHORT_DOMAIN, process.env.WABA_SHORTENER_PUBLIC_BASE);
    if (shortSpecific) {
        return { configured: true, base: shortSpecific, source: "short_env" };
    }
    const fromEnv = pickFirstHttpBase(process.env.WABA_PUBLIC_BASE_URL, process.env.WABA_WEBHOOK_BASE_URL, process.env.WABA_APP_LOGIN_URL);
    if (fromEnv) {
        return { configured: true, base: fromEnv, source: "public_env" };
    }
    const fromRequest = (0, exports.resolveRequestPublicBase)(hints);
    if (fromRequest) {
        return { configured: true, base: fromRequest, source: "request" };
    }
    if (cachedPublicBaseFromRequest) {
        return { configured: true, base: cachedPublicBaseFromRequest, source: "request_cache" };
    }
    if (load_env_1.WABA_ENV === "v01" || load_env_1.WABA_ENV === "v02" || process.env.NODE_ENV === "development") {
        const port = String(process.env.PORT || "3012").trim();
        return { configured: true, base: `http://localhost:${port}`, source: "localhost_dev" };
    }
    return { configured: false, base: "", source: "missing" };
};
exports.peekWabaShortPublicBaseUrl = peekWabaShortPublicBaseUrl;
const publicBaseHintsFromExpressRequest = (req) => ({
    protocol: req.protocol,
    host: req.get?.("host"),
    forwardedProto: req.get?.("x-forwarded-proto"),
    forwardedHost: req.get?.("x-forwarded-host"),
});
exports.publicBaseHintsFromExpressRequest = publicBaseHintsFromExpressRequest;
