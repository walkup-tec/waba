import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { logMetaAutomation } from "./meta-whatsapp-automation-log";
import {
  MetaWhatsappAutomationFlowRepository,
  MetaWhatsappAutomationRuleRepository,
  MetaWhatsappAutomationRunRepository,
  MetaWhatsappAutomationSettingsRepository,
} from "./meta-whatsapp-automation.repository";
import {
  AUTOMATION_MATCH_POLICY,
  isAutomationActionType,
  isAutomationTriggerType,
  toPublicAutomationFlow,
  toPublicAutomationRule,
  toPublicAutomationRun,
  toPublicAutomationSettings,
  type AutomationActionType,
  type AutomationFlowStatus,
  type AutomationTriggerType,
  type MetaAutomationFlowPublic,
  type MetaAutomationRulePublic,
  type MetaAutomationRunPublic,
  type MetaAutomationSettingsPublic,
} from "./meta-whatsapp-automation.types";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const TZ_RE = /^[A-Za-z_]+\/[A-Za-z_+\-0-9]+$/;

function requireTenant(auth: WabaRequestAuth) {
  try {
    return resolveMetaWhatsappTenant(auth);
  } catch {
    throw new MetaWhatsappError("unauthenticated");
  }
}

function warnIgnored(body: Record<string, unknown> | undefined, tenantId: string): void {
  if (
    body?.tenant_id ||
    body?.tenantId ||
    body?.owner_email ||
    body?.waba_id ||
    body?.wabaId ||
    body?.access_token
  ) {
    logMetaAutomation("ERROR", { reason: "ignored_client_claims", tenantId });
  }
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function parseDays(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback;
  const days = raw.map((item) => Number(item)).filter((item) => item >= 1 && item <= 7);
  return days.length ? Array.from(new Set(days)).sort((a, b) => a - b) : fallback;
}

function parsePayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const json = JSON.stringify(raw);
  if (json.length > 4000) throw new MetaWhatsappError("automation_invalid");
  return JSON.parse(json) as Record<string, unknown>;
}

export class MetaWhatsappAutomationService {
  constructor(
    private readonly connections = new MetaWhatsappConnectionRepository(),
    private readonly settings = new MetaWhatsappAutomationSettingsRepository(),
    private readonly flows = new MetaWhatsappAutomationFlowRepository(),
    private readonly rules = new MetaWhatsappAutomationRuleRepository(),
    private readonly runs = new MetaWhatsappAutomationRunRepository(),
  ) {}

  private async requireConnected(tenantId: string): Promise<MetaWhatsappConnectionRecord> {
    const row = await this.connections.findConnectedByTenant(tenantId);
    if (!row || row.status !== "connected" || row.tenantId !== tenantId) {
      throw new MetaWhatsappError("not_connected");
    }
    return row;
  }

  async getBundle(auth: WabaRequestAuth): Promise<{
    matchPolicy: typeof AUTOMATION_MATCH_POLICY;
    settings: MetaAutomationSettingsPublic;
    flow: MetaAutomationFlowPublic;
    rules: MetaAutomationRulePublic[];
    runs: MetaAutomationRunPublic[];
  }> {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnected(tenant.tenantId);
    const settingsRow = await this.settings.upsert({
      tenantId: tenant.tenantId,
      connectionId: connection.id,
    });
    let flow = await this.flows.findDefault(tenant.tenantId, connection.id);
    if (!flow) {
      flow = await this.flows.insert({
        tenantId: tenant.tenantId,
        connectionId: connection.id,
        name: "Padrão",
        status: "active",
        isDefault: true,
      });
    }
    const ruleRows = await this.rules.listByFlow(tenant.tenantId, flow.id);
    const runRows = await this.runs.listRecent(tenant.tenantId, connection.id, 30);
    return {
      matchPolicy: AUTOMATION_MATCH_POLICY,
      settings: toPublicAutomationSettings(settingsRow),
      flow: toPublicAutomationFlow(flow),
      rules: ruleRows.map(toPublicAutomationRule),
      runs: runRows.map(toPublicAutomationRun),
    };
  }

  async patchSettings(auth: WabaRequestAuth, body: Record<string, unknown> | undefined) {
    const tenant = requireTenant(auth);
    warnIgnored(body, tenant.tenantId);
    const connection = await this.requireConnected(tenant.tenantId);
    const current = await this.settings.upsert({ tenantId: tenant.tenantId, connectionId: connection.id });
    const timezone = String(body?.timezone ?? current.timezone).trim() || "America/Sao_Paulo";
    if (timezone !== "UTC" && !TZ_RE.test(timezone)) throw new MetaWhatsappError("automation_invalid");
    const businessStart = String(body?.businessStart ?? body?.business_start ?? current.businessStart).trim();
    const businessEnd = String(body?.businessEnd ?? body?.business_end ?? current.businessEnd).trim();
    if (!TIME_RE.test(businessStart) || !TIME_RE.test(businessEnd)) {
      throw new MetaWhatsappError("automation_invalid");
    }
    const updated = await this.settings.upsert({
      tenantId: tenant.tenantId,
      connectionId: connection.id,
      enabled: body?.enabled == null ? current.enabled : body.enabled === true,
      timezone,
      businessDays: parseDays(body?.businessDays ?? body?.business_days, current.businessDays),
      businessStart,
      businessEnd,
      rateLimitCount: clampInt(body?.rateLimitCount ?? body?.rate_limit_count, current.rateLimitCount, 1, 100),
      rateLimitWindowSeconds: clampInt(
        body?.rateLimitWindowSeconds ?? body?.rate_limit_window_seconds,
        current.rateLimitWindowSeconds,
        30,
        86400,
      ),
      rateLimitTakeover:
        body?.rateLimitTakeover == null && body?.rate_limit_takeover == null
          ? current.rateLimitTakeover
          : body?.rateLimitTakeover === true || body?.rate_limit_takeover === true,
    });
    return toPublicAutomationSettings(updated);
  }

