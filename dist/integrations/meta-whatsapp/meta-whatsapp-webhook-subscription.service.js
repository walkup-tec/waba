"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappWebhookSubscriptionService = void 0;
const meta_token_crypto_1 = require("./meta-token-crypto");
const meta_whatsapp_webhook_graph_client_1 = require("./meta-whatsapp-webhook-graph.client");
const meta_whatsapp_webhook_log_1 = require("./meta-whatsapp-webhook-log");
function listSubscribedAppIds(json) {
    const data = json?.data;
    if (!Array.isArray(data))
        return [];
    return data
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean);
}
class MetaWhatsappWebhookSubscriptionService {
    constructor(graph = meta_whatsapp_webhook_graph_client_1.callMetaGraphForWebhook, decrypt = meta_token_crypto_1.decryptMetaToken) {
        this.graph = graph;
        this.decrypt = decrypt;
    }
    async ensureSubscribed(connection) {
        const wabaId = String(connection.wabaId || "").trim();
        if (!wabaId) {
            return {
                ok: false,
                alreadySubscribed: false,
                subscribed: false,
                detail: "WABA confirmada ausente.",
            };
        }
        let token = "";
        try {
            token = this.decrypt(connection.accessTokenEncrypted);
        }
        catch {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", { reason: "decrypt_failed", connectionId: connection.id });
            return {
                ok: false,
                alreadySubscribed: false,
                subscribed: false,
                detail: "Falha ao usar o token da conexão.",
            };
        }
        const existing = await this.graph({
            token,
            method: "GET",
            path: `${wabaId}/subscribed_apps`,
        });
        if (!existing.ok) {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", {
                reason: "subscribed_apps_get_failed",
                status: existing.status,
                wabaId,
            });
            return {
                ok: false,
                alreadySubscribed: false,
                subscribed: false,
                detail: "Falha ao consultar subscribed_apps.",
            };
        }
        const apps = listSubscribedAppIds(existing.json);
        if (apps.length > 0) {
            return { ok: true, alreadySubscribed: true, subscribed: true };
        }
        // Graph oficial: POST /{WABA_ID}/subscribed_apps sem body.
        // Campos (messages, message_template_status_update, …) são configurados no App Dashboard.
        const subscribe = await this.graph({
            token,
            method: "POST",
            path: `${wabaId}/subscribed_apps`,
        });
        if (!subscribe.ok) {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", {
                reason: "subscribed_apps_post_failed",
                status: subscribe.status,
                wabaId,
            });
            return {
                ok: false,
                alreadySubscribed: false,
                subscribed: false,
                detail: "Falha ao inscrever a WABA nos webhooks do app.",
            };
        }
        return { ok: true, alreadySubscribed: false, subscribed: true };
    }
}
exports.MetaWhatsappWebhookSubscriptionService = MetaWhatsappWebhookSubscriptionService;
