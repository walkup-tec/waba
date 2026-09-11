"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffEmailHasLaboratorioAccess = staffEmailHasLaboratorioAccess;
exports.campaignAttendedByLaboratorioStaff = campaignAttendedByLaboratorioStaff;
const waba_laboratorio_access_1 = require("../menus/waba-laboratorio-access");
const waba_menu_permissions_service_1 = require("../menus/waba-menu-permissions.service");
const waba_menu_registry_1 = require("../menus/waba-menu-registry");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
/** Operadores da fila oficial: relatório manual, sem cliques da Meta. */
function staffUsesManualOperatorReport(email, lookup) {
    const normalized = normalizeEmail(email);
    if (!normalized)
        return false;
    const local = normalized.split("@")[0] || "";
    if (local === "douglas" || local.startsWith("douglas.") || local.startsWith("douglas_")) {
        return true;
    }
    const user = lookup.getByEmail(normalized);
    const name = String(user?.fullName || "").trim().toLowerCase();
    if (!name)
        return false;
    const first = name.split(/\s+/)[0] || "";
    return first === "douglas";
}
function defaultLookup() {
    return new waba_system_user_service_1.WabaSystemUserService();
}
/**
 * Quem pode usar o Laboratório (e portanto dispara Cloud / coleta Meta).
 * Operacional/suporte: menus marcados no cadastro.
 * Master: a mesma regra de tela (produção = só Mozart).
 */
function staffEmailHasLaboratorioAccess(email, lookup = defaultLookup(), env = process.env) {
    const normalized = normalizeEmail(email);
    if (!normalized)
        return false;
    const user = lookup.getByEmail(normalized);
    if (!user) {
        return (0, waba_laboratorio_access_1.canAccessWabaLaboratorioMenus)(normalized, env);
    }
    if (user.role === "master") {
        return (0, waba_laboratorio_access_1.canAccessWabaLaboratorioMenus)(user.email, env);
    }
    if (user.role !== "operacional" && user.role !== "suporte")
        return false;
    return waba_menu_registry_1.WABA_TECH_PROVIDER_MENU_IDS.some((id) => (0, waba_menu_permissions_service_1.isMenuAllowedForUser)(user, id));
}
/**
 * Relatório automático + cliques valem só para campanhas **atendidas**
 * por alguém com acesso ao Laboratório — não pelo plano oficial/alternativa.
 */
function campaignAttendedByLaboratorioStaff(intake, lookup = defaultLookup(), env = process.env) {
    const assigned = normalizeEmail(String(intake.assignedOperacionalEmail || ""));
    if (assigned) {
        if (staffUsesManualOperatorReport(assigned, lookup))
            return false;
        return staffEmailHasLaboratorioAccess(assigned, lookup, env);
    }
    const started = normalizeEmail(String(intake.startedByEmail || ""));
    if (started) {
        if (staffUsesManualOperatorReport(started, lookup))
            return false;
        return staffEmailHasLaboratorioAccess(started, lookup, env);
    }
    return false;
}
