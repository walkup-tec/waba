import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  MetaMessageDirection,
  MetaMessageRecord,
  MetaMessageStatus,
} from "./meta-whatsapp-messaging.types";
import { canAdvanceMetaMessageStatus } from "./meta-whatsapp-messaging.types";

const TABLE = "meta_whatsapp_messages";

const COLUMNS = [
  "id",
  "tenant_id",
  "conversation_id",
  "connection_id",
  "wamid",
  "direction",
  "type",
  "status",
  "from_wa_id",
  "to_wa_id",
  "text_content",
  "template_name",
  "template_language",
  "provider",
  "sent_at",
  "delivered_at",
  "read_at",
  "failed_at",
  "error_code",
  "error_message",
  "created_at",
  "updated_at",
].join(", ");

type DbRow = Record<string, unknown>;

function asRow(data: unknown): DbRow {
  if (!data || typeof data !== "object") throw new Error("Mensagem Meta inválida.");
  return data as DbRow;
}

function mapRow(row: DbRow): MetaMessageRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    conversationId: String(row.conversation_id),
    connectionId: String(row.connection_id),
    wamid: row.wamid ? String(row.wamid) : null,
    direction: String(row.direction) as MetaMessageDirection,
    type: String(row.type || "text"),
    status: String(row.status || "queued") as MetaMessageStatus,
    fromWaId: row.from_wa_id ? String(row.from_wa_id) : null,
    toWaId: row.to_wa_id ? String(row.to_wa_id) : null,
    textContent: row.text_content ? String(row.text_content) : null,
    templateName: row.template_name ? String(row.template_name) : null,
    templateLanguage: row.template_language ? String(row.template_language) : null,
    provider: String(row.provider || "meta-cloud"),
    sentAt: row.sent_at ? String(row.sent_at) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    readAt: row.read_at ? String(row.read_at) : null,
    failedAt: row.failed_at ? String(row.failed_at) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
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

export type InsertMessageInput = {
  tenantId: string;
  conversationId: string;
  connectionId: string;
  wamid?: string | null;
  direction: MetaMessageDirection;
  type: string;
  status: MetaMessageStatus;
  fromWaId?: string | null;
  toWaId?: string | null;
  textContent?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  provider?: string;
};

export type InsertMessageResult = {
  record: MetaMessageRecord | null;
  duplicate: boolean;
};

export class MetaWhatsappMessageRepository {
  constructor(private readonly clientFactory: () => SupabaseClient = getClient) {}

  private client(): SupabaseClient {
    return this.clientFactory();
  }

  async findByIdForTenant(tenantId: string, id: string): Promise<MetaMessageRecord | null> {
    const messageId = String(id || "").trim();
    if (!messageId) return null;
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("id", messageId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async countInboundByConversation(tenantId: string, conversationId: string): Promise<number> {
    const { count, error } = await this.client()
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("conversation_id", conversationId)
      .eq("direction", "inbound");
    if (error) throw new Error(error.message);
    return Number(count || 0);
  }

  async findByTenantWamid(tenantId: string, wamid: string): Promise<MetaMessageRecord | null> {
    const id = String(wamid || "").trim();
    if (!id) return null;
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("wamid", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async listByConversation(
    tenantId: string,
    conversationId: string,
    limit: number,
  ): Promise<MetaMessageRecord[]> {
    const { data, error } = await this.client()
      .from(TABLE)
      .select(COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapRow(asRow(row))).reverse();
  }

  async insert(input: InsertMessageInput): Promise<InsertMessageResult> {
    const now = new Date().toISOString();
    const { data, error } = await this.client()
      .from(TABLE)
      .insert({
        tenant_id: input.tenantId,
        conversation_id: input.conversationId,
        connection_id: input.connectionId,
        wamid: input.wamid || null,
        direction: input.direction,
        type: input.type,
        status: input.status,
        from_wa_id: input.fromWaId || null,
        to_wa_id: input.toWaId || null,
        text_content: input.textContent || null,
        template_name: input.templateName || null,
        template_language: input.templateLanguage || null,
        provider: input.provider || "meta-cloud",
        created_at: now,
        updated_at: now,
      })
      .select(COLUMNS)
      .maybeSingle();
    if (error) {
      if (String(error.code) === "23505") {
        return { record: null, duplicate: true };
      }
      throw new Error(error.message);
    }
    return { record: data ? mapRow(asRow(data)) : null, duplicate: false };
  }

  async updateAfterGraph(
    tenantId: string,
    id: string,
    patch: {
      wamid?: string | null;
      status: MetaMessageStatus;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ): Promise<MetaMessageRecord | null> {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: patch.status,
      error_code: patch.errorCode || null,
      error_message: patch.errorMessage || null,
    };
    if (patch.wamid) update.wamid = patch.wamid;
    if (patch.status === "failed") update.failed_at = now;
    const { data, error } = await this.client()
      .from(TABLE)
      .update(update)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(asRow(data)) : null;
  }

  async applyWebhookStatus(
    tenantId: string,
    wamid: string,
    next: MetaMessageStatus,
    atIso: string,
    error?: { code?: string | null; message?: string | null },
  ): Promise<{ updated: boolean; record: MetaMessageRecord | null }> {
    const current = await this.findByTenantWamid(tenantId, wamid);
    if (!current) return { updated: false, record: null };
    if (!canAdvanceMetaMessageStatus(current.status, next)) {
      return { updated: false, record: current };
    }
    const update: Record<string, unknown> = { status: next };
    if (next === "sent") update.sent_at = current.sentAt || atIso;
    if (next === "delivered") {
      update.delivered_at = current.deliveredAt || atIso;
      if (!current.sentAt) update.sent_at = atIso;
    }
    if (next === "read") {
      update.read_at = current.readAt || atIso;
      if (!current.deliveredAt) update.delivered_at = atIso;
      if (!current.sentAt) update.sent_at = atIso;
    }
    if (next === "failed") {
      update.failed_at = current.failedAt || atIso;
      update.error_code = error?.code || current.errorCode;
      update.error_message = error?.message || current.errorMessage;
    }
    const { data, error: dbError } = await this.client()
      .from(TABLE)
      .update(update)
      .eq("id", current.id)
      .eq("tenant_id", tenantId)
      .select(COLUMNS)
      .maybeSingle();
    if (dbError) throw new Error(dbError.message);
    return { updated: true, record: data ? mapRow(asRow(data)) : current };
  }
}
