import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TABLE = "meta_whatsapp_webhook_events";

export type MetaWebhookEventInsert = {
  eventKey: string;
  tenantId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  eventType: string;
  payloadHash: string;
  status: "received" | "processed" | "duplicate" | "unmatched_tenant" | "ignored" | "error";
  error?: string | null;
};

export type MetaWebhookEventInsertResult = {
  duplicate: boolean;
  id: string | null;
};

function getClient(): SupabaseClient {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export class MetaWhatsappWebhookEventsRepository {
  constructor(private readonly clientFactory: () => SupabaseClient = getClient) {}

  async insertIfNew(input: MetaWebhookEventInsert): Promise<MetaWebhookEventInsertResult> {
    const now = new Date().toISOString();
    const { data, error } = await this.clientFactory()
      .from(TABLE)
      .insert({
        event_key: input.eventKey,
        tenant_id: input.tenantId,
        waba_id: input.wabaId,
        phone_number_id: input.phoneNumberId,
        event_type: input.eventType,
        payload_hash: input.payloadHash,
        received_at: now,
        processed_at: input.status === "processed" ? now : null,
        status: input.status,
        error: input.error || null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if (String(error.code) === "23505") {
        return { duplicate: true, id: null };
      }
      throw new Error(error.message);
    }
    return { duplicate: false, id: data?.id ? String(data.id) : null };
  }
}
