"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMetaWhatsappTenant = resolveMetaWhatsappTenant;
exports.deriveStableMetaTenantId = uuidV5FromEmail;
const node_crypto_1 = require("node:crypto");
const waba_subscriber_repository_1 = require("../../subscribers/waba-subscriber.repository");
const waba_laboratorio_access_1 = require("../../menus/waba-laboratorio-access");
const waba_menu_permissions_service_1 = require("../../menus/waba-menu-permissions.service");
const waba_menu_registry_1 = require("../../menus/waba-menu-registry");
const waba_system_user_service_1 = require("../../users/waba-system-user.service");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
/** Namespace DNS RFC 4122 — UUID v5 estável para staff sem registro de assinante. */
const META_TENANT_NAMESPACE = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");
function uuidV5FromEmail(email) {
    const hash = (0, node_crypto_1.createHash)("sha1").update(META_TENANT_NAMESPACE).update(`waba-meta-tenant:${email}`).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
function staffHasLaboratorioMenu(auth) {
    if (auth.role !== "operacional" && auth.role !== "suporte")
        return false;
    const user = new waba_system_user_service_1.WabaSystemUserService().getByEmail(auth.email);
    if (!user)
        return false;
    return waba_menu_registry_1.WABA_TECH_PROVIDER_MENU_IDS.some((id) => (0, waba_menu_permissions_service_1.isMenuAllowedForUser)(user, id));
}
function tenantForWorkspaceEmail(workspaceEmail, subscriberRepository) {
    const subscriber = subscriberRepository.getByEmail(workspaceEmail);
    if (subscriber?.id) {
        return { tenantId: subscriber.id, ownerEmail: subscriber.email };
    }
    return { tenantId: uuidV5FromEmail(workspaceEmail), ownerEmail: workspaceEmail };
}
/**
 * Assinante e master usam o tenant do próprio e-mail.
 * Operacional/suporte com menu do Laboratório lê o mesmo workspace do dono (Mozart).
 */
function resolveMetaWhatsappTenant(auth, subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository(), options = {}) {
    const sessionEmail = normalizeEmail(auth.email);
    if (!sessionEmail || !sessionEmail.includes("@") || auth.role === "guest") {
        throw new Error("Sessão inválida para integração Meta.");
    }
    const shareLab = (auth.role === "operacional" || auth.role === "suporte") &&
        (options.hasLaboratorioMenu ?? staffHasLaboratorioMenu(auth));
    const workspaceEmail = shareLab ? waba_laboratorio_access_1.WABA_LABORATORIO_OWNER_EMAIL : sessionEmail;
    return tenantForWorkspaceEmail(workspaceEmail, subscriberRepository);
}
