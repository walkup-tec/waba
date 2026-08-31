import type { MetaInboxEvent } from "./meta-whatsapp-inbox-events";
import { MetaWhatsappMessageRepository } from "./meta-whatsapp-message.repository";
import { MetaWhatsappConversationRepository } from "./meta-whatsapp-conversation.repository";
import { MetaWhatsappMessagingService } from "./meta-whatsapp-messaging.service";
import { MetaWhatsappTemplateService } from "./meta-whatsapp-template.service";
import { resolveCustomerCareWindow } from "./meta-whatsapp-customer-care-window";
import { evaluateBusinessHours } from "./meta-whatsapp-automation-hours";
import { logMetaAutomation } from "./meta-whatsapp-automation-log";
import {
  RulesResponder,
  type AutomationResponder,
} from "./meta-whatsapp-automation-responder";
import {
  MetaWhatsappAutomationFlowRepository,
  MetaWhatsappAutomationRuleRepository,
  MetaWhatsappAutomationRunRepository,
  MetaWhatsappAutomationSettingsRepository,
} from "./meta-whatsapp-automation.repository";
import type {
  AutomationActionType,
  MetaAutomationRuleRecord,
  MetaAutomationRunRecord,
} from "./meta-whatsapp-automation.types";
import type { MetaConversationStatus } from "./meta-whatsapp-messaging.types";
import type { WhatsAppTemplateComponent } from "../whatsapp/whatsapp-provider";

const MAX_DELAY_MS = 10_000;
const STATUSES = new Set<MetaConversationStatus>(["open", "pending", "closed"]);

function payloadText(payload: Record<string, unknown>, keys = ["text", "message"]): string {
  for (const key of keys) {
    const value = String(payload[key] || "").trim();
    if (value) return value.slice(0, 4096);
  }
  return "";
}

function payloadTemplate(payload: Record<string, unknown>): {
  name: string;
  language: string;
  components: WhatsAppTemplateComponent[];
} | null {
  const nested = payload.template && typeof payload.template === "object"
    ? (payload.template as Record<string, unknown>)
    : payload;
  const name = String(nested.name || payload.templateName || "").trim();
  const language = String(nested.language || payload.templateLanguage || "").trim();
  if (!name || !language) return null;
  const components = Array.isArray(nested.components)
    ? (nested.components as WhatsAppTemplateComponent[])
    : [];
  return { name, language, components };
}

