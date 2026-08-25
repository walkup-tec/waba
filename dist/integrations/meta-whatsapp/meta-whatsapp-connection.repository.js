"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappConnectionRepository = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const TABLE = "meta_whatsapp_connections";
const COLUMNS = [
    "id",
    "tenant_id",
    "owner_email",
    "meta_business_id",
    "waba_id",
    "phone_number_id",
    "display_phone_number",
    "verified_name",
    "access_token_encrypted",
    "token_type",
    "token_expires_at",
    "config_id",
    "status",
    "quality_rating",
    "messaging_limit",
    "last_token_validation_at",
    "last_webhook_at",
    "last_error",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
    "connected_at",
    "disconnected_at",
].join(", ");
function asRow(data) {
    if (!data || typeof data !== "object") {
        throw new Error("Linha Meta inválida.");
    }
    return data;
}
function mapRow(row) {
    return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        ownerEmail: String(row.owner_email || "").toLowerCase(),
        metaBusinessId: row.meta_business_id ? String(row.meta_business_id) : null,
        wabaId: row.waba_id ? String(row.waba_id) : null,
        phoneNumberId: row.phone_number_id ? String(row.phone_number_id) : null,
        displayPhoneNumber: row.display_phone_number ? String(row.display_phone_number) : null,
        verifiedName: row.verified_name ? String(row.verified_name) : null,
        accessTokenEncrypted: String(row.access_token_encrypted || ""),
        tokenType: String(row.token_type || "bearer"),
        tokenExpiresAt: row.token_expires_at ? String(row.token_expires_at) : null,
        configId: row.config_id ? String(row.config_id) : null,
        status: String(row.status || "pending_token"),
        qualityRating: row.quality_rating ? String(row.quality_rating) : null,
        messagingLimit: row.messaging_limit ? String(row.messaging_limit) : null,
        lastTokenValidationAt: row.last_token_validation_at ? String(row.last_token_validation_at) : null,
        lastWebhookAt: row.last_webhook_at ? String(row.last_webhook_at) : null,
        lastError: row.last_error ? String(row.last_error) : null,
        createdBy: row.created_by ? String(row.created_by) : null,
        updatedBy: row.updated_by ? String(row.updated_by) : null,
        createdAt: String(row.created_at || ""),
        updatedAt: String(row.updated_at || ""),
        connectedAt: row.connected_at ? String(row.connected_at) : null,
        disconnectedAt: row.disconnected_at ? String(row.disconnected_at) : null,
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
class MetaWhatsappConnectionRepository {
    constructor(clientFactory = getClient) {
        this.clientFactory = clientFactory;
    }
    client() {
        return this.clientFactory();
    }
    async findOpenByTenant(tenantId) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .is("disconnected_at", null)
            .in("status", ["pending_token", "pending_confirmation", "connected"])
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async findByIdForTenant(tenantId, id) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .eq("id", id)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async upsertPendingToken(input) {
        const existing = await this.findOpenByTenant(input.tenantId);
        const now = new Date().toISOString();
        if (existing) {
            const { data, error } = await this.client()
                .from(TABLE)
                .update({
                owner_email: input.ownerEmail,
                access_token_encrypted: input.accessTokenEncrypted,
                token_type: input.tokenType || "bearer",
                token_expires_at: input.tokenExpiresAt || null,
                config_id: input.configId || null,
                meta_business_id: input.metaBusinessId || existing.metaBusinessId,
                status: existing.wabaId ? "pending_confirmation" : "pending_token",
                last_error: null,
                updated_by: input.actorEmail,
                disconnected_at: null,
            })
                .eq("id", existing.id)
                .eq("tenant_id", input.tenantId)
                .select(COLUMNS)
                .single();
            if (error)
                throw new Error(error.message);
            return mapRow(asRow(data));
        }
        const { data, error } = await this.client()
            .from(TABLE)
            .insert({
            tenant_id: input.tenantId,
            owner_email: input.ownerEmail,
            access_token_encrypted: input.accessTokenEncrypted,
            token_type: input.tokenType || "bearer",
            token_expires_at: input.tokenExpiresAt || null,
            config_id: input.configId || null,
            meta_business_id: input.metaBusinessId || null,
            status: "pending_token",
            created_by: input.actorEmail,
            updated_by: input.actorEmail,
            created_at: now,
            updated_at: now,
        })
            .select(COLUMNS)
            .single();
        if (error)
            throw new Error(error.message);
        return mapRow(asRow(data));
    }
    async attachClaimedAssets(tenantId, connectionId, input) {
        const { data, error } = await this.client()
            .from(TABLE)
            .update({
            waba_id: input.wabaId || null,
            phone_number_id: input.phoneNumberId || null,
            meta_business_id: input.metaBusinessId || null,
            display_phone_number: input.displayPhoneNumber || null,
            verified_name: input.verifiedName || null,
            status: input.wabaId ? "pending_confirmation" : "pending_token",
            updated_by: input.actorEmail,
            last_error: null,
        })
            .eq("id", connectionId)
            .eq("tenant_id", tenantId)
            .is("disconnected_at", null)
            .select(COLUMNS)
            .single();
        if (error)
            throw new Error(error.message);
        return mapRow(asRow(data));
    }
    async findConnectedByTenant(tenantId) {
        const id = String(tenantId || "").trim();
        if (!id)
            return null;
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", id)
            .eq("status", "connected")
            .is("disconnected_at", null)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async findConnectedByPhoneNumberId(phoneNumberId) {
        const id = String(phoneNumberId || "").trim();
        if (!id)
            return null;
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("phone_number_id", id)
            .eq("status", "connected")
            .is("disconnected_at", null)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async findConnectedByWabaId(wabaId) {
        const id = String(wabaId || "").trim();
        if (!id)
            return null;
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("waba_id", id)
            .eq("status", "connected")
            .is("disconnected_at", null)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async touchLastWebhookAt(tenantId, connectionId, atIso) {
        const { error } = await this.client()
            .from(TABLE)
            .update({ last_webhook_at: atIso })
            .eq("id", connectionId)
            .eq("tenant_id", tenantId)
            .eq("status", "connected");
        if (error)
            throw new Error(error.message);
    }
    async markConnected(tenantId, connectionId, patch) {
        const now = new Date().toISOString();
        const { data, error } = await this.client()
            .from(TABLE)
            .update({
            status: "connected",
            connected_at: now,
            last_token_validation_at: now,
            last_error: null,
            display_phone_number: patch.displayPhoneNumber || null,
            verified_name: patch.verifiedName || null,
            quality_rating: patch.qualityRating || null,
            updated_by: patch.actorEmail,
            disconnected_at: null,
        })
            .eq("id", connectionId)
            .eq("tenant_id", tenantId)
            .is("disconnected_at", null)
            .in("status", ["pending_confirmation", "pending_token", "connected"])
            .select(COLUMNS)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async patchConfirmedMetadata(tenantId, connectionId, patch) {
        const update = {};
        const quality = String(patch.qualityRating || "").trim();
        const name = String(patch.verifiedName || "").trim();
        if (quality)
            update.quality_rating = quality;
        if (name)
            update.verified_name = name;
        if (!Object.keys(update).length)
            return;
        const { error } = await this.client()
            .from(TABLE)
            .update(update)
            .eq("id", connectionId)
            .eq("tenant_id", tenantId)
            .eq("status", "connected");
        if (error)
            throw new Error(error.message);
    }
}
exports.MetaWhatsappConnectionRepository = MetaWhatsappConnectionRepository;