  async patchFlow(auth: WabaRequestAuth, flowId: string, body: Record<string, unknown> | undefined) {
    const tenant = requireTenant(auth);
    warnIgnored(body, tenant.tenantId);
    await this.requireConnected(tenant.tenantId);
    const existing = await this.flows.findByIdForTenant(tenant.tenantId, String(flowId || "").trim());
    if (!existing) throw new MetaWhatsappError("automation_not_found");
    const name = String(body?.name ?? existing.name).trim().slice(0, 80) || existing.name;
    const statusRaw = String(body?.status ?? existing.status).trim();
    const status: AutomationFlowStatus = statusRaw === "inactive" ? "inactive" : "active";
    const updated = await this.flows.update(tenant.tenantId, existing.id, { name, status });
    if (!updated) throw new MetaWhatsappError("automation_not_found");
    return toPublicAutomationFlow(updated);
  }

  async createRule(auth: WabaRequestAuth, body: Record<string, unknown> | undefined) {
    const tenant = requireTenant(auth);
    warnIgnored(body, tenant.tenantId);
    const connection = await this.requireConnected(tenant.tenantId);
    const flowId = String(body?.flowId || body?.flow_id || "").trim();
    const flow = flowId
      ? await this.flows.findByIdForTenant(tenant.tenantId, flowId)
      : await this.flows.findDefault(tenant.tenantId, connection.id);
    if (!flow || flow.tenantId !== tenant.tenantId) throw new MetaWhatsappError("automation_not_found");
    const parsed = this.parseRuleBody(body, {
      priority: 100,
      triggerType: "ANY_INBOUND",
      triggerValue: null,
      actionType: "SEND_TEXT",
      actionPayload: {},
      active: true,
    });
    this.assertActionPayload(parsed.actionType, parsed.actionPayload);
    const created = await this.rules.insert({
      tenantId: tenant.tenantId,
      flowId: flow.id,
      ...parsed,
    });
    return toPublicAutomationRule(created);
  }

  async patchRule(auth: WabaRequestAuth, ruleId: string, body: Record<string, unknown> | undefined) {
    const tenant = requireTenant(auth);
    warnIgnored(body, tenant.tenantId);
    await this.requireConnected(tenant.tenantId);
    const existing = await this.rules.findByIdForTenant(tenant.tenantId, String(ruleId || "").trim());
    if (!existing) throw new MetaWhatsappError("automation_not_found");
    const parsed = this.parseRuleBody(body, existing);
    this.assertActionPayload(parsed.actionType, parsed.actionPayload);
    const updated = await this.rules.update(tenant.tenantId, existing.id, parsed);
    if (!updated) throw new MetaWhatsappError("automation_not_found");
    return toPublicAutomationRule(updated);
  }

  async deleteRule(auth: WabaRequestAuth, ruleId: string) {
    const tenant = requireTenant(auth);
    await this.requireConnected(tenant.tenantId);
    const ok = await this.rules.delete(tenant.tenantId, String(ruleId || "").trim());
    if (!ok) throw new MetaWhatsappError("automation_not_found");
    return { deleted: true };
  }

  private parseRuleBody(
    body: Record<string, unknown> | undefined,
    fallback: {
      priority: number;
      triggerType: AutomationTriggerType;
      triggerValue: string | null;
      actionType: AutomationActionType;
      actionPayload: Record<string, unknown>;
      active: boolean;
    },
  ) {
    const triggerType = String(body?.triggerType || body?.trigger_type || fallback.triggerType).trim();
    const actionType = String(body?.actionType || body?.action_type || fallback.actionType).trim();
    if (!isAutomationTriggerType(triggerType) || !isAutomationActionType(actionType)) {
      throw new MetaWhatsappError("automation_invalid");
    }
    const triggerValueRaw = body?.triggerValue ?? body?.trigger_value;
    const triggerValue =
      triggerValueRaw == null
        ? fallback.triggerValue
        : String(triggerValueRaw).trim().slice(0, 200) || null;
    return {
      priority: clampInt(body?.priority, fallback.priority, 1, 10000),
      triggerType,
      triggerValue,
      actionType,
      actionPayload: body?.actionPayload != null || body?.action_payload != null
        ? parsePayload(body?.actionPayload ?? body?.action_payload)
        : fallback.actionPayload,
      active: body?.active == null ? fallback.active : body.active !== false,
    };
  }

  private assertActionPayload(actionType: AutomationActionType, payload: Record<string, unknown>): void {
    if (actionType === "SEND_TEXT") {
      const text = String(payload.text || payload.message || "").trim();
      if (!text) throw new MetaWhatsappError("automation_invalid");
    }
    if (actionType === "SEND_TEMPLATE") {
      const nested = payload.template && typeof payload.template === "object"
        ? (payload.template as Record<string, unknown>)
        : payload;
      const name = String(nested.name || payload.templateName || "").trim();
      const language = String(nested.language || payload.templateLanguage || "").trim();
      if (!name || !language) throw new MetaWhatsappError("automation_invalid");
    }
    if (actionType === "SET_STATUS") {
      const status = String(payload.status || "").trim();
      if (status !== "open" && status !== "pending" && status !== "closed") {
        throw new MetaWhatsappError("automation_invalid");
      }
    }
  }
}