function delayMsFrom(payload: Record<string, unknown>): number {
  const raw = Number(payload.delayMs ?? payload.delay_ms ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(MAX_DELAY_MS, Math.floor(raw));
}

export class MetaWhatsappAutomationEngine {
  constructor(
    private readonly messages = new MetaWhatsappMessageRepository(),
    private readonly conversations = new MetaWhatsappConversationRepository(),
    private readonly settingsRepo = new MetaWhatsappAutomationSettingsRepository(),
    private readonly flows = new MetaWhatsappAutomationFlowRepository(),
    private readonly rules = new MetaWhatsappAutomationRuleRepository(),
    private readonly runs = new MetaWhatsappAutomationRunRepository(),
    private readonly messaging = new MetaWhatsappMessagingService(),
    private readonly templates = new MetaWhatsappTemplateService(),
    private readonly responder: AutomationResponder = new RulesResponder(),
    private readonly clock: () => Date = () => new Date(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async handleInbound(event: MetaInboxEvent): Promise<void> {
    try {
      await this.processInbound(event);
    } catch (error) {
      logMetaAutomation("ERROR", {
        tenantId: event.tenantId,
        conversationId: event.conversationId,
        messageId: event.messageId,
        reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
      });
    }
  }

  private async processInbound(event: MetaInboxEvent): Promise<void> {
    if (event.name !== "inbound_message") return;
    const tenantId = String(event.tenantId || "").trim();
    const messageId = String(event.messageId || "").trim();
    const conversationId = String(event.conversationId || "").trim();
    const connectionId = String(event.connectionId || "").trim();
    if (!tenantId || !messageId || !conversationId || !connectionId) return;

    const message = await this.messages.findByIdForTenant(tenantId, messageId);
    if (!message || message.tenantId !== tenantId) return;
    if (message.direction !== "inbound") {
      logMetaAutomation("SKIP", {
        tenantId,
        conversationId,
        messageId,
        reason: "outbound_ignored",
      });
      return;
    }

    logMetaAutomation("RECEIVED", {
      tenantId,
      conversationId,
      messageId,
      connectionId,
      type: message.type,
    });

    const claimed = await this.runs.tryClaim({
      tenantId,
      connectionId,
      conversationId,
      messageId,
    });
    if (claimed.duplicate) {
      logMetaAutomation("SKIP", { tenantId, conversationId, messageId, reason: "duplicate" });
      return;
    }
    const run = claimed.record;

    try {
      await this.evaluateClaimed(event, run, message);
    } catch (error) {
      await this.finish(run, {
        status: "error",
        error: "provider_error",
      });
      logMetaAutomation("ERROR", {
        tenantId,
        conversationId,
        messageId,
        reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
      });
    }
  }

  private async evaluateClaimed(
    event: MetaInboxEvent,
    run: MetaAutomationRunRecord,
    message: import("./meta-whatsapp-messaging.types").MetaMessageRecord,
  ): Promise<void> {
    const tenantId = event.tenantId;
    const conversation = await this.conversations.findByIdForTenant(tenantId, event.conversationId);
    if (!conversation || conversation.tenantId !== tenantId) {
      await this.finish(run, { status: "skipped", error: "conversation_not_found" });
      return;
    }

    const settings =
      (await this.settingsRepo.findByTenantConnection(tenantId, event.connectionId)) ||
      ({
        id: "",
        tenantId,
        connectionId: event.connectionId,
        enabled: false,
        timezone: "America/Sao_Paulo",
        businessDays: [1, 2, 3, 4, 5],
        businessStart: "08:00",
        businessEnd: "18:00",
        rateLimitCount: 10,
        rateLimitWindowSeconds: 300,
        rateLimitTakeover: true,
        createdAt: "",
        updatedAt: "",
      } as const);

    if (!settings.enabled) {
      await this.finish(run, { status: "skipped", error: "automation_disabled" });
      logMetaAutomation("SKIP", { tenantId, conversationId: conversation.id, reason: "disabled" });
      return;
    }

    if (conversation.humanTakeover) {
      await this.finish(run, { status: "skipped", error: "human_takeover" });
      logMetaAutomation("HUMAN_TAKEOVER", {
        tenantId,
        conversationId: conversation.id,
        messageId: message.id,
        reason: "ignored",
      });
      return;
    }

    const since = new Date(
      this.clock().getTime() - settings.rateLimitWindowSeconds * 1000,
    ).toISOString();
    const recentSends = await this.runs.countRecentSends(tenantId, conversation.id, since);
    if (recentSends >= settings.rateLimitCount) {
      if (settings.rateLimitTakeover) {
        await this.conversations.assign(tenantId, conversation.id, conversation.assignedTo, true);
        await this.conversations.patchStatus(tenantId, conversation.id, "open");
      }
      await this.finish(run, { status: "skipped", error: "rate_limit" });
      logMetaAutomation("SKIP", {
        tenantId,
        conversationId: conversation.id,
        reason: "rate_limit",
        recentSends,
      });
      return;
    }

    const flow = await this.flows.findDefault(tenantId, event.connectionId);
    if (!flow || flow.status !== "active" || flow.tenantId !== tenantId) {
      await this.finish(run, { status: "skipped", error: "no_flow" });
      logMetaAutomation("SKIP", { tenantId, conversationId: conversation.id, reason: "no_flow" });
      return;
    }

    const ruleRows = await this.rules.listByFlow(tenantId, flow.id);
    const inboundCount = await this.messages.countInboundByConversation(tenantId, conversation.id);
    const hours = evaluateBusinessHours(settings, this.clock());
    const decision = await this.responder.decide({
      tenantId,
      connectionId: event.connectionId,
      conversation,
      message,
      settings,
      flow,
      rules: ruleRows,
      inboundCount,
      hours,
    });

    if (!decision) {
      await this.finish(run, { status: "skipped", error: "no_match", flowId: flow.id });
      logMetaAutomation("SKIP", { tenantId, conversationId: conversation.id, reason: "no_match" });
      return;
    }

    logMetaAutomation("MATCH", {
      tenantId,
      conversationId: conversation.id,
      ruleId: decision.rule.id,
      triggerType: decision.rule.triggerType,
      actionType: decision.rule.actionType,
      reason: decision.reason,
    });

    await this.execute(run, conversation, message, decision.rule, flow.id);
  }

  private async execute(
    run: MetaAutomationRunRecord,
    conversation: import("./meta-whatsapp-messaging.types").MetaConversationRecord,
    message: import("./meta-whatsapp-messaging.types").MetaMessageRecord,
    rule: MetaAutomationRuleRecord,
    flowId: string,
  ): Promise<void> {
    const payload = rule.actionPayload || {};
    const delay = rule.actionType === "DELAY" ? delayMsFrom(payload) || 0 : delayMsFrom(payload);
    if (delay > 0) await this.sleep(delay);

    const to = conversation.contactWaId;
    const tenantId = conversation.tenantId;

    switch (rule.actionType) {
      case "DELAY":
        await this.finish(run, {
          status: "matched",
          flowId,
          ruleId: rule.id,
          actionType: rule.actionType,
        });
        return;
      case "SEND_TEXT": {
        const text = payloadText(payload);
        if (!text) {
          await this.finish(run, {
            status: "error",
            flowId,
            ruleId: rule.id,
            actionType: rule.actionType,
            error: "invalid_payload",
          });
          return;
        }
        const window = resolveCustomerCareWindow({
          lastInboundAt: conversation.lastInboundAt,
          now: this.clock(),
        });
        if (window.known && window.withinWindow === false) {
          const fallback = payloadTemplate(payload);
          if (!fallback) {
            await this.finish(run, {
              status: "blocked",
              flowId,
              ruleId: rule.id,
              actionType: rule.actionType,
              error: "automation_blocked_customer_care_window",
            });
            logMetaAutomation("SKIP", {
              tenantId,
              conversationId: conversation.id,
              reason: "automation_blocked_customer_care_window",
            });
            return;
          }
          await this.sendTemplate(tenantId, to, conversation.connectionId, fallback);
          await this.finish(run, {
            status: "sent",
            flowId,
            ruleId: rule.id,
            actionType: "SEND_TEMPLATE",
          });
          logMetaAutomation("SEND", {
            tenantId,
            conversationId: conversation.id,
            actionType: "SEND_TEMPLATE",
            reason: "window_fallback_template",
          });
          return;
        }
        await this.messaging.sendForTenant(tenantId, {
          to,
          type: "text",
          text,
          connectionId: conversation.connectionId,
          conversationId: conversation.id,
          source: "bot",
        });
        await this.finish(run, {
          status: "sent",
          flowId,
          ruleId: rule.id,
          actionType: rule.actionType,
        });
        logMetaAutomation("SEND", {
          tenantId,
          conversationId: conversation.id,
          actionType: "SEND_TEXT",
        });
        return;
      }
      case "SEND_TEMPLATE": {
        const template = payloadTemplate(payload);
        if (!template) {
          await this.finish(run, {
            status: "error",
            flowId,
            ruleId: rule.id,
            actionType: rule.actionType,
            error: "invalid_payload",
          });
          return;
        }
        await this.sendTemplate(tenantId, to, conversation.connectionId, template);
        await this.finish(run, {
          status: "sent",
          flowId,
          ruleId: rule.id,
          actionType: rule.actionType,
        });
        logMetaAutomation("SEND", {
          tenantId,
          conversationId: conversation.id,
          actionType: "SEND_TEMPLATE",
        });
        return;
      }
      case "SET_STATUS": {
        const status = String(payload.status || "").trim() as MetaConversationStatus;
        if (!STATUSES.has(status)) {
          await this.finish(run, {
            status: "error",
            flowId,
            ruleId: rule.id,
            actionType: rule.actionType,
            error: "invalid_payload",
          });
          return;
        }
        await this.conversations.patchStatus(tenantId, conversation.id, status);
        await this.finish(run, {
          status: "matched",
          flowId,
          ruleId: rule.id,
          actionType: rule.actionType,
        });
        return;
      }
      case "ASSIGN_HUMAN":
      case "ENABLE_HUMAN_TAKEOVER": {
        const notice = payloadText(payload);
        if (notice) {
          await this.maybeSendTakeoverText(conversation, notice);
        }
        await this.conversations.assign(tenantId, conversation.id, conversation.assignedTo, true);
        await this.conversations.patchStatus(tenantId, conversation.id, "open");
        await this.finish(run, {
          status: "matched",
          flowId,
          ruleId: rule.id,
          actionType: rule.actionType,
        });
        logMetaAutomation("HUMAN_TAKEOVER", {
          tenantId,
          conversationId: conversation.id,
          reason: "enabled",
        });
        return;
      }
      case "DISABLE_AUTOMATION": {
        const notice = payloadText(payload);
        if (notice) await this.maybeSendTakeoverText(conversation, notice);
        await this.settingsRepo.upsert({
          tenantId,
          connectionId: conversation.connectionId,
          enabled: false,
        });
        await this.finish(run, {
          status: "matched",
          flowId,
          ruleId: rule.id,
          actionType: rule.actionType,
        });
        return;
      }
      default:
        await this.finish(run, {
          status: "skipped",
          flowId,
          ruleId: rule.id,
          actionType: rule.actionType,
          error: "unknown_action",
        });
    }
  }

  private async maybeSendTakeoverText(
    conversation: import("./meta-whatsapp-messaging.types").MetaConversationRecord,
    text: string,
  ): Promise<void> {
    const window = resolveCustomerCareWindow({
      lastInboundAt: conversation.lastInboundAt,
      now: this.clock(),
    });
    if (window.known && window.withinWindow === false) return;
    await this.messaging.sendForTenant(conversation.tenantId, {
      to: conversation.contactWaId,
      type: "text",
      text,
      connectionId: conversation.connectionId,
      conversationId: conversation.id,
      source: "bot",
    });
    logMetaAutomation("SEND", {
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      actionType: "SEND_TEXT",
      reason: "takeover_notice",
    });
  }

  private async sendTemplate(
    tenantId: string,
    to: string,
    connectionId: string,
    template: { name: string; language: string; components: WhatsAppTemplateComponent[] },
  ): Promise<void> {
    await this.templates.assertSendable({
      tenantId,
      connectionId,
      name: template.name,
      language: template.language,
    });
    await this.messaging.sendForTenant(tenantId, {
      to,
      type: "template",
      connectionId,
      source: "bot",
      template: {
        name: template.name,
        language: template.language,
        components: template.components,
      },
    });
  }

  private async finish(
    run: MetaAutomationRunRecord,
    patch: {
      status: MetaAutomationRunRecord["status"];
      flowId?: string | null;
      ruleId?: string | null;
      actionType?: AutomationActionType | null;
      error?: string | null;
    },
  ): Promise<void> {
    await this.runs.update(run.tenantId, run.id, patch);
  }
}
