"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappTemplateRepository = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const TABLE = "meta_whatsapp_templates";
const COLUMNS = [
    "id",
    "tenant_id",
    "connection_id",
    "waba_id",
    "meta_template_id",
    "name",
    "language",
    "category",
    "status",
    "components_json",
    "quality_score",
    "rejected_reason",
    "created_at",
    "updated_at",
    "last_synced_at",
].join(", ");
function asRow(data) {
    if (!data || typeof data !== "object")
        throw new Error("Template Meta inválido.");
    return data;
}
function mapRow(row) {
    return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        connectionId: String(row.connection_id),
        wabaId: String(row.waba_id),
        metaTemplateId: row.meta_template_id ? String(row.meta_template_id) : null,
        name: String(row.name),
        language: String(row.language),
        category: row.category ? String(row.category) : null,
        status: row.status ? String(row.status) : null,
        qualityScore: row.quality_score ? String(row.quality_score) : null,
        components: row.components_json ?? null,
        rejectedReason: row.rejected_reason ? String(row.rejected_reason) : null,
        lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
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
class MetaWhatsappTemplateRepository {
    constructor(clientFactory = getClient) {
        this.clientFactory = clientFactory;
    }
    client() {
        return this.clientFactory();
    }
    async listByTenant(tenantId) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .order("name", { ascending: true });
        if (error)
            throw new Error(error.message);
        return (data || []).map((row) => mapRow(asRow(row)));
    }
    async listByTenantConnection(tenantId, connectionId) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .eq("connection_id", connectionId)
            .order("name", { ascending: true });
        if (error)
            throw new Error(error.message);
        return (data || []).map((row) => mapRow(asRow(row)));
    }
    async findForSend(tenantId, connectionId, name, language) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .eq("connection_id", connectionId)
            .eq("name", name)
            .eq("language", language)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async findByMetaId(tenantId, metaTemplateId) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .eq("meta_template_id", metaTemplateId)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async findByWabaNameLanguage(tenantId, wabaId, name, language) {
        const { data, error } = await this.client()
            .from(TABLE)
            .select(COLUMNS)
            .eq("tenant_id", tenantId)
            .eq("waba_id", wabaId)
            .eq("name", name)
            .eq("language", language)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : null;
    }
    async upsertFromGraph(input) {
        const existing = (input.metaTemplateId
            ? await this.findByMetaId(input.tenantId, input.metaTemplateId)
            : null) ||
            (await this.findByWabaNameLanguage(input.tenantId, input.wabaId, input.name, input.language));
        const payload = {
            tenant_id: input.tenantId,
            connection_id: input.connectionId,
            waba_id: input.wabaId,
            meta_template_id: input.metaTemplateId || null,
            name: input.name,
            language: input.language,
            category: input.category || null,
            status: input.status || null,
            components_json: input.components ?? null,
            quality_score: input.qualityScore || null,
            rejected_reason: input.rejectedReason || null,
            last_synced_at: input.lastSyncedAt,
            updated_at: new Date().toISOString(),
        };
        if (existing) {
            const { data, error } = await this.client()
                .from(TABLE)
                .update(payload)
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
            .insert(payload)
            .select(COLUMNS)
            .single();
        if (error)
            throw new Error(error.message);
        return mapRow(asRow(data));
    }
    async patchStatus(input) {
        let row = null;
        if (input.metaTemplateId) {
            row = await this.findByMetaId(input.tenantId, input.metaTemplateId);
        }
        if (!row && input.name && input.language) {
            row = await this.findByWabaNameLanguage(input.tenantId, input.wabaId, input.name, input.language);
        }
        if (!row)
            return null;
        const { data, error } = await this.client()
            .from(TABLE)
            .update({
            status: input.status,
            rejected_reason: input.rejectedReason || null,
            last_synced_at: input.atIso,
            updated_at: input.atIso,
        })
            .eq("id", row.id)
            .eq("tenant_id", input.tenantId)
            .select(COLUMNS)
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return data ? mapRow(asRow(data)) : row;
    }
}
exports.MetaWhatsappTemplateRepository = MetaWhatsappTemplateRepository;
