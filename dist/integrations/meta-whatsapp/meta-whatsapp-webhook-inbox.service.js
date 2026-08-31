"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappWebhookInboxService = void 0;
const meta_whatsapp_conversation_repository_1 = require("./meta-whatsapp-conversation.repository");
const meta_whatsapp_message_repository_1 = require("./meta-whatsapp-message.repository");
const meta_whatsapp_inbox_events_1 = require("./meta-whatsapp-inbox-events");
const meta_whatsapp_inbox_types_1 = require("./meta-whatsapp-inbox.types");
const meta_whatsapp_messaging_types_1 = require("./meta-whatsapp-messaging.types");
const meta_whatsapp_webhook_log_1 = require("./meta-whatsapp-webhook-log");
const meta_whatsapp_phone_identity_store_1 = require("./meta-whatsapp-phone-identity.store");
function isoFromUnix(value) {
    const n = Number(value || "");
    if (Number.isFinite(n) && n > 0)
        return new Date(n * 1000).toISOString();
    return new Date().toISOString();
}
class MetaWhatsappWebhookInboxService {
    constructor(conversations = new meta_whatsapp_conversation_repository_1.MetaWhatsappConversationRepository(), messages = new meta_whatsapp_message_repository_1.MetaWhatsappMessageRepository()) {
        this.conversations = conversations;
        this.messages = messages;
    }
    async persistInbound(input) {
        const from = String(input.event.fromWaId || "").trim();
        const wamid = String(input.event.messageId || "").trim();
        if (!from || !wamid)
            return;
        const phoneNumberId = String(input.event.phoneNumberId || input.connection.phoneNumberId || "").trim() || null;
        if (!phoneNumberId || !(0, meta_whatsapp_phone_identity_store_1.listEnabledInboxPhoneIds)(input.connection.tenantId).includes(phoneNumberId)) {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("PROCESSED", { eventType: "messages", reason: "inbox_disabled" });
            return;
        }
        const already = await this.messages.findByTenantWamid(input.connection.tenantId, wamid);
        if (already) {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("DUPLICATE", { eventType: "messages", reason: "wamid" });
            return;
        }
        const atIso = isoFromUnix(input.event.timestamp);
        const type = String(input.event.messageType || "unknown");
        const textContent = type === "text" ? input.event.textContent : null;
        const upserted = await this.conversations.upsertForContact({
            tenantId: input.connection.tenantId,
            connectionId: input.connection.id,
            phoneNumberId,
            contactWaId: from,
            contactPhone: from,
            contactName: input.event.contactName,
            inbound: true,
            lastMessagePreview: (0, meta_whatsapp_inbox_types_1.previewFromContent)({ text: textContent, type }),
            atIso,
        });
        await (0, meta_whatsapp_inbox_events_1.emitMetaInboxEvent)({
            name: upserted.created ? "conversation_created" : "conversation_updated",
            tenantId: input.connection.tenantId,
            conversationId: upserted.record.id,
            connectionId: input.connection.id,
            occurredAt: atIso,
        });
        const inserted = await this.messages.insert({
            tenantId: input.connection.tenantId,
            conversationId: upserted.record.id,
            connectionId: input.connection.id,
            wamid,
            direction: "inbound",
            type,
            status: "accepted",
            fromWaId: from,
            toWaId: phoneNumberId,
            textContent,
            provider: "meta-cloud",
        });
        if (inserted.duplicate) {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("DUPLICATE", { eventType: "messages", reason: "wamid" });
            return;
        }
        await (0, meta_whatsapp_inbox_events_1.emitMetaInboxEvent)({
            name: "inbound_message",
            tenantId: input.connection.tenantId,
            conversationId: upserted.record.id,
            messageId: inserted.record?.id,
            connectionId: input.connection.id,
            occurredAt: atIso,
        });
    }
    async applyStatus(input) {
        const wamid = String(input.event.messageId || "").trim();
        const next = (0, meta_whatsapp_messaging_types_1.mapWebhookStatus)(input.event.status);
        if (!wamid || !next)
            return;
        const atIso = isoFromUnix(input.event.timestamp);
        const applied = await this.messages.applyWebhookStatus(input.connection.tenantId, wamid, next, atIso, { code: input.event.errorCode, message: null });
        if (applied.record)
            return;
        const recipient = String(input.event.recipientId || "").trim();
        const phoneNumberId = String(input.event.phoneNumberId || input.connection.phoneNumberId || "").trim();
        if (!recipient || !phoneNumberId)
            return;
        if (!(0, meta_whatsapp_phone_identity_store_1.listEnabledInboxPhoneIds)(input.connection.tenantId).includes(phoneNumberId)) {
            return;
        }
        await this.conversations.upsertForContact({
            tenantId: input.connection.tenantId,
            connectionId: input.connection.id,
            phoneNumberId,
            contactWaId: recipient,
            contactPhone: recipient,
            outbound: true,
            lastMessagePreview: (0, meta_whatsapp_inbox_types_1.previewFromContent)({ type: "text", text: "Mensagem enviada" }),
            atIso,
        });
    }
}
exports.MetaWhatsappWebhookInboxService = MetaWhatsappWebhookInboxService;
