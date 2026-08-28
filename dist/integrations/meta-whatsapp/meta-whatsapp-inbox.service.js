"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappInboxService = void 0;
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_conversation_repository_1 = require("./meta-whatsapp-conversation.repository");
const meta_whatsapp_message_repository_1 = require("./meta-whatsapp-message.repository");
const meta_whatsapp_messaging_service_1 = require("./meta-whatsapp-messaging.service");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_inbox_log_1 = require("./meta-whatsapp-inbox-log");
const meta_config_1 = require("./meta-config");
const meta_whatsapp_customer_care_window_1 = require("./meta-whatsapp-customer-care-window");
const meta_whatsapp_phone_identity_store_1 = require("./meta-whatsapp-phone-identity.store");
const meta_whatsapp_inbox_types_1 = require("./meta-whatsapp-inbox.types");
const FILTERS = new Set(["all", "unread", "open", "pending", "closed", "mine"]);
const STATUSES = new Set(["open", "pending", "closed"]);
function requireTenant(auth) {
    try {
        return (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("unauthenticated");
    }
}
function parseFilter(raw) {
    const value = String(raw || "all").trim().toLowerCase();
    return FILTERS.has(value) ? value : "all";
}
function clampPage(raw, fallback, max) {
    const n = Number(raw);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(0, Math.floor(n)));
}
function channelLabel(channel, fallbackPhone) {
    return String(channel?.name || channel?.displayPhoneNumber || fallbackPhone || "WhatsApp Oficial").trim();
}
function withChannel(row, channelsById, connectionPhone, connectionName) {
    const id = String(row.phoneNumberId || "").trim();
    const snapshot = id ? channelsById.get(id) : undefined;
    return (0, meta_whatsapp_inbox_types_1.toPublicInboxConversation)(row, (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({ lastInboundAt: row.lastInboundAt }), {
        name: channelLabel(snapshot, snapshot?.displayPhoneNumber || connectionName),
        phone: snapshot?.displayPhoneNumber || (id && id === String(connectionPhone || "") ? connectionPhone : null),
        photoUrl: snapshot?.profilePictureUrl || null,
    });
}
class MetaWhatsappInboxService {
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), conversations = new meta_whatsapp_conversation_repository_1.MetaWhatsappConversationRepository(), messages = new meta_whatsapp_message_repository_1.MetaWhatsappMessageRepository(), messaging = new meta_whatsapp_messaging_service_1.MetaWhatsappMessagingService()) {
        this.connections = connections;
        this.conversations = conversations;
        this.messages = messages;
        this.messaging = messaging;
    }
    async requireOwnedConversation(tenantId, conversationId, connectionId) {
        const row = await this.conversations.findByIdForTenant(tenantId, conversationId);
        if (!row || row.tenantId !== tenantId || row.connectionId !== connectionId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        }
        if (row.phoneNumberId) {
            const snapshot = (0, meta_whatsapp_phone_identity_store_1.listPhoneInboxChannels)(tenantId).find((item) => item.phoneNumberId === row.phoneNumberId);
            if (snapshot && !snapshot.inboxEnabled) {
                throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
            }
        }
        return row;
    }
    async requireConnected(tenantId) {
        const row = await this.connections.findConnectedByTenant(tenantId);
        if (!row || row.status !== "connected" || row.tenantId !== tenantId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        return row;
    }
    async listConversations(auth, query) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnected(tenant.tenantId);
        const filter = parseFilter(query?.filter);
        const selectedPhone = String(query?.phoneNumberId || query?.phone_number_id || "").trim();
        const limit = Math.min(50, Math.max(1, clampPage(query?.limit, 30, 50) || 30));
        const offset = clampPage(query?.offset, 0, 10000);
        const snapshots = (0, meta_whatsapp_phone_identity_store_1.listPhoneInboxChannels)(tenant.tenantId);
        const channelsById = new Map(snapshots.map((row) => [row.phoneNumberId, row]));
        const disabledIds = snapshots.filter((row) => !row.inboxEnabled).map((row) => row.phoneNumberId);
        if (selectedPhone && disabledIds.includes(selectedPhone)) {
            return {
                connected: true,
                poll: (0, meta_config_1.readMetaInboxPollMs)(),
                conversations: [],
                channels: [],
                selectedPhoneNumberId: selectedPhone,
                page: { limit, offset, hasMore: false },
            };
        }
        const rows = await this.conversations.listForInbox({
            tenantId: tenant.tenantId,
            connectionId: connection.id,
            filter,
            assignedTo: auth.email,
            phoneNumberId: selectedPhone || null,
            excludePhoneNumberIds: selectedPhone ? [] : disabledIds,
            limit: limit + 1,
            offset,
        });
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const unreadRows = await this.conversations.listUnreadByPhone(tenant.tenantId, connection.id);
        const unreadByPhone = new Map();
        let unreadAll = 0;
        for (const item of unreadRows) {
            if (item.phoneNumberId && disabledIds.includes(item.phoneNumberId))
                continue;
            unreadAll += item.unreadCount;
            if (item.phoneNumberId) {
                unreadByPhone.set(item.phoneNumberId, (unreadByPhone.get(item.phoneNumberId) || 0) + item.unreadCount);
            }
        }
        const channelIds = new Set();
        for (const snap of snapshots) {
            if (snap.inboxEnabled)
                channelIds.add(snap.phoneNumberId);
        }
        if (connection.phoneNumberId && !disabledIds.includes(connection.phoneNumberId)) {
            channelIds.add(connection.phoneNumberId);
        }
        for (const row of page) {
            if (row.phoneNumberId && !disabledIds.includes(row.phoneNumberId))
                channelIds.add(row.phoneNumberId);
        }
        const channels = Array.from(channelIds).map((id) => {
            const snap = channelsById.get(id);
            const isConnection = id === String(connection.phoneNumberId || "");
            return {
                phoneNumberId: id,
                name: channelLabel(snap, isConnection ? connection.verifiedName : id),
                displayPhoneNumber: snap?.displayPhoneNumber || (isConnection ? connection.displayPhoneNumber : null),
                profilePictureUrl: snap?.profilePictureUrl || null,
                unreadCount: unreadByPhone.get(id) || 0,
            };
        });
        const poll = (0, meta_config_1.readMetaInboxPollMs)();
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("LIST", { tenantId: tenant.tenantId, filter, count: page.length });
        return {
            connected: true,
            poll,
            conversations: page.map((row) => withChannel(row, channelsById, connection.displayPhoneNumber, connection.verifiedName)),
            channels,
            selectedPhoneNumberId: selectedPhone || null,
            unreadCount: unreadAll,
            page: { limit, offset, hasMore },
        };
    }
    async listMessages(auth, conversationId, query) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnected(tenant.tenantId);
        const row = await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
        const limit = Math.min(80, Math.max(1, clampPage(query?.limit, 80, 80) || 80));
        const messages = await this.messages.listByConversation(tenant.tenantId, row.id, limit);
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("THREAD", { tenantId: tenant.tenantId, count: messages.length });
        const snapshots = (0, meta_whatsapp_phone_identity_store_1.listPhoneInboxChannels)(tenant.tenantId);
        const channelsById = new Map(snapshots.map((item) => [item.phoneNumberId, item]));
        return {
            conversation: withChannel(row, channelsById, connection.displayPhoneNumber, connection.verifiedName),
            messages: messages.map(meta_whatsapp_inbox_types_1.toPublicInboxMessage),
        };
    }
    async markRead(auth, conversationId) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnected(tenant.tenantId);
        await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
        const updated = await this.conversations.markRead(tenant.tenantId, conversationId);
        if (!updated)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("READ", { tenantId: tenant.tenantId });
        return (0, meta_whatsapp_inbox_types_1.toPublicInboxConversation)(updated, (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({ lastInboundAt: updated.lastInboundAt }));
    }
    async patchStatus(auth, conversationId, body) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnected(tenant.tenantId);
        await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
        const status = String(body?.status || "").trim().toLowerCase();
        if (!STATUSES.has(status))
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const updated = await this.conversations.patchStatus(tenant.tenantId, conversationId, status);
        if (!updated)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("STATUS", { tenantId: tenant.tenantId, status });
        return (0, meta_whatsapp_inbox_types_1.toPublicInboxConversation)(updated, (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({ lastInboundAt: updated.lastInboundAt }));
    }
    async assign(auth, conversationId, body) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnected(tenant.tenantId);
        await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
        const action = String(body?.action || "").trim().toLowerCase();
        if (action !== "assume" && action !== "release")
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const assume = action === "assume";
        const updated = await this.conversations.assign(tenant.tenantId, conversationId, assume ? auth.email : null, assume);
        if (!updated)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("ASSIGN", { tenantId: tenant.tenantId, assume });
        return (0, meta_whatsapp_inbox_types_1.toPublicInboxConversation)(updated, (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({ lastInboundAt: updated.lastInboundAt }));
    }
    async sendMessage(auth, conversationId, body) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnected(tenant.tenantId);
        const row = await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("SEND", { tenantId: tenant.tenantId, type: String(body?.type || "text") });
        const result = await this.messaging.sendFromAuth(auth, {
            ...(body && typeof body === "object" ? body : {}),
            to: row.contactWaId,
            conversationId: row.id,
            tenant_id: undefined,
            access_token: undefined,
        });
        const thread = await this.messages.listByConversation(tenant.tenantId, row.id, 1);
        const last = thread[thread.length - 1] || null;
        return {
            ...result,
            message: last ? (0, meta_whatsapp_inbox_types_1.toPublicInboxMessage)(last) : null,
        };
    }
}
exports.MetaWhatsappInboxService = MetaWhatsappInboxService;
