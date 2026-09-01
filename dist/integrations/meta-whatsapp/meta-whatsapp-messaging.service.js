"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappMessagingService = void 0;
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_cloud_provider_1 = require("../whatsapp/meta-cloud-provider");
const meta_whatsapp_conversation_repository_1 = require("./meta-whatsapp-conversation.repository");
const meta_whatsapp_message_repository_1 = require("./meta-whatsapp-message.repository");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_inbox_events_1 = require("./meta-whatsapp-inbox-events");
const meta_whatsapp_customer_care_window_1 = require("./meta-whatsapp-customer-care-window");
const meta_whatsapp_recipient_1 = require("./meta-whatsapp-recipient");
const meta_whatsapp_template_service_1 = require("./meta-whatsapp-template.service");
const meta_whatsapp_inbox_types_1 = require("./meta-whatsapp-inbox.types");
const meta_whatsapp_phone_identity_store_1 = require("./meta-whatsapp-phone-identity.store");
function requireTenant(auth) {
    try {
        return (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("unauthenticated");
    }
}
function warnIgnoredClientClaims(body, tenantId) {
    if (body?.tenant_id ||
        body?.tenantId ||
        body?.owner_email ||
        body?.ownerEmail ||
        body?.access_token ||
        body?.accessToken) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("ignored-client-send-claims", { tenantId });
    }
}
function sanitizeTemplateFromBody(value) {
    const row = value && typeof value === "object" ? value : {};
    const name = String(row.name || "").trim();
    const language = (0, meta_whatsapp_recipient_1.normalizeTemplateLanguage)(row.language);
    if (!name || !language)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
    const components = Array.isArray(row.components) ? row.components : [];
    return { name, language, components };
}
class MetaWhatsappMessagingService {
    constructor(provider = new meta_cloud_provider_1.MetaCloudProvider(), conversations = new meta_whatsapp_conversation_repository_1.MetaWhatsappConversationRepository(), messages = new meta_whatsapp_message_repository_1.MetaWhatsappMessageRepository(), templates = new meta_whatsapp_template_service_1.MetaWhatsappTemplateService()) {
        this.provider = provider;
        this.conversations = conversations;
        this.messages = messages;
        this.templates = templates;
    }
    async sendFromAuth(auth, body) {
        const tenant = requireTenant(auth);
        warnIgnoredClientClaims(body, tenant.tenantId);
        const cleaned = { ...(body || {}) };
        delete cleaned.source;
        return this.sendForTenant(tenant.tenantId, cleaned);
    }
    async sendForTenant(tenantId, body) {
        const type = String(body?.type || "text").trim().toLowerCase();
        const toRaw = String(body?.to || "").trim();
        const recipient = (0, meta_whatsapp_recipient_1.normalizeCloudApiRecipient)(toRaw);
        if (!recipient.ok)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_recipient");
        const conversationId = String(body?.conversationId || body?.conversation_id || "").trim();
        const existingConversation = conversationId
            ? await this.conversations.findByIdForTenant(tenantId, conversationId)
            : null;
        if (conversationId && !existingConversation) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        }
        const requestedConnection = String(body?.connectionId || body?.connection_id || "").trim();
        const requestedPhone = String(body?.phoneNumberId || body?.phone_number_id || "").trim();
        const preferredConnectionId = String(existingConversation?.connectionId || requestedConnection || "").trim();
        const preferredPhoneNumberId = String(existingConversation?.phoneNumberId || requestedPhone || "").trim();
        let connection;
        try {
            connection = await this.provider.requireConnected(tenantId, preferredConnectionId || undefined, preferredPhoneNumberId || undefined);
        }
        catch (error) {
            const canFallbackToFirstConnected = Boolean(preferredConnectionId) &&
                !requestedConnection &&
                error instanceof meta_whatsapp_errors_1.MetaWhatsappError &&
                error.code === "not_connected";
            if (canFallbackToFirstConnected) {
                connection = await this.provider.requireConnected(tenantId);
            }
            else {
                throw error;
            }
        }
        const sendPhoneNumberId = !existingConversation && requestedPhone
            ? requestedPhone
            : (0, meta_whatsapp_phone_identity_store_1.resolveInboxSendPhoneNumberId)({
                tenantId,
                connectionPhoneNumberId: connection.phoneNumberId,
                requestedPhoneNumberId: requestedPhone,
                conversationPhoneNumberId: existingConversation?.phoneNumberId,
            }) || String(existingConversation?.phoneNumberId || connection.phoneNumberId || "").trim() || null;
        const botSend = body?.source === "bot";
        const atIso = new Date().toISOString();
        const upserted = await this.conversations.upsertForContact({
            tenantId,
            connectionId: connection.id,
            phoneNumberId: sendPhoneNumberId,
            contactWaId: recipient.waId,
            contactPhone: recipient.waId,
            outbound: true,
            lastMessagePreview: (0, meta_whatsapp_inbox_types_1.previewFromContent)({
                text: type === "template" ? null : String(body?.text || "").trim(),
                type,
                templateName: type === "template" ? sanitizeTemplateFromBody(body?.template).name : null,
            }),
            atIso,
        });
        await (0, meta_whatsapp_inbox_events_1.emitMetaInboxEvent)({
            name: upserted.created ? "conversation_created" : "conversation_updated",
            tenantId,
            conversationId: upserted.record.id,
            connectionId: connection.id,
            occurredAt: atIso,
        });
        const isTemplate = type === "template";
        const template = isTemplate ? sanitizeTemplateFromBody(body?.template) : null;
        const text = isTemplate ? null : String(body?.text || "").trim();
        if (!isTemplate && !text)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        if (isTemplate && template) {
            await this.templates.assertSendable({
                tenantId,
                connectionId: connection.id,
                name: template.name,
                language: template.language,
            });
        }
        const inserted = await this.messages.insert({
            tenantId,
            conversationId: upserted.record.id,
            connectionId: connection.id,
            direction: "outbound",
            type: isTemplate ? "template" : "text",
            status: "queued",
            fromWaId: sendPhoneNumberId,
            toWaId: recipient.waId,
            textContent: text,
            templateName: template?.name || null,
            templateLanguage: template?.language || null,
            provider: botSend ? "automation" : "meta-cloud",
        });
        const localId = inserted.record?.id;
        if (!localId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        let send;
        try {
            send = isTemplate
                ? await this.provider.sendTemplate({
                    tenantId,
                    to: recipient.waId,
                    templateName: template.name,
                    language: template.language,
                    components: template.components,
                    connectionId: connection.id,
                    phoneNumberId: sendPhoneNumberId || undefined,
                })
                : await this.provider.sendText({
                    tenantId,
                    to: recipient.waId,
                    text: text,
                    connectionId: connection.id,
                    phoneNumberId: sendPhoneNumberId || undefined,
                });
        }
        catch (error) {
            await this.messages.updateAfterGraph(tenantId, localId, {
                status: "failed",
                errorCode: "send_failed",
                errorMessage: error instanceof Error ? error.message.slice(0, 180) : "send_failed",
            });
            throw error;
        }
        await this.messages.updateAfterGraph(tenantId, localId, {
            wamid: send.messageId,
            status: "accepted",
        });
        await (0, meta_whatsapp_inbox_events_1.emitMetaInboxEvent)({
            name: "outbound_message",
            tenantId,
            conversationId: upserted.record.id,
            messageId: localId,
            connectionId: connection.id,
            occurredAt: atIso,
        });
        const window = (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({ lastInboundAt: upserted.record.lastInboundAt });
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("message-sent", {
            tenantId,
            connectionId: connection.id,
            type: isTemplate ? "template" : "text",
            hasWamid: Boolean(send.messageId),
        });
        return {
            ...send,
            conversationId: upserted.record.id,
            customerCareWindow: {
                known: window.known,
                withinWindow: window.withinWindow,
            },
        };
    }
}
exports.MetaWhatsappMessagingService = MetaWhatsappMessagingService;
