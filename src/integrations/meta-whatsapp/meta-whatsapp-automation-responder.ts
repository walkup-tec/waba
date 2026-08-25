import type { MetaConversationRecord, MetaMessageRecord } from "./meta-whatsapp-messaging.types";
import type {
  MetaAutomationFlowRecord,
  MetaAutomationRuleRecord,
  MetaAutomationSettingsRecord,
} from "./meta-whatsapp-automation.types";
import { exactTextMatches, keywordMatches } from "./meta-whatsapp-automation-text";
import type { BusinessHoursState } from "./meta-whatsapp-automation-hours";

export type AutomationContext = {
  tenantId: string;
  connectionId: string;
  conversation: MetaConversationRecord;
  message: MetaMessageRecord;
  settings: MetaAutomationSettingsRecord;
  flow: MetaAutomationFlowRecord;
  rules: MetaAutomationRuleRecord[];
  inboundCount: number;
  hours: BusinessHoursState;
};

export type AutomationDecision = {
  rule: MetaAutomationRuleRecord;
  reason: string;
};

/**
 * Contrato para o motor. Nesta fase só RulesResponder.
 * AIResponder fica preparado e não integra modelo nenhum.
 */
export interface AutomationResponder {
  decide(ctx: AutomationContext): Promise<AutomationDecision | null>;
}

export class RulesResponder implements AutomationResponder {
  async decide(ctx: AutomationContext): Promise<AutomationDecision | null> {
    const active = ctx.rules
      .filter((rule) => rule.active && rule.tenantId === ctx.tenantId && rule.flowId === ctx.flow.id)
      .slice()
      .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
    for (const rule of active) {
      const reason = matchRule(rule, ctx);
      if (reason) return { rule, reason };
    }
    return null;
  }
}

/** Reservado à fase de IA. Não chama OpenAI/Gemini/Anthropic. */
export class AIResponder implements AutomationResponder {
  async decide(_ctx: AutomationContext): Promise<AutomationDecision | null> {
    return null;
  }
}

function matchRule(rule: MetaAutomationRuleRecord, ctx: AutomationContext): string | null {
  const text = ctx.message.textContent || "";
  switch (rule.triggerType) {
    case "EXACT_TEXT":
      return exactTextMatches(text, rule.triggerValue) ? "exact_text" : null;
    case "KEYWORD":
      return keywordMatches(text, rule.triggerValue) ? "keyword" : null;
    case "FIRST_INBOUND":
      return ctx.inboundCount === 1 ? "first_inbound" : null;
    case "INSIDE_BUSINESS_HOURS":
      return ctx.hours.configured && ctx.hours.inside ? "inside_business_hours" : null;
    case "OUTSIDE_BUSINESS_HOURS":
      return ctx.hours.configured && !ctx.hours.inside ? "outside_business_hours" : null;
    case "ANY_INBOUND":
      return "any_inbound";
    default:
      return null;
  }
}
