"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVICE_CLOUD_PRODUCT_UNAVAILABLE_MESSAGE = exports.ALTERNATIVA_PRODUCT_UNAVAILABLE_MESSAGE = void 0;
exports.isAlternativaNumbersPurchaseEnabled = isAlternativaNumbersPurchaseEnabled;
exports.isAlternativaProductEnabled = isAlternativaProductEnabled;
exports.assertAlternativaProductAllowsApiKind = assertAlternativaProductAllowsApiKind;
exports.isMetaOfficialPortfolioLabEnabled = isMetaOfficialPortfolioLabEnabled;
exports.isDeviceCloudProductEnabled = isDeviceCloudProductEnabled;
exports.getWabaFeatureFlags = getWabaFeatureFlags;
exports.getWabaFeatureFlagsForClient = getWabaFeatureFlagsForClient;
exports.describeWabaFeatureFlagsForOps = describeWabaFeatureFlagsForOps;
const load_env_1 = require("../load-env");
const parseTruthy = (raw) => {
    const value = String(raw || "").trim().toLowerCase();
    if (value === "1" || value === "true" || value === "yes" || value === "on")
        return true;
    if (value === "0" || value === "false" || value === "no" || value === "off")
        return false;
    return null;
};
/** Produção para assinantes: desligado por padrão. Ligue só em V02/dev com env explícita. */
function isAlternativaNumbersPurchaseEnabled() {
    const explicit = parseTruthy(String(process.env.WABA_ALTERNATIVA_NUMBERS_PURCHASE_ENABLED ?? ""));
    if (explicit !== null)
        return explicit;
    return false;
}
exports.ALTERNATIVA_PRODUCT_UNAVAILABLE_MESSAGE = "A API Alternativa não está mais disponível. Utilize a API Oficial.";
/** Produto API Alternativa: desligado por padrão. Rollback: WABA_ALTERNATIVA_PRODUCT_ENABLED=1. */
function isAlternativaProductEnabled(env = process.env) {
    const explicit = parseTruthy(String(env.WABA_ALTERNATIVA_PRODUCT_ENABLED ?? ""));
    if (explicit !== null)
        return explicit;
    return false;
}
function assertAlternativaProductAllowsApiKind(apiKind) {
    const kind = String(apiKind || "").trim().toLowerCase();
    if (kind === "alternativa" && !isAlternativaProductEnabled()) {
        throw new Error(exports.ALTERNATIVA_PRODUCT_UNAVAILABLE_MESSAGE);
    }
}
/** Telas de portfólio/números oficiais no Laboratório. */
function isMetaOfficialPortfolioLabEnabled(env = process.env) {
    const explicit = parseTruthy(String(env.WABA_META_OFFICIAL_PORTFOLIO_LAB ?? ""));
    if (explicit !== null)
        return explicit;
    return true;
}
exports.DEVICE_CLOUD_PRODUCT_UNAVAILABLE_MESSAGE = "O menu Dispositivos não está mais disponível.";
/** Device Cloud / Dispositivos: desligado por padrão. Rollback: WABA_DEVICE_CLOUD_PRODUCT_ENABLED=1. */
function isDeviceCloudProductEnabled(env = process.env) {
    const explicit = parseTruthy(String(env.WABA_DEVICE_CLOUD_PRODUCT_ENABLED ?? ""));
    if (explicit !== null)
        return explicit;
    return false;
}
function getWabaFeatureFlags() {
    return {
        alternativaNumbersPurchase: isAlternativaNumbersPurchaseEnabled(),
        alternativaProduct: isAlternativaProductEnabled(),
        metaOfficialPortfolioLab: isMetaOfficialPortfolioLabEnabled(),
        deviceCloudProduct: isDeviceCloudProductEnabled(),
    };
}
function getWabaFeatureFlagsForClient() {
    return getWabaFeatureFlags();
}
/** Diagnóstico em logs de boot (sem segredos). */
function describeWabaFeatureFlagsForOps() {
    return {
        ...getWabaFeatureFlags(),
        wabaEnv: load_env_1.WABA_ENV || "default",
    };
}
