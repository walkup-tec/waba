import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MetaTemplateRecord } from "./meta-whatsapp-template.types";

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

type DbRow = Record<string, unknown>;

function asRow(data: unknown): DbRow {
  if (!data || typeof data !== "object") throw new Error("Template Meta inválido.");
  return data as DbRow;
}

function mapRow(row: DbRow): MetaTemplateRecord {
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

function getClient(): SupabaseClient {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type UpsertTemplateInput = {
  tenantId: string;
  connectionId: string;
  wabaId: string;
  metaTemplateId?: string | null;
  name: string;
  language: string;
  category?: string | null;
  status?: string | null;
  components?: unknown;
  qualityScore?: string | null;
  rejectedReason?: string | null;
  lastSyncedAt: string;
};

export class MetaWhatsappTemplateRepository {
  constructor(private readonly clientFactory: () => SupabaseClient = getClient) {}

  private client(): SupabaseClient {
    return this.clientFactory();
  }

  async listByTenant(tenantId: string): Promise<MetaTemplateRecord[]> {
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapRow(asRow(row)));
  }

  async listByTenantConnection(tenantId: string, connectionId: string): Promise<MetaTemplateRecord[]> {
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("connection_id", connectionId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapRow(asRow(row)));
  }

  async findForSend(
    tenantId: string,
    connectionId: string,
    name: string,
    language: string,
  ): Promise<MetaTemplateRecord | null> {
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("connection_id", connectionId)
      .eq("name", name)
      .eq("language", language)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async findByIdForTenant(tenantId: string, id: string): Promise<MetaTemplateRecord | null> {
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async deleteForTenant(tenantId: string, id: string): Promise<boolean> {
    const { data, error } = await this.client()
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  async findByMetaId(tenantId: string, metaTemplateId: string): Promise<MetaTemplateRecord | null> {
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("meta_template_id", metaTemplateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async findByWabaNameLanguage(
    tenantId: string,
    wabaId: string,
    name: string,
    language: string,
  ): Promise<MetaTemplateRecord | null> {
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("waba_id", wabaId)
      .eq("name", name)
      .eq("language", language)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async upsertFromGraph(input: UpsertTemplateInput): Promise<MetaTemplateRecord> {
    const existing =
      (input.metaTemplateId
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
      if (error) throw new Error(error.message);
      return mapRow(asRow(data));
    }

    const { data, error } = await this.client()
      .from(TABLE)
      .insert(payload)
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(asRow(data));
  }

  async patchStatus(input: {
    tenantId: string;
    wabaId: string;
    metaTemplateId?: string | null;
    name?: string | null;
    language?: string | null;
    status: string;
    rejectedReason?: string | null;
    atIso: string;
  }): Promise<MetaTemplateRecord | null> {
    let row: MetaTemplateRecord | null = null;
    if (input.metaTemplateId) {
      row = await this.findByMetaId(input.tenantId, input.metaTemplateId);
    }
    if (!row && input.name && input.language) {
      row = await this.findByWabaNameLanguage(input.tenantId, input.wabaId, input.name, input.language);
    }
    if (!row) return null;
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
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : row;
  }
}
