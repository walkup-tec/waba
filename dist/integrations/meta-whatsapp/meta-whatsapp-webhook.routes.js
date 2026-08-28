"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMetaWhatsappSubscriptionRoute = exports.registerMetaWhatsappWebhookRoutes = void 0;
const meta_whatsapp_webhook_events_repository_1 = require("./meta-whatsapp-webhook-events.repository");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_webhook_path_1 = require("./meta-whatsapp-webhook-path");
const meta_whatsapp_webhook_service_1 = require("./meta-whatsapp-webhook.service");
const meta_whatsapp_webhook_inbox_service_1 = require("./meta-whatsapp-webhook-inbox.service");
const meta_whatsapp_webhook_template_service_1 = require("./meta-whatsapp-webhook-template.service");
const meta_whatsapp_webhook_subscription_service_1 = require("./meta-whatsapp-webhook-subscription.service");
const meta_whatsapp_webhook_log_1 = require("./meta-whatsapp-webhook-log");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const waba_request_auth_1 = require("../../auth/waba-request-auth");
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const webhookService = new meta_whatsapp_webhook_service_1.MetaWhatsappWebhookService(new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), new meta_whatsapp_webhook_events_repository_1.MetaWhatsappWebhookEventsRepository(), new meta_whatsapp_webhook_inbox_service_1.MetaWhatsappWebhookInboxService(), new meta_whatsapp_webhook_template_service_1.MetaWhatsappWebhookTemplateService());
const subscriptionService = new meta_whatsapp_webhook_subscription_service_1.MetaWhatsappWebhookSubscriptionService();
const connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository();
function readRawBody(req) {
    const raw = req.rawBody;
    return Buffer.isBuffer(raw) ? raw : undefined;
}
const registerMetaWhatsappWebhookRoutes = (app) => {
    app.get(meta_whatsapp_webhook_path_1.META_WHATSAPP_WEBHOOK_PATH, (req, res) => {
        const result = webhookService.verifySubscription({
            "hub.mode": String(req.query["hub.mode"] || ""),
            "hub.verify_token": String(req.query["hub.verify_token"] || ""),
            "hub.challenge": String(req.query["hub.challenge"] || ""),
        });
        if (!result.ok) {
            return res.status(403).send("Forbidden");
        }
        return res.status(200).type("text/plain").send(result.challenge);
    });
    app.post(meta_whatsapp_webhook_path_1.META_WHATSAPP_WEBHOOK_PATH, async (req, res) => {
        try {
            const result = await webhookService.processPostedEvent({
                rawBody: readRawBody(req),
                signatureHeader: req.header("x-hub-signature-256") || req.header("X-Hub-Signature-256"),
                parsedBody: req.body,
            });
            if (!result.accepted) {
                return res.status(result.httpStatus).send("Forbidden");
            }
            return res.status(200).json({ ok: true });
        }
        catch {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", { reason: "unhandled" });
            return res.status(200).json({ ok: true });
        }
    });
};
exports.registerMetaWhatsappWebhookRoutes = registerMetaWhatsappWebhookRoutes;
const registerMetaWhatsappSubscriptionRoute = (app) => {
    app.post("/integrations/meta/whatsapp/subscribe-webhooks", async (req, res) => {
        try {
            const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
            const tenant = (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
            const connection = await connections.findOpenByTenant(tenant.tenantId);
            if (!connection ||
                !connection.wabaId ||
                (connection.status !== "connected" && connection.status !== "pending_confirmation")) {
                return res.status(409).json({
                    ok: false,
                    error: "Conecte e confirme a WABA antes de inscrever o webhook.",
                });
            }
            const result = await subscriptionService.ensureSubscribed(connection);
            if (!result.ok) {
                return res.status(424).json({ ok: false, error: result.detail || "Falha na inscrição." });
            }
            return res.status(200).json({
                ok: true,
                alreadySubscribed: result.alreadySubscribed,
                subscribed: result.subscribed,
            });
        }
        catch (error) {
            const publicError = (0, meta_whatsapp_errors_1.toPublicMetaError)(error);
            return res.status(publicError.status).json({
                ok: false,
                error: publicError.error,
                code: publicError.code,
            });
        }
    });
};
exports.registerMetaWhatsappSubscriptionRoute = registerMetaWhatsappSubscriptionRoute;
