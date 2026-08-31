import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AutomationActionType,
  AutomationFlowStatus,
  AutomationRunStatus,
  AutomationTriggerType,
  MetaAutomationFlowRecord,
  MetaAutomationRuleRecord,
  MetaAutomationRunRecord,
  MetaAutomationSettingsRecord,
} from "./meta-whatsapp-automation.types";

const SETTINGS_TABLE = "meta_whatsapp_automation_settings";
const FLOWS_TABLE = "meta_whatsapp_automation_flows";
const RULES_TABLE = "meta_whatsapp_automation_rules";
const RUNS_TABLE = "meta_whatsapp_automation_runs";

const SETTINGS_COLUMNS = [
  "id",
  "tenant_id",
  "connection_id",
  "enabled",
  "timezone",
  "business_days",
  "business_start",
  "business_end",
  "rate_limit_count",
  "rate_limit_window_seconds",
  "rate_limit_takeover",
  "created_at",
  "updated_at",
].join(", ");

const FLOW_COLUMNS = [
  "id",
  "tenant_id",
  "connection_id",
  "name",
  "status",
  "is_default",
  "created_at",
  "updated_at",
].join(", ");

const RULE_COLUMNS = [
  "id",
  "flow_id",
  "tenant_id",
  "priority",
  "trigger_type",
  "trigger_value",
  "action_type",
  "action_payload",
  "active",
  "created_at",
  "updated_at",
].join(", ");

const RUN_COLUMNS = [
  "id",
  "tenant_id",
  "connection_id",
  "conversation_id",
  "message_id",
  "flow_id",
  "rule_id",
  "status",
  "action_type",
  "error",
  "created_at",
  "processed_at",
].join(", ");

type DbRow = Record<string, unknown>;

function asRow(data: unknown, label: string): DbRow {
  if (!data || typeof data !== "object") throw new Error(`${label} inválido.`);
  return data as DbRow;
}

function asDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [1, 2, 3, 4, 5];
  return value.map((item) => Number(item)).filter((item) => item >= 1 && item <= 7);
}

function asPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mapSettings(row: DbRow): MetaAutomationSettingsRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    connectionId: String(row.connection_id),
    enabled: row.enabled === true,
    timezone: String(row.timezone || "America/Sao_Paulo"),
    businessDays: asDays(row.business_days),
    businessStart: String(row.business_start || "08:00"),
    businessEnd: String(row.business_end || "18:00"),
    rateLimitCount: Number(row.rate_limit_count || 10),
    rateLimitWindowSeconds: Number(row.rate_limit_window_seconds || 300),
    rateLimitTakeover: row.rate_limit_takeover !== false,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapFlow(row: DbRow): MetaAutomationFlowRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    connectionId: String(row.connection_id),
    name: String(row.name || ""),
    status: (row.status === "inactive" ? "inactive" : "active") as AutomationFlowStatus,
    isDefault: row.is_default === true,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapRule(row: DbRow): MetaAutomationRuleRecord {
  return {
    id: String(row.id),
    flowId: String(row.flow_id),
    tenantId: String(row.tenant_id),
    priority: Number(row.priority || 100),
    triggerType: String(row.trigger_type) as AutomationTriggerType,
    triggerValue: row.trigger_value != null ? String(row.trigger_value) : null,
    actionType: String(row.action_type) as AutomationActionType,
    actionPayload: asPayload(row.action_payload),
    active: row.active !== false,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapRun(row: DbRow): MetaAutomationRunRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    connectionId: row.connection_id ? String(row.connection_id) : null,
    conversationId: String(row.conversation_id),
    messageId: String(row.message_id),
    flowId: row.flow_id ? String(row.flow_id) : null,
    ruleId: row.rule_id ? String(row.rule_id) : null,
    status: String(row.status || "received") as AutomationRunStatus,
    actionType: row.action_type ? (String(row.action_type) as AutomationActionType) : null,
    error: row.error ? String(row.error) : null,
    createdAt: String(row.created_at || ""),
    processedAt: row.processed_at ? String(row.processed_at) : null,
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

export class MetaWhatsappAutomationSettingsRepository {
  constructor(private readonly clientFactory: () => SupabaseClient = getClient) {}

  private client(): SupabaseClient {
    return this.clientFactory();
  }

  async findByTenantConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<MetaAutomationSettingsRecord | null> {
    const { data, error } = await this.client()
      .from(SETTINGS_TABLE)
      .select(SETTINGS_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("connection_id", connectionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSettings(asRow(data, "Settings")) : null;
  }

  async upsert(input: {
    tenantId: string;
    connectionId: string;
    enabled?: boolean;
    timezone?: string;
    businessDays?: number[];
    businessStart?: string;
    businessEnd?: string;
    rateLimitCount?: number;
    rateLimitWindowSeconds?: number;
    rateLimitTakeover?: boolean;
  }): Promise<MetaAutomationSettingsRecord> {
    const existing = await this.findByTenantConnection(input.tenantId, input.connectionId);
    const payload = {
      tenant_id: input.tenantId,
      connection_id: input.connectionId,
      enabled: input.enabled ?? existing?.enabled ?? false,
      timezone: input.timezone ?? existing?.timezone ?? "America/Sao_Paulo",
      business_days: input.businessDays ?? existing?.businessDays ?? [1, 2, 3, 4, 5],
      business_start: input.businessStart ?? existing?.businessStart ?? "08:00",
      business_end: input.businessEnd ?? existing?.businessEnd ?? "18:00",
      rate_limit_count: input.rateLimitCount ?? existing?.rateLimitCount ?? 10,
      rate_limit_window_seconds: input.rateLimitWindowSeconds ?? existing?.rateLimitWindowSeconds ?? 300,
      rate_limit_takeover: input.rateLimitTakeover ?? existing?.rateLimitTakeover ?? true,
    };
    if (existing) {
      const { data, error } = await this.client()
        .from(SETTINGS_TABLE)
        .update(payload)
        .eq("id", existing.id)
        .eq("tenant_id", input.tenantId)
        .select(SETTINGS_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return mapSettings(asRow(data, "Settings"));
    }
    const { data, error } = await this.client()
      .from(SETTINGS_TABLE)
      .insert(payload)
      .select(SETTINGS_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapSettings(asRow(data, "Settings"));
  }

  async setEnabled(
    tenantId: string,
    connectionId: string,
    enabled: boolean,
  ): Promise<MetaAutomationSettingsRecord | null> {
    const { data, error } = await this.client()
      .from(SETTINGS_TABLE)
      .update({ enabled })
      .eq("tenant_id", tenantId)
      .eq("connection_id", connectionId)
      .select(SETTINGS_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSettings(asRow(data, "Settings")) : null;
  }
}

export class MetaWhatsappAutomationFlowRepository {
  constructor(private readonly clientFactory: () => SupabaseClient = getClient) {}

  private client(): SupabaseClient {
    return this.clientFactory();
  }

  async findByIdForTenant(tenantId: string, id: string): Promise<MetaAutomationFlowRecord | null> {
    const { data, error } = await this.client()
      .from(FLOWS_TABLE)
      .select(FLOW_COLUMNS)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapFlow(asRow(data, "Flow")) : null;
  }

  async findDefault(
    tenantId: string,
    connectionId: string,
  ): Promise<MetaAutomationFlowRecord | null> {
    const { data, error } = await this.client()
      .from(FLOWS_TABLE)
      .select(FLOW_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("connection_id", connectionId)
      .eq("is_default", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapFlow(asRow(data, "Flow")) : null;
  }

  async insert(input: {
    tenantId: string;
    connectionId: string;
    name: string;
    status?: AutomationFlowStatus;
    isDefault?: boolean;
  }): Promise<MetaAutomationFlowRecord> {
    const { data, error } = await this.client()
      .from(FLOWS_TABLE)
      .insert({
        tenant_id: input.tenantId,
        connection_id: input.connectionId,
        name: input.name,
        status: input.status || "active",
        is_default: input.isDefault !== false,
      })
      .select(FLOW_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapFlow(asRow(data, "Flow"));
  }

  async update(
    tenantId: string,
    id: string,
    patch: { name?: string; status?: AutomationFlowStatus },
  ): Promise<MetaAutomationFlowRecord | null> {
    const update: Record<string, unknown> = {};
    if (patch.name != null) update.name = patch.name;
    if (patch.status != null) update.status = patch.status;
    if (!Object.keys(update).length) return this.findByIdForTenant(tenantId, id);
    const { data, error } = await this.client()
      .from(FLOWS_TABLE)
      .update(update)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(FLOW_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapFlow(asRow(data, "Flow")) : null;
  }
}

export class MetaWhatsappAutomationRuleRepository {
  constructor(private readonly clientFactory: () => SupabaseClient = getClient) {}

  private client(): SupabaseClient {
    return this.clientFactory();
  }

  async findByIdForTenant(tenantId: string, id: string): Promise<MetaAutomationRuleRecord | null> {
    const { data, error } = await this.client()
      .from(RULES_TABLE)
      .select(RULE_COLUMNS)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRule(asRow(data, "Rule")) : null;
  }

  async listByFlow(tenantId: string, flowId: string): Promise<MetaAutomationRuleRecord[]> {
    const { data, error } = await this.client()
      .from(RULES_TABLE)
      .select(RULE_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("flow_id", flowId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapRule(asRow(row, "Rule")));
  }

  async insert(input: {
    tenantId: string;
    flowId: string;
    priority: number;
    triggerType: AutomationTriggerType;
    triggerValue: string | null;
    actionType: AutomationActionType;
    actionPayload: Record<string, unknown>;
    active: boolean;
  }): Promise<MetaAutomationRuleRecord> {
    const { data, error } = await this.client()
      .from(RULES_TABLE)
      .insert({
        tenant_id: input.tenantId,
        flow_id: input.flowId,
        priority: input.priority,
        trigger_type: input.triggerType,
        trigger_value: input.triggerValue,
        action_type: input.actionType,
        action_payload: input.actionPayload,
        active: input.active,
      })
      .select(RULE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return mapRule(asRow(data, "Rule"));
  }

  async update(
    tenantId: string,
    id: string,
    patch: Partial<{
      priority: number;
      triggerType: AutomationTriggerType;
      triggerValue: string | null;
      actionType: AutomationActionType;
      actionPayload: Record<string, unknown>;
      active: boolean;
    }>,
  ): Promise<MetaAutomationRuleRecord | null> {
    const update: Record<string, unknown> = {};
    if (patch.priority != null) update.priority = patch.priority;
    if (patch.triggerType != null) update.trigger_type = patch.triggerType;
    if (patch.triggerValue !== undefined) update.trigger_value = patch.triggerValue;
    if (patch.actionType != null) update.action_type = patch.actionType;
    if (patch.actionPayload != null) update.action_payload = patch.actionPayload;
    if (patch.active != null) update.active = patch.active;
    if (!Object.keys(update).length) return this.findByIdForTenant(tenantId, id);
    const { data, error } = await this.client()
      .from(RULES_TABLE)
      .update(update)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(RULE_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRule(asRow(data, "Rule")) : null;
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const { data, error } = await this.client()
      .from(RULES_TABLE)
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  }
}

export class MetaWhatsappAutomationRunRepository {
  constructor(private readonly clientFactory: () => SupabaseClient = getClient) {}

  private client(): SupabaseClient {
    return this.clientFactory();
  }

  async tryClaim(input: {
    tenantId: string;
    connectionId: string;
    conversationId: string;
    messageId: string;
  }): Promise<{ record: MetaAutomationRunRecord; duplicate: boolean }> {
    const { data, error } = await this.client()
      .from(RUNS_TABLE)
      .insert({
        tenant_id: input.tenantId,
        connection_id: input.connectionId,
        conversation_id: input.conversationId,
        message_id: input.messageId,
        status: "received",
      })
      .select(RUN_COLUMNS)
      .maybeSingle();
    if (error) {
      if (String(error.code) === "23505") {
        const existing = await this.findByTenantMessage(input.tenantId, input.messageId);
        if (existing) return { record: existing, duplicate: true };
      }
      throw new Error(error.message);
    }
    if (!data) {
      const existing = await this.findByTenantMessage(input.tenantId, input.messageId);
      if (existing) return { record: existing, duplicate: true };
      throw new Error("Não foi possível registrar a execução da automação.");
    }
    return { record: mapRun(asRow(data, "Run")), duplicate: false };
  }

  async findByTenantMessage(
    tenantId: string,
    messageId: string,
  ): Promise<MetaAutomationRunRecord | null> {
    const { data, error } = await this.client()
      .from(RUNS_TABLE)
      .select(RUN_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("message_id", messageId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRun(asRow(data, "Run")) : null;
  }

  async update(
    tenantId: string,
    id: string,
    patch: {
      status: AutomationRunStatus;
      flowId?: string | null;
      ruleId?: string | null;
      actionType?: AutomationActionType | null;
      error?: string | null;
    },
  ): Promise<MetaAutomationRunRecord | null> {
    const update: Record<string, unknown> = {
      status: patch.status,
      processed_at: new Date().toISOString(),
    };
    if (patch.flowId !== undefined) update.flow_id = patch.flowId;
    if (patch.ruleId !== undefined) update.rule_id = patch.ruleId;
    if (patch.actionType !== undefined) update.action_type = patch.actionType;
    if (patch.error !== undefined) update.error = patch.error;
    const { data, error } = await this.client()
      .from(RUNS_TABLE)
      .update(update)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(RUN_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRun(asRow(data, "Run")) : null;
  }

  async countRecentSends(
    tenantId: string,
    conversationId: string,
    sinceIso: string,
  ): Promise<number> {
    const { count, error } = await this.client()
      .from(RUNS_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("conversation_id", conversationId)
      .eq("status", "sent")
      .in("action_type", ["SEND_TEXT", "SEND_TEMPLATE"])
      .gte("created_at", sinceIso);
    if (error) throw new Error(error.message);
    return Number(count || 0);
  }

  async listRecent(
    tenantId: string,
    connectionId: string,
    limit: number,
  ): Promise<MetaAutomationRunRecord[]> {
    const { data, error } = await this.client()
      .from(RUNS_TABLE)
      .select(RUN_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("connection_id", connectionId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapRun(asRow(row, "Run")));
  }
}
