"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappConversationRepository = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const TABLE = "meta_whatsapp_conversations";
const COLUMNS = [
    "id",
    "tenant_id",
    "connection_id",
    "phone_number_id",
    "contact_wa_id",
    "contact_phone",
    "contact_name",
    "status",
    "assigned_to",
    "last_message_at",
    "last_inbound_at",
    "last_outbound_at",
    "unread_count",
    "human_takeover",
    "last_message_preview",
    "created_at",
    "updated_at",
].join(", ");
function asRow(data) {
    if (!data || typeof data !== "object")
        throw new Error("Conversa Meta inválida.");
    return data;
}
function mapRow(row) {
    return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        connectionId: String(row.connection_id),
        phoneNumberId: row.phone_number_id ? String(row.phone_number_id) : null,
        contactWaId: String(row.contact_wa_id),
        contactPhone: row.contact_phone ? String(row.contact_phone) : null,
        contactName: row.contact_name ? String(row.contact_name) : null,
        status: String(row.status || "open"),
        assignedTo: row.assigned_to ? String(row.assigned_to) : null,
        lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
        lastInboundAt: row.last_inbound_at ? String(row.last_inbound_at) : null,
        lastOutboundAt: row.last_outbound_at ? String(row.last_outbound_at) : null,
        unreadCount: Number(row.unread_count || 0),
        humanTakeover: row.human_takeover === true,
        lastMessagePreview: row.last_message_preview ? String(row.last_message_preview) : null,
        createdAt: String(row.created_at || ""),
        updatedAt: String(row.updated_at || ""),
    };
}
function getClient() {
    const url = String(process.env.SUPABASE_URL || "").trim();
    const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!url || !key) {
        throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    }
    return (0, supabase_js_1.createClient)(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
class MetaWhatsappConversationRepository {
    constructor(clientFactory = getClient) {
        this.clientFactory = clientFactory;
    }
    client() {
        return this.clientFactory();
    }
    async findByTenantContact(tenantId, contactWaId) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .eq("contact_wa_id", contactWaId)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async findByTenantPhoneContact(tenantId, phoneNumberId, contactWaId) {
        const phone = String(phoneNumberId || "").trim();
        if (!phone)
            return null;
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .eq("phone_number_id", phone)
            .eq("contact_wa_id", contactWaId)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async findByTenantConnectionContact(tenantId, connectionId, contactWaId) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .eq("connection_id", connectionId)
            .eq("contact_wa_id", contactWaId)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async upsertForContact(input) {
        const phoneNumberId = String(input.phoneNumberId || "").trim();
        const existing = phoneNumberId
            ? await this.findByTenantPhoneContact(input.tenantId, phoneNumberId, input.contactWaId)
            : await this.findByTenantConnectionContact(input.tenantId, input.connectionId, input.contactWaId);
        if (existing) {
            const unread = input.inbound ? existing.unreadCount + 1 : existing.unreadCount;
            const { data, error } = await this.client()
                .from(TABLE)
                .update({
                connection_id: input.connectionId,
                phone_number_id: input.phoneNumberId || existing.phoneNumberId,
                contact_phone: input.contactPhone || existing.contactPhone,
                contact_name: input.contactName || existing.contactName,
                last_message_at: input.atIso,
                last_inbound_at: input.inbound ? input.atIso : existing.lastInboundAt,
                last_outbound_at: input.outbound ? input.atIso : existing.lastOutboundAt,
                last_message_preview: input.lastMessagePreview === undefined
                    ? existing.lastMessagePreview
                    : input.lastMessagePreview,
                unread_count: unread,
                status: existing.status === "closed" && input.inbound ? "open" : existing.status,
            })
                .eq("id", existing.id)
                .eq("tenant_id", input.tenantId)
                .select(COLUMNS)
                .single();
            if (error)
                throw new Error(error.message);
            return { record: mapRow(asRow(data)), created: false };
        }
        const { data, error } = await this.client()
            .from(TABLE)
            .insert({
            tenant_id: input.tenantId,
            connection_id: input.connectionId,
            phone_number_id: input.phoneNumberId || null,
            contact_wa_id: input.contactWaId,
            contact_phone: input.contactPhone || null,
            contact_name: input.contactName || null,
            status: "open",
            assigned_to: null,
            human_takeover: false,
            last_message_at: input.atIso,
            last_inbound_at: input.inbound ? input.atIso : null,
            last_outbound_at: input.outbound ? input.atIso : null,
            last_message_preview: input.lastMessagePreview || null,
            unread_count: input.inbound ? 1 : 0,
            created_at: input.atIso,
            updated_at: input.atIso,
        })
            .select(COLUMNS)
            .single();
        if (error)
            throw new Error(error.message);
        return { record: mapRow(asRow(data)), created: true };
    }
    async findByIdForTenant(tenantId, id) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("id", id)
            .eq("tenant_id", tenantId)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async listForInbox(input) {
        let query = this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", input.tenantId)
            .order("last_message_at", { ascending: false })
            .range(input.offset, input.offset + input.limit - 1);
        const connectionIds = (input.connectionIds || [])
            .map((id) => String(id || "").trim())
            .filter(Boolean);
        if (connectionIds.length)
            query = query.in("connection_id", connectionIds);
        else if (input.connectionId)
            query = query.eq("connection_id", input.connectionId);
        if (input.filter === "unread")
            query = query.gt("unread_count", 0);
        if (input.filter === "open" || input.filter === "pending" || input.filter === "closed") {
            query = query.eq("status", input.filter);
        }
        if (input.filter === "mine")
            query = query.eq("assigned_to", String(input.assignedTo || ""));
        const selected = String(input.phoneNumberId || "").trim();
        if (selected) {
            query = query.eq("phone_number_id", selected);
        }
        else if (input.includePhoneNumberIds) {
            const ids = input.includePhoneNumberIds.map((id) => String(id || "").trim()).filter(Boolean);
            if (!ids.length)
                return [];
            query = query.in("phone_number_id", ids);
        }
        else if (input.excludePhoneNumberIds && input.excludePhoneNumberIds.length) {
            const ids = input.excludePhoneNumberIds.map((id) => String(id || "").trim()).filter(Boolean);
            if (ids.length) {
                query = query.or(`phone_number_id.is.null,phone_number_id.not.in.(${ids.join(",")})`);
            }
        }
        const { data, error } = await query;
        if (error)
            throw new Error(error.message);
        return (data || []).map((row) => mapRow(asRow(row)));
    }
    async listUnreadByPhone(tenantId, connectionIds) {
        let query = this.client()
            .from(TABLE)
            .select("phone_number_id, unread_count")
            .eq("tenant_id", tenantId)
            .gt("unread_count", 0);
        const ids = (connectionIds || []).map((id) => String(id || "").trim()).filter(Boolean);
        if (ids.length)
            query = query.in("connection_id", ids);
        const { data, error } = await query;
        if (error)
            throw new Error(error.message);
        return (data || []).map((row) => {
            const rec = asRow(row);
            return {
                phoneNumberId: rec.phone_number_id ? String(rec.phone_number_id) : null,
                unreadCount: Number(rec.unread_count || 0),
            };
        });
    }
    async markRead(tenantId, id) {
        const { data, error } = await this.client()
            .from(TABLE)
            .update({ unread_count: 0 })
            .eq("id", id)
            .eq("tenant_id", tenantId)
            .select(COLUMNS)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async patchStatus(tenantId, id, status) {
        const { data, error } = await this.client()
            .from(TABLE)
            .update({ status })
            .eq("id", id)
            .eq("tenant_id", tenantId)
            .select(COLUMNS)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async assign(tenantId, id, assignedTo, humanTakeover) {
        const { data, error } = await this.client()
            .from(TABLE)
            .update({ assigned_to: assignedTo, human_takeover: humanTakeover })
            .eq("id", id)
            .eq("tenant_id", tenantId)
            .select(COLUMNS)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
}
exports.MetaWhatsappConversationRepository = MetaWhatsappConversationRepository;
