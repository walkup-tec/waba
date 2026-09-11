import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  MetaWhatsappConnectionRecord,
  MetaWhatsappConnectionStatus,
} from "./meta-whatsapp-connection.types";

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

type DbRow = Record<string, unknown>;

function asRow(data: unknown): DbRow {
  if (!data || typeof data !== "object") {
    throw new Error("Linha Meta inválida.");
  }
  return data as DbRow;
}

function mapRow(row: DbRow): MetaWhatsappConnectionRecord {
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
    status: String(row.status || "pending_token") as MetaWhatsappConnectionStatus,
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

export type UpsertPendingTokenInput = {
  tenantId: string;
  ownerEmail: string;
  accessTokenEncrypted: string;
  tokenType?: string;
  tokenExpiresAt?: string | null;
  configId?: string | null;
  metaBusinessId?: string | null;
  actorEmail: string;
};

export type AttachClaimedAssetsInput = {
  wabaId?: string | null;
  phoneNumberId?: string | null;
  metaBusinessId?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  accessTokenEncrypted?: string | null;
  tokenType?: string | null;
  tokenExpiresAt?: string | null;
  actorEmail: string;
};

function getClient(): SupabaseClient {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export class MetaWhatsappConnectionRepository {
  constructor(private readonly clientFactory: () => SupabaseClient = getClient) {}

  private client(): SupabaseClient {
    return this.clientFactory();
  }

  async findOpenByTenant(tenantId: string): Promise<MetaWhatsappConnectionRecord | null> {
    const rows = await this.listOpenByTenant(tenantId);
    return rows[0] ?? null;
  }

  async listOpenByTenant(tenantId: string): Promise<MetaWhatsappConnectionRecord[]> {
    const id = String(tenantId || "").trim();
    if (!id) return [];
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", id)
      .is("disconnected_at", null)
      .in("status", ["pending_token", "pending_confirmation", "connected"])
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapRow(asRow(row)));
  }

  async findByBusinessId(tenantId: string, businessId: string): Promise<MetaWhatsappConnectionRecord | null> {
    const tenant = String(tenantId || "").trim();
    const bm = String(businessId || "").trim();
    if (!tenant || !bm) return null;
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", tenant)
      .eq("meta_business_id", bm)
      .is("disconnected_at", null)
      .in("status", ["pending_token", "pending_confirmation", "connected"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async latestPendingToken(tenantId: string): Promise<MetaWhatsappConnectionRecord | null> {
    const id = String(tenantId || "").trim();
    if (!id) return null;
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", id)
      .eq("status", "pending_token")
      .is("disconnected_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async findByIdForTenant(tenantId: string, id: string): Promise<MetaWhatsappConnectionRecord | null> {
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async upsertPendingToken(input: UpsertPendingTokenInput): Promise<MetaWhatsappConnectionRecord> {
    const incomingBusinessId = String(input.metaBusinessId || "").trim();
    let existing = incomingBusinessId
      ? await this.findByBusinessId(input.tenantId, incomingBusinessId)
      : null;
    if (!existing) {
      existing = await this.latestPendingToken(input.tenantId);
    }
    if (existing && existing.status === "connected") {
      const existingBm = String(existing.metaBusinessId || "").trim();
      if (existingBm && incomingBusinessId && existingBm !== incomingBusinessId) {
        existing = null;
      } else if (existingBm && !incomingBusinessId) {
        existing = null;
      }
    }
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
      if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
    return mapRow(asRow(data));
  }

  async attachClaimedAssets(
    tenantId: string,
    connectionId: string,
    input: AttachClaimedAssetsInput,
  ): Promise<MetaWhatsappConnectionRecord> {
    const current = await this.findByIdForTenant(tenantId, connectionId);
    if (!current || current.disconnectedAt) {
      throw new Error("Conexão não encontrada.");
    }
    const keepConnected = current.status === "connected";
    const wabaId = String(input.wabaId || current.wabaId || "").trim() || null;
    const patch: Record<string, string | null> = {
      waba_id: wabaId,
      phone_number_id: String(input.phoneNumberId || current.phoneNumberId || "").trim() || null,
      meta_business_id: String(input.metaBusinessId || current.metaBusinessId || "").trim() || null,
      display_phone_number: String(input.displayPhoneNumber || current.displayPhoneNumber || "").trim() || null,
      verified_name: String(input.verifiedName || current.verifiedName || "").trim() || null,
      status: keepConnected ? "connected" : wabaId ? "pending_confirmation" : "pending_token",
      updated_by: input.actorEmail,
      last_error: null,
    };
    if (input.accessTokenEncrypted) {
      patch.access_token_encrypted = input.accessTokenEncrypted;
      if (input.tokenType) patch.token_type = input.tokenType;
      if (input.tokenExpiresAt !== undefined) patch.token_expires_at = input.tokenExpiresAt || null;
    }
    const { data, error } = await this.client()
      .from(TABLE)
      .update(patch)
      .eq("id", connectionId)
      .eq("tenant_id", tenantId)
      .is("disconnected_at", null)
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(asRow(data));
  }

  async listInboxConnections(tenantId: string): Promise<MetaWhatsappConnectionRecord[]> {
    const id = String(tenantId || "").trim();
    if (!id) return [];
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", id)
      .is("disconnected_at", null)
      .in("status", ["connected", "pending_confirmation"])
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapRow(asRow(row)));
  }

  async findConnectedByTenant(tenantId: string): Promise<MetaWhatsappConnectionRecord | null> {
    const id = String(tenantId || "").trim();
    if (!id) return null;
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", id)
      .eq("status", "connected")
      .is("disconnected_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async findConnectedByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<MetaWhatsappConnectionRecord | null> {
    const id = String(phoneNumberId || "").trim();
    if (!id) return null;
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("phone_number_id", id)
      .in("status", ["connected", "pending_confirmation"])
      .is("disconnected_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async findConnectedByWabaId(wabaId: string): Promise<MetaWhatsappConnectionRecord | null> {
    const id = String(wabaId || "").trim();
    if (!id) return null;
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("waba_id", id)
      .in("status", ["connected", "pending_confirmation"])
      .is("disconnected_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async touchLastWebhookAt(tenantId: string, connectionId: string, atIso: string): Promise<void> {
    const { error } = await this.client()
      .from(TABLE)
      .update({ last_webhook_at: atIso })
      .eq("id", connectionId)
      .eq("tenant_id", tenantId)
      .in("status", ["connected", "pending_confirmation"]);
    if (error) throw new Error(error.message);
  }

  async markConnected(
    tenantId: string,
    connectionId: string,
    patch: {
      displayPhoneNumber?: string | null;
      verifiedName?: string | null;
      qualityRating?: string | null;
      actorEmail: string;
    },
  ): Promise<MetaWhatsappConnectionRecord | null> {
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
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async patchConfirmedMetadata(
    tenantId: string,
    connectionId: string,
    patch: { qualityRating?: string | null; verifiedName?: string | null },
  ): Promise<void> {
    const update: Record<string, string> = {};
    const quality = String(patch.qualityRating || "").trim();
    const name = String(patch.verifiedName || "").trim();
    if (quality) update.quality_rating = quality;
    if (name) update.verified_name = name;
    if (!Object.keys(update).length) return;
    const { error } = await this.client()
      .from(TABLE)
      .update(update)
      .eq("id", connectionId)
      .eq("tenant_id", tenantId)
      .eq("status", "connected");
    if (error) throw new Error(error.message);
  }

  async reopenLeftManagerForBusinesses(
    tenantId: string,
    businessIds: string[],
    actorEmail: string,
  ): Promise<number> {
    const tenant = String(tenantId || "").trim();
    const ids = [...new Set(businessIds.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!tenant || !ids.length) return 0;
    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from(TABLE)
      .update({
        status: "connected",
        disconnected_at: null,
        updated_by: actorEmail,
        last_error: null,
        updated_at: now,
      })
      .eq("tenant_id", tenant)
      .eq("status", "disconnected")
      .eq("last_error", "left_manager")
      .in("meta_business_id", ids)
      .select("id");
    if (error) throw new Error(error.message);
    return (data || []).length;
  }

  async disconnectOne(tenantId: string, connectionId: string, actorEmail: string): Promise<boolean> {
    const tenant = String(tenantId || "").trim();
    const id = String(connectionId || "").trim();
    if (!tenant || !id) return false;
    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from(TABLE)
      .update({
        status: "disconnected",
        disconnected_at: now,
        updated_by: actorEmail,
        last_error: "left_manager",
      })
      .eq("id", id)
      .eq("tenant_id", tenant)
      .is("disconnected_at", null)
      .in("status", ["pending_token", "pending_confirmation", "connected"])
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data?.id);
  }

  async disconnectOpenByTenant(tenantId: string, actorEmail: string): Promise<number> {
    const id = String(tenantId || "").trim();
    if (!id) return 0;
    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from(TABLE)
      .update({
        status: "disconnected",
        disconnected_at: now,
        updated_by: actorEmail,
        access_token_encrypted: "",
        last_error: null,
      })
      .eq("tenant_id", id)
      .is("disconnected_at", null)
      .in("status", ["pending_token", "pending_confirmation", "connected"])
      .select("id");
    if (error) throw new Error(error.message);
    return (data || []).length;
  }

  async disconnectEmptyPendingTokens(
    tenantId: string,
    actorEmail: string,
    exceptId?: string | null,
  ): Promise<number> {
    const id = String(tenantId || "").trim();
    if (!id) return 0;
    const keep = String(exceptId || "").trim();
    const rows = await this.listOpenByTenant(id);
    const now = new Date().toISOString();
    let count = 0;
    for (const row of rows) {
      if (keep && row.id === keep) continue;
      if (row.status !== "pending_token") continue;
      if (row.metaBusinessId || row.wabaId || row.phoneNumberId) continue;
      const { error } = await this.client()
        .from(TABLE)
        .update({
          status: "disconnected",
          disconnected_at: now,
          updated_by: actorEmail,
          access_token_encrypted: "",
          last_error: null,
        })
        .eq("id", row.id)
        .eq("tenant_id", id)
        .eq("status", "pending_token")
        .is("disconnected_at", null);
      if (error) throw new Error(error.message);
      count += 1;
    }
    return count;
  }
}
