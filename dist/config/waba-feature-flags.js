"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAlternativaNumbersPurchaseEnabled = isAlternativaNumbersPurchaseEnabled;
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
function getWabaFeatureFlags() {
    return {
        alternativaNumbersPurchase: isAlternativaNumbersPurchaseEnabled(),
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
