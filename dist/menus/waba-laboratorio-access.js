"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WABA_LABORATORIO_OWNER_EMAIL = void 0;
exports.isWabaLaboratorioOwnerEmail = isWabaLaboratorioOwnerEmail;
exports.isWabaUiProductionProfile = isWabaUiProductionProfile;
exports.canAccessWabaLaboratorioMenus = canAccessWabaLaboratorioMenus;
/**
 * Laboratório (Meta Tech Provider) no painel de gestão.
 * Em produção só a conta Mozart vê a seção e os menus.
 */
exports.WABA_LABORATORIO_OWNER_EMAIL = "mozart.pmo@gmail.com";
function isWabaLaboratorioOwnerEmail(email) {
    return String(email || "").trim().toLowerCase() === exports.WABA_LABORATORIO_OWNER_EMAIL;
}
/** Mesma regra de `resolveUiProfile` em index.ts: default = production, exceto v01/full/baseline. */
function isWabaUiProductionProfile(env = process.env) {
    const explicit = String(env.WABA_UI_PROFILE || "").trim().toLowerCase();
    if (explicit === "production")
        return true;
    if (explicit === "full" || explicit === "baseline")
        return false;
    return String(env.WABA_ENV || "").trim().toLowerCase() !== "v01";
}
function canAccessWabaLaboratorioMenus(email, env = process.env) {
    if (!isWabaUiProductionProfile(env))
        return true;
    return isWabaLaboratorioOwnerEmail(email);
}
