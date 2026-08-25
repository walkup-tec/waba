export const AUTOMATION_TRIGGER_TYPES = [
  "ANY_INBOUND",
  "FIRST_INBOUND",
  "KEYWORD",
  "EXACT_TEXT",
  "OUTSIDE_BUSINESS_HOURS",
  "INSIDE_BUSINESS_HOURS",
] as const;

export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_ACTION_TYPES = [
  "SEND_TEXT",
  "SEND_TEMPLATE",
  "SET_STATUS",
  "ASSIGN_HUMAN",
  "ENABLE_HUMAN_TAKEOVER",
  "DISABLE_AUTOMATION",
  "DELAY",
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export type AutomationFlowStatus = "active" | "inactive";

export type AutomationRunStatus =
  | "received"
  | "skipped"
  | "matched"
  | "sent"
  | "blocked"
  | "error";

export type MetaAutomationSettingsRecord = {
  id: string;
  tenantId: string;
  connectionId: string;
  enabled: boolean;
  timezone: string;
  businessDays: number[];
  businessStart: string;
  businessEnd: string;
  rateLimitCount: number;
  rateLimitWindowSeconds: number;
  rateLimitTakeover: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MetaAutomationFlowRecord = {
  id: string;
  tenantId: string;
  connectionId: string;
  name: string;
  status: AutomationFlowStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MetaAutomationRuleRecord = {
  id: string;
  flowId: string;
  tenantId: string;
  priority: number;
  triggerType: AutomationTriggerType;
  triggerValue: string | null;
  actionType: AutomationActionType;
  actionPayload: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MetaAutomationRunRecord = {
  id: string;
  tenantId: string;
  connectionId: string | null;
  conversationId: string;
  messageId: string;
  flowId: string | null;
  ruleId: string | null;
  status: AutomationRunStatus;
  actionType: AutomationActionType | null;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type MetaAutomationSettingsPublic = {
  enabled: boolean;
  timezone: string;
  businessDays: number[];
  businessStart: string;
  businessEnd: string;
  rateLimitCount: number;
  rateLimitWindowSeconds: number;
  rateLimitTakeover: boolean;
};

export type MetaAutomationFlowPublic = {
  id: string;
  name: string;
  status: AutomationFlowStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MetaAutomationRulePublic = {
  id: string;
  flowId: string;
  priority: number;
  triggerType: AutomationTriggerType;
  triggerValue: string | null;
  actionType: AutomationActionType;
  actionPayload: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MetaAutomationRunPublic = {
  id: string;
  conversationId: string;
  messageId: string;
  flowId: string | null;
  ruleId: string | null;
  status: AutomationRunStatus;
  actionType: AutomationActionType | null;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
};

export function isAutomationTriggerType(value: string): value is AutomationTriggerType {
  return (AUTOMATION_TRIGGER_TYPES as readonly string[]).includes(value);
}

export function isAutomationActionType(value: string): value is AutomationActionType {
  return (AUTOMATION_ACTION_TYPES as readonly string[]).includes(value);
}

export function toPublicAutomationSettings(
  row: MetaAutomationSettingsRecord,
): MetaAutomationSettingsPublic {
  return {
    enabled: row.enabled,
    timezone: row.timezone,
    businessDays: row.businessDays.slice(),
    businessStart: row.businessStart,
    businessEnd: row.businessEnd,
    rateLimitCount: row.rateLimitCount,
    rateLimitWindowSeconds: row.rateLimitWindowSeconds,
    rateLimitTakeover: row.rateLimitTakeover,
  };
}

export function toPublicAutomationFlow(row: MetaAutomationFlowRecord): MetaAutomationFlowPublic {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPublicAutomationRule(row: MetaAutomationRuleRecord): MetaAutomationRulePublic {
  return {
    id: row.id,
    flowId: row.flowId,
    priority: row.priority,
    triggerType: row.triggerType,
    triggerValue: row.triggerValue,
    actionType: row.actionType,
    actionPayload: row.actionPayload,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPublicAutomationRun(row: MetaAutomationRunRecord): MetaAutomationRunPublic {
  return {
    id: row.id,
    conversationId: row.conversationId,
    messageId: row.messageId,
    flowId: row.flowId,
    ruleId: row.ruleId,
    status: row.status,
    actionType: row.actionType,
    error: row.error,
    createdAt: row.createdAt,
    processedAt: row.processedAt,
  };
}

/** First matching rule wins — evita respostas duplicadas no mesmo inbound. */
export const AUTOMATION_MATCH_POLICY = "first_matching_rule_wins" as const;
