"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_WHATSAPP_WEBHOOK_PATH = void 0;
exports.isMetaWhatsappWebhookPath = isMetaWhatsappWebhookPath;
exports.META_WHATSAPP_WEBHOOK_PATH = "/webhooks/meta/whatsapp";
function isMetaWhatsappWebhookPath(reqPath) {
    const p = String(reqPath || "/").replace(/\/+$/, "") || "/";
    return p === exports.META_WHATSAPP_WEBHOOK_PATH;
}
