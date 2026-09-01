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
function channelLabel(channel, verifiedName) {
    const meta = String(verifiedName || "").trim();
    if (meta)
        return meta;
    return String(channel?.name || channel?.displayPhoneNumber || "WhatsApp Oficial").trim();
}
function verifiedNamesByPhone(connections) {
    const map = new Map();
    for (const row of connections) {
        const id = String(row.phoneNumberId || "").trim();
        const name = String(row.verifiedName || "").trim();
        if (id && name)
            map.set(id, name);
    }
    return map;
}
function canServeInbox(row, tenantId) {
    return Boolean(row &&
        row.tenantId === tenantId &&
        !row.disconnectedAt &&
        row.wabaId &&
        row.phoneNumberId &&
        (row.status === "connected" || row.status === "pending_confirmation"));
}
function withChannel(row, channelsById, connectionPhone, connectionName, verifiedByPhone) {
    const id = String(row.phoneNumberId || "").trim();
    const snapshot = id ? channelsById.get(id) : undefined;
    const verified = (id && verifiedByPhone.get(id)) ||
        (id && id === String(connectionPhone || "") ? connectionName : null);
    return (0, meta_whatsapp_inbox_types_1.toPublicInboxConversation)(row, (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({ lastInboundAt: row.lastInboundAt }), {
        name: channelLabel(snapshot, verified),
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
    async inboxConnections(tenantId) {
        const open = await this.connections.listInboxConnections(tenantId);
        const usable = open.filter((row) => canServeInbox(row, tenantId));
        if (!usable.length) {
            const fallback = await this.requireConnected(tenantId);
            return [fallback];
        }
        return usable;
    }
    async requireOwnedConversation(tenantId, conversationId) {
        const row = await this.conversations.findByIdForTenant(tenantId, conversationId);
        if (!row || row.tenantId !== tenantId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        }
        const open = await this.inboxConnections(tenantId);
        const connPhones = open.map((item) => item.phoneNumberId).filter((id) => Boolean(id));
        if (!(0, meta_whatsapp_phone_identity_store_1.isInboxPhoneAllowed)(tenantId, row.phoneNumberId, connPhones)) {
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
        const open = await this.inboxConnections(tenant.tenantId);
        const connection = open[0];
        const filter = parseFilter(query?.filter);
        const selectedPhone = String(query?.phoneNumberId || query?.phone_number_id || "").trim();
        const limit = Math.min(50, Math.max(1, clampPage(query?.limit, 30, 50) || 30));
        const offset = clampPage(query?.offset, 0, 10000);
        const verifiedByPhone = verifiedNamesByPhone(open);
        const snapshots = (0, meta_whatsapp_phone_identity_store_1.listPhoneInboxChannels)(tenant.tenantId, verifiedByPhone);
        const channelsById = new Map(snapshots.map((row) => [row.phoneNumberId, row]));
        const enabledIds = snapshots.filter((row) => row.inboxEnabled).map((row) => row.phoneNumberId);
        const connPhones = open.map((row) => row.phoneNumberId).filter((id) => Boolean(id));
        const listIds = (0, meta_whatsapp_phone_identity_store_1.inboxQueryPhoneIds)(tenant.tenantId, connPhones, selectedPhone);
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
            filter,
            assignedTo: auth.email,
            phoneNumberId: null,
            includePhoneNumberIds: listIds,
            limit: limit + 1,
            offset,
        });
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const unreadRows = await this.conversations.listUnreadByPhone(tenant.tenantId);
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
            const matching = open.find((row) => String(row.phoneNumberId || "") === id) || connection;
            const isConnection = id === String(matching.phoneNumberId || "");
            return {
                phoneNumberId: id,
                name: channelLabel(snap, verifiedByPhone.get(id) || (isConnection ? matching.verifiedName : null)),
                displayPhoneNumber: snap?.displayPhoneNumber || (isConnection ? matching.displayPhoneNumber : null),
                profilePictureUrl: snap?.profilePictureUrl || null,
                unreadCount: unreadByPhone.get(id) || 0,
            };
        });
        const poll = (0, meta_config_1.readMetaInboxPollMs)();
        const byConn = new Map(open.map((row) => [row.id, row]));
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("LIST", { tenantId: tenant.tenantId, filter, count: page.length });
        return {
            connected: true,
            poll,
            conversations: page.map((row) => {
                const origin = byConn.get(row.connectionId) || connection;
                return withChannel(row, channelsById, origin.displayPhoneNumber, origin.verifiedName, verifiedByPhone);
            }),
            channels,
            selectedPhoneNumberId: selectedPhone || null,
            unreadCount: unreadAll,
            page: { limit, offset, hasMore },
        };
    }
    async listMessages(auth, conversationId, query) {
        const tenant = requireTenant(auth);
        const open = await this.inboxConnections(tenant.tenantId);
        const row = await this.requireOwnedConversation(tenant.tenantId, conversationId);
        const origin = open.find((item) => item.id === row.connectionId) || open[0];
        const limit = Math.min(80, Math.max(1, clampPage(query?.limit, 80, 80) || 80));
        const messages = await this.messages.listByConversation(tenant.tenantId, row.id, limit);
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("THREAD", { tenantId: tenant.tenantId, count: messages.length });
        const verifiedByPhone = verifiedNamesByPhone(open);
        const snapshots = (0, meta_whatsapp_phone_identity_store_1.listPhoneInboxChannels)(tenant.tenantId, verifiedByPhone);
        const channelsById = new Map(snapshots.map((item) => [item.phoneNumberId, item]));
        return {
            conversation: withChannel(row, channelsById, origin.displayPhoneNumber, origin.verifiedName, verifiedByPhone),
            messages: messages.map(meta_whatsapp_inbox_types_1.toPublicInboxMessage),
        };
    }
    async markRead(auth, conversationId) {
        const tenant = requireTenant(auth);
        await this.requireOwnedConversation(tenant.tenantId, conversationId);
        const updated = await this.conversations.markRead(tenant.tenantId, conversationId);
        if (!updated)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        (0, meta_whatsapp_inbox_log_1.logMetaInbox)("READ", { tenantId: tenant.tenantId });
        return (0, meta_whatsapp_inbox_types_1.toPublicInboxConversation)(updated, (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({ lastInboundAt: updated.lastInboundAt }));
    }
    async patchStatus(auth, conversationId, body) {
        const tenant = requireTenant(auth);
        await this.requireOwnedConversation(tenant.tenantId, conversationId);
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
        await this.requireOwnedConversation(tenant.tenantId, conversationId);
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
        const row = await this.requireOwnedConversation(tenant.tenantId, conversationId);
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
