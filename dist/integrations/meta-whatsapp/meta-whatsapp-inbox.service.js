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
function canServeInbox(row, tenantId) {
    return Boolean(row &&
        row.tenantId === tenantId &&
        !row.disconnectedAt &&
        row.wabaId &&
        row.phoneNumberId &&
        (row.status === "connected" || row.status === "pending_confirmation"));
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
    async requireOwnedConversation(tenantId, conversationId, connection) {
        const row = await this.conversations.findByIdForTenant(tenantId, conversationId);
        if (!row || row.tenantId !== tenantId || row.connectionId !== connection.id) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        }
        if (!(0, meta_whatsapp_phone_identity_store_1.isInboxPhoneAllowed)(tenantId, row.phoneNumberId, connection.phoneNumberId)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        }
        return row;
    }
    async requireConnected(tenantId) {
        const connected = await this.connections.findConnectedByTenant(tenantId);
        if (canServeInbox(connected, tenantId) && connected)
            return connected;
        const open = await this.connections.findOpenByTenant(tenantId);
        if (canServeInbox(open, tenantId) && open)
            return open;
        throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
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
        const enabledIds = snapshots.filter((row) => row.inboxEnabled).map((row) => row.phoneNumberId);
        const listIds = (0, meta_whatsapp_phone_identity_store_1.inboxQueryPhoneIds)(tenant.tenantId, connection.phoneNumberId, selectedPhone);
        if (!enabledIds.length || (selectedPhone && !listIds.length)) {
            return {
                connected: true,
                poll: (0, meta_config_1.readMetaInboxPollMs)(),
                conversations: [],
                channels: [],
                selectedPhoneNumberId: selectedPhone || null,
                unreadCount: 0,
                page: { limit, offset, hasMore: false },
            };
        }
        const rows = await this.conversations.listForInbox({
            tenantId: tenant.tenantId,
            connectionId: connection.id,
            filter,
            assignedTo: auth.email,
            phoneNumberId: null,
            includePhoneNumberIds: listIds,
            limit: limit + 1,
            offset,
        });
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const unreadRows = await this.conversations.listUnreadByPhone(tenant.tenantId, connection.id);
        const unreadByPhone = new Map();
        let unreadAll = 0;
        for (const item of unreadRows) {
            if (!item.phoneNumberId || !listIds.includes(item.phoneNumberId))
                continue;
            unreadAll += item.unreadCount;
            unreadByPhone.set(item.phoneNumberId, (unreadByPhone.get(item.phoneNumberId) || 0) + item.unreadCount);
        }
        const channelIds = new Set(enabledIds);
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
        const row = await this.requireOwnedConversation(tenant.tenantId, conversationId, connection);
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
        await this.requireOwnedConversation(tenant.tenantId, conversationId, connection);
        const updated = await this.conversations.markRead(tenant.tenantId, conversationId);
        if (!updated)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("READ", { tenantId: tenant.tenantId });
        return (0, meta_whatsapp_inbox_types_1.toPublicInboxConversation)(updated, (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({ lastInboundAt: updated.lastInboundAt }));
    }
    async patchStatus(auth, conversationId, body) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnected(tenant.tenantId);
        await this.requireOwnedConversation(tenant.tenantId, conversationId, connection);
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
        await this.requireOwnedConversation(tenant.tenantId, conversationId, connection);
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
        const row = await this.requireOwnedConversation(tenant.tenantId, conversationId, connection);
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
