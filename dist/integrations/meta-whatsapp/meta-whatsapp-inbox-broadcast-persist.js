"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultInboxBroadcastMatcher = defaultInboxBroadcastMatcher;
exports.defaultInboxTemplateBodyLookup = defaultInboxTemplateBodyLookup;
exports.resolveBroadcastInboxText = resolveBroadcastInboxText;
exports.persistBroadcastOutboundInInbox = persistBroadcastOutboundInInbox;
exports.enrichInboxFromBroadcast = enrichInboxFromBroadcast;
const meta_whatsapp_template_repository_1 = require("./meta-whatsapp-template.repository");
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
const meta_whatsapp_broadcast_template_1 = require("./meta-whatsapp-broadcast-template");
const meta_whatsapp_inbox_types_1 = require("./meta-whatsapp-inbox.types");
const meta_whatsapp_inbox_template_preview_1 = require("./meta-whatsapp-inbox-template-preview");
const bodyCache = new Map();
function defaultInboxBroadcastMatcher(input) {
    return (0, meta_whatsapp_broadcast_store_1.findBroadcastLeadForInbox)(input);
}
async function defaultInboxTemplateBodyLookup(input) {
    const key = [
        input.tenantId,
        input.templateId || "",
        input.connectionId || "",
        input.templateName,
        input.language,
    ].join("|");
    const cached = bodyCache.get(key);
    if (cached != null)
        return cached || null;
    const repo = new meta_whatsapp_template_repository_1.MetaWhatsappTemplateRepository();
    try {
        if (input.templateId) {
            const byId = await repo.findByIdForTenant(input.tenantId, input.templateId);
            const text = (0, meta_whatsapp_inbox_template_preview_1.extractTemplateBodyText)(byId?.components);
            if (text) {
                bodyCache.set(key, text);
                return text;
            }
        }
        if (input.connectionId) {
            const byConn = await repo.findForSend(input.tenantId, input.connectionId, input.templateName, input.language);
            const text = (0, meta_whatsapp_inbox_template_preview_1.extractTemplateBodyText)(byConn?.components);
            if (text) {
                bodyCache.set(key, text);
                return text;
            }
        }
        const byName = await repo.findByNameLanguage(input.tenantId, input.templateName, input.language);
        const text = (0, meta_whatsapp_inbox_template_preview_1.extractTemplateBodyText)(byName?.components);
        bodyCache.set(key, text);
        return text || null;
    }
    catch {
        return null;
    }
}
async function resolveBroadcastInboxText(input) {
    const stored = String(input.match.lead.previewText || "").trim();
    if (stored)
        return stored;
    const lookup = input.lookup || defaultInboxTemplateBodyLookup;
    const bodyText = await lookup({
        tenantId: input.tenantId,
        connectionId: input.match.lead.connectionId || input.match.campaign.connectionId,
        templateId: input.match.campaign.templateId,
        templateName: input.match.campaign.templateName,
        language: input.match.campaign.language,
    });
    return (0, meta_whatsapp_inbox_template_preview_1.renderTemplateBodyText)({
        bodyText,
        inspect: bodyText ? (0, meta_whatsapp_broadcast_template_1.inspectMetaBroadcastTemplate)([{ type: "BODY", text: bodyText }]) : null,
        lead: input.match.lead,
        sendComponents: input.sendComponents,
    });
}
async function persistBroadcastOutboundInInbox(input) {
    const text = String(input.text || "").replace(/\s+/g, " ").trim();
    const preview = (0, meta_whatsapp_inbox_types_1.previewFromContent)({
        type: text ? "text" : "template",
        text,
        templateName: input.templateName,
    });
    let conversationId = String(input.conversationId || "").trim();
    if (conversationId && typeof input.conversations.patchLastMessagePreview === "function") {
        if (text && preview) {
            await input.conversations.patchLastMessagePreview(input.tenantId, conversationId, preview);
        }
    }
    else {
        const upserted = await input.conversations.upsertForContact({
            tenantId: input.tenantId,
            connectionId: input.connectionId,
            phoneNumberId: input.phoneNumberId,
            contactWaId: input.contactWaId,
            contactPhone: input.contactWaId,
            contactName: input.contactName,
            outbound: true,
            lastMessagePreview: preview,
            atIso: input.atIso,
        });
        conversationId = upserted.record.id;
    }
    const wamid = String(input.wamid || "").trim();
    if (wamid) {
        const existing = await input.messages.findByTenantWamid(input.tenantId, wamid);
        if (existing)
            return { conversationId, inserted: false };
    }
    const listed = await input.messages.listByConversation(input.tenantId, conversationId, 1);
    if (listed.length)
        return { conversationId, inserted: false };
    const inserted = await input.messages.insert({
        tenantId: input.tenantId,
        conversationId,
        connectionId: input.connectionId,
        wamid: wamid || null,
        direction: "outbound",
        type: "template",
        status: input.status || "accepted",
        fromWaId: input.phoneNumberId,
        toWaId: input.contactWaId,
        textContent: text || null,
        templateName: input.templateName || null,
        templateLanguage: input.templateLanguage || null,
        provider: "meta-cloud",
    });
    return { conversationId, inserted: !inserted.duplicate };
}
async function enrichInboxFromBroadcast(input) {
    const needsPreview = input.force || (0, meta_whatsapp_inbox_template_preview_1.isGenericInboxPreview)(input.conversation.lastMessagePreview);
    const listed = await input.messages.listByConversation(input.tenantId, input.conversation.id, 1);
    if (!needsPreview && listed.length) {
        return { preview: input.conversation.lastMessagePreview || null, inserted: false };
    }
    const matcher = input.matchBroadcast || defaultInboxBroadcastMatcher;
    const match = matcher({
        tenantId: input.tenantId,
        recipientId: input.conversation.contactWaId,
        phoneNumberId: input.conversation.phoneNumberId,
    });
    if (!match) {
        return { preview: input.conversation.lastMessagePreview || null, inserted: false };
    }
    const text = await resolveBroadcastInboxText({
        tenantId: input.tenantId,
        match,
        lookup: input.lookupBody,
    });
    if (!text && !match.campaign.templateName) {
        return { preview: input.conversation.lastMessagePreview || null, inserted: false };
    }
    const persisted = await persistBroadcastOutboundInInbox({
        tenantId: input.tenantId,
        connectionId: match.lead.connectionId || match.campaign.connectionId || input.conversation.connectionId,
        phoneNumberId: String(match.lead.phoneNumberId || input.conversation.phoneNumberId || "").trim(),
        contactWaId: input.conversation.contactWaId,
        contactName: input.conversation.contactName || match.lead.nome || null,
        wamid: match.lead.wamid || null,
        status: "accepted",
        atIso: new Date().toISOString(),
        text: text || "",
        templateName: match.campaign.templateName,
        templateLanguage: match.campaign.language,
        conversations: input.conversations,
        messages: input.messages,
        conversationId: input.conversation.id,
    });
    const preview = (0, meta_whatsapp_inbox_types_1.previewFromContent)({
        type: text ? "text" : "template",
        text,
        templateName: match.campaign.templateName,
    });
    return { preview, inserted: persisted.inserted };
}
