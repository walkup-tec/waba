"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMetaWhatsappIntegrationRoutes = void 0;
const waba_request_auth_1 = require("../../auth/waba-request-auth");
const meta_config_1 = require("./meta-config");
const meta_whatsapp_connection_service_1 = require("./meta-whatsapp-connection.service");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const waba_feature_flags_1 = require("../../config/waba-feature-flags");
const meta_whatsapp_messaging_service_1 = require("./meta-whatsapp-messaging.service");
const meta_whatsapp_template_service_1 = require("./meta-whatsapp-template.service");
const meta_whatsapp_inbox_service_1 = require("./meta-whatsapp-inbox.service");
const meta_whatsapp_automation_service_1 = require("./meta-whatsapp-automation.service");
const service = new meta_whatsapp_connection_service_1.MetaWhatsappConnectionService();
const messagingService = new meta_whatsapp_messaging_service_1.MetaWhatsappMessagingService();
const templateService = new meta_whatsapp_template_service_1.MetaWhatsappTemplateService();
const inboxService = new meta_whatsapp_inbox_service_1.MetaWhatsappInboxService();
const automationService = new meta_whatsapp_automation_service_1.MetaWhatsappAutomationService();
function sendPublic(res, status, payload) {
    return res.status(status).json((0, meta_whatsapp_connection_service_1.stripMetaSecrets)(payload));
}
function handleMetaError(res, error) {
    const publicError = (0, meta_whatsapp_errors_1.toPublicMetaError)(error);
    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("http-error", { code: publicError.code, status: publicError.status });
    return sendPublic(res, publicError.status, {
        ok: false,
        error: publicError.error,
        code: publicError.code,
    });
}
function warnClientTenantClaim(req) {
    const body = req.body;
    if (body?.tenant_id ||
        body?.tenantId ||
        body?.owner_email ||
        body?.ownerEmail) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("ignored-client-tenant", {});
    }
}
const registerMetaWhatsappIntegrationRoutes = (app) => {
    app.get("/integrations/meta/whatsapp/config", (_req, res) => {
        const appId = (0, meta_config_1.readMetaAppId)();
        const configId = (0, meta_config_1.readMetaConfigId)();
        return sendPublic(res, 200, {
            ok: Boolean(appId && configId),
            appId: appId || undefined,
            configId: configId || undefined,
            graphVersion: (0, meta_config_1.readMetaGraphVersion)(),
            callbackPath: "/integrations/meta/whatsapp/callback",
            redirectUri: (0, meta_config_1.readMetaOauthRedirectUri)() || undefined,
        });
    });
    app.get("/integrations/meta/whatsapp/start", (req, res) => {
        try {
            const started = service.startAuthenticatedFlow((0, waba_request_auth_1.resolveWabaRequestAuth)(req));
            return sendPublic(res, 200, started);
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/status", async (req, res) => {
        try {
            const publicStatus = await service.getPublicStatus((0, waba_request_auth_1.resolveWabaRequestAuth)(req));
            return sendPublic(res, 200, { ok: true, ...publicStatus });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    /**
     * Callback de API (sessão autenticada).
     * O Embedded Signup atual usa FB.login na SPA e POST do `code` — não é redirect OAuth para a home.
     * GET existe para a URL dedicada existir; se vier `code` na query (futuro OAuth redirect), troca e persiste.
     */
    app.get("/integrations/meta/whatsapp/callback", async (req, res) => {
        const code = String(req.query.code || "").trim();
        if (!code) {
            return sendPublic(res, 200, {
                ok: true,
                message: "Callback Meta. Envie POST com { code } autenticado.",
            });
        }
        try {
            if (!(0, meta_config_1.isMetaTechProviderConfigured)()) {
                return sendPublic(res, 503, {
                    ok: false,
                    error: "A conexão com a Meta não está disponível. Fale com o suporte.",
                    code: "config_invalid",
                });
            }
            const publicStatus = await service.exchangeCodeAndStore((0, waba_request_auth_1.resolveWabaRequestAuth)(req), {
                code,
                redirectUri: String(req.query.redirect_uri || "").trim() || undefined,
            });
            return sendPublic(res, 200, { ok: true, exchanged: true, ...publicStatus });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/callback", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const publicStatus = await service.exchangeCodeAndStore((0, waba_request_auth_1.resolveWabaRequestAuth)(req), {
                code: String(req.body?.code || "").trim(),
                redirectUri: String(req.body?.redirectUri || req.body?.redirect_uri || "").trim() || undefined,
                tenantId: String(req.body?.tenantId || req.body?.tenant_id || "").trim() || undefined,
                ownerEmail: String(req.body?.ownerEmail || req.body?.owner_email || "").trim() || undefined,
            });
            return sendPublic(res, 200, { ok: true, exchanged: true, ...publicStatus });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/complete", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const publicStatus = await service.attachSessionAssets((0, waba_request_auth_1.resolveWabaRequestAuth)(req), {
                wabaId: String(req.body?.wabaId || req.body?.waba_id || "").trim(),
                phoneNumberId: String(req.body?.phoneNumberId || req.body?.phone_number_id || "").trim(),
                businessId: String(req.body?.businessId || req.body?.business_id || "").trim(),
                displayPhoneNumber: String(req.body?.displayPhoneNumber || "").trim(),
                verifiedName: String(req.body?.verifiedName || "").trim(),
                tenantId: String(req.body?.tenantId || req.body?.tenant_id || "").trim() || undefined,
                ownerEmail: String(req.body?.ownerEmail || req.body?.owner_email || "").trim() || undefined,
            });
            return sendPublic(res, 200, { ok: true, ...publicStatus });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/confirm", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const publicStatus = await service.confirmFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req));
            return sendPublic(res, 200, { ok: true, ...publicStatus });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/portfolio", async (req, res) => {
        try {
            if (!(0, waba_feature_flags_1.isMetaOfficialPortfolioLabEnabled)()) {
                return sendPublic(res, 404, {
                    ok: false,
                    error: "Recurso indisponível neste ambiente.",
                    code: "config_invalid",
                });
            }
            const assets = await service.listPortfolioAssets((0, waba_request_auth_1.resolveWabaRequestAuth)(req));
            return sendPublic(res, 200, { ok: true, ...assets });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/portfolio/photo", async (req, res) => {
        try {
            if (!(0, waba_feature_flags_1.isMetaOfficialPortfolioLabEnabled)()) {
                return sendPublic(res, 404, {
                    ok: false,
                    error: "Recurso indisponível neste ambiente.",
                    code: "config_invalid",
                });
            }
            const photo = await service.readPortfolioPhotoFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req));
            if (!photo) {
                return sendPublic(res, 404, {
                    ok: false,
                    error: "Foto do portfólio não encontrada.",
                    code: "invalid_payload",
                });
            }
            res.setHeader("Content-Type", photo.mime);
            res.setHeader("Cache-Control", "private, no-store");
            res.setHeader("Content-Length", String(photo.bytes.length));
            return res.status(200).end(photo.bytes);
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/phone-numbers/register", async (req, res) => {
        try {
            if (!(0, waba_feature_flags_1.isMetaOfficialPortfolioLabEnabled)()) {
                return sendPublic(res, 404, {
                    ok: false,
                    error: "Recurso indisponível neste ambiente.",
                    code: "config_invalid",
                });
            }
            warnClientTenantClaim(req);
            const assets = await service.registerPhoneFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req), {
                phoneNumberId: String(req.body?.phoneNumberId || req.body?.phone_number_id || "").trim(),
                pin: String(req.body?.pin || "").trim(),
            });
            return sendPublic(res, 200, { ok: true, ...assets });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/phone-numbers/profile", async (req, res) => {
        try {
            if (!(0, waba_feature_flags_1.isMetaOfficialPortfolioLabEnabled)()) {
                return sendPublic(res, 404, {
                    ok: false,
                    error: "Recurso indisponível neste ambiente.",
                    code: "config_invalid",
                });
            }
            warnClientTenantClaim(req);
            const assets = await service.updatePhoneProfileFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req), {
                phoneNumberId: String(req.body?.phoneNumberId || req.body?.phone_number_id || "").trim(),
                displayName: String(req.body?.displayName || req.body?.display_name || "").trim(),
                photoBase64: String(req.body?.photoBase64 || req.body?.photo_base64 || "").trim(),
                photoMime: String(req.body?.photoMime || req.body?.photo_mime || "").trim(),
            });
            return sendPublic(res, 200, { ok: true, ...assets });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/phone-numbers/photo", async (req, res) => {
        try {
            if (!(0, waba_feature_flags_1.isMetaOfficialPortfolioLabEnabled)()) {
                return sendPublic(res, 404, {
                    ok: false,
                    error: "Recurso indisponível neste ambiente.",
                    code: "config_invalid",
                });
            }
            const photo = await service.readPhonePhotoFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.query.id || req.query.phoneNumberId || "").trim());
            if (!photo) {
                return sendPublic(res, 404, {
                    ok: false,
                    error: "Foto do número não encontrada.",
                    code: "invalid_payload",
                });
            }
            res.setHeader("Content-Type", photo.mime);
            res.setHeader("Cache-Control", "private, no-store");
            res.setHeader("Content-Length", String(photo.bytes.length));
            return res.status(200).end(photo.bytes);
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/portfolio/profile", async (req, res) => {
        try {
            if (!(0, waba_feature_flags_1.isMetaOfficialPortfolioLabEnabled)()) {
                return sendPublic(res, 404, {
                    ok: false,
                    error: "Recurso indisponível neste ambiente.",
                    code: "config_invalid",
                });
            }
            warnClientTenantClaim(req);
            const assets = await service.updatePortfolioFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req), {
                displayName: String(req.body?.displayName || req.body?.display_name || "").trim(),
                photoBase64: String(req.body?.photoBase64 || req.body?.photo_base64 || "").trim(),
                photoMime: String(req.body?.photoMime || req.body?.photo_mime || "").trim(),
            });
            return sendPublic(res, 200, { ok: true, ...assets });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/messages", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const result = await messagingService.sendFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, ...result });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/templates", async (req, res) => {
        try {
            const templates = await templateService.listFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req));
            return sendPublic(res, 200, { ok: true, templates });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/templates", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const template = await templateService.createFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, template });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/templates/sync", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const result = await templateService.syncFromAuth((0, waba_request_auth_1.resolveWabaRequestAuth)(req));
            return sendPublic(res, 200, { ok: true, ...result });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/inbox/conversations", async (req, res) => {
        try {
            const result = await inboxService.listConversations((0, waba_request_auth_1.resolveWabaRequestAuth)(req), req.query);
            return sendPublic(res, 200, { ok: true, ...result });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/inbox/conversations/:id/messages", async (req, res) => {
        try {
            const result = await inboxService.listMessages((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""), req.query);
            return sendPublic(res, 200, { ok: true, ...result });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/inbox/conversations/:id/read", async (req, res) => {
        try {
            const conversation = await inboxService.markRead((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""));
            return sendPublic(res, 200, { ok: true, conversation });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/inbox/conversations/:id/status", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const conversation = await inboxService.patchStatus((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, conversation });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/inbox/conversations/:id/assign", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const conversation = await inboxService.assign((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, conversation });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/inbox/conversations/:id/messages", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const result = await inboxService.sendMessage((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, ...result });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/automation", async (req, res) => {
        try {
            const result = await automationService.getBundle((0, waba_request_auth_1.resolveWabaRequestAuth)(req));
            return sendPublic(res, 200, { ok: true, ...result });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.patch("/integrations/meta/whatsapp/automation/settings", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const settings = await automationService.patchSettings((0, waba_request_auth_1.resolveWabaRequestAuth)(req), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, settings });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.patch("/integrations/meta/whatsapp/automation/flows/:id", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const flow = await automationService.patchFlow((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, flow });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/automation/rules", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const rule = await automationService.createRule((0, waba_request_auth_1.resolveWabaRequestAuth)(req), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, rule });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.patch("/integrations/meta/whatsapp/automation/rules/:id", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const rule = await automationService.patchRule((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, rule });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.delete("/integrations/meta/whatsapp/automation/rules/:id", async (req, res) => {
        try {
            const result = await automationService.deleteRule((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""));
            return sendPublic(res, 200, { ok: true, ...result });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
};
exports.registerMetaWhatsappIntegrationRoutes = registerMetaWhatsappIntegrationRoutes;
