"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappAutomationEngine = void 0;
const meta_whatsapp_message_repository_1 = require("./meta-whatsapp-message.repository");
const meta_whatsapp_conversation_repository_1 = require("./meta-whatsapp-conversation.repository");
const meta_whatsapp_messaging_service_1 = require("./meta-whatsapp-messaging.service");
const meta_whatsapp_template_service_1 = require("./meta-whatsapp-template.service");
const meta_whatsapp_customer_care_window_1 = require("./meta-whatsapp-customer-care-window");
const meta_whatsapp_automation_hours_1 = require("./meta-whatsapp-automation-hours");
const meta_whatsapp_automation_log_1 = require("./meta-whatsapp-automation-log");
const meta_whatsapp_automation_responder_1 = require("./meta-whatsapp-automation-responder");
const meta_whatsapp_automation_repository_1 = require("./meta-whatsapp-automation.repository");
const MAX_DELAY_MS = 10000;
const STATUSES = new Set(["open", "pending", "closed"]);
function payloadText(payload, keys = ["text", "message"]) {
    for (const key of keys) {
        const value = String(payload[key] || "").trim();
        if (value)
            return value.slice(0, 4096);
    }
    return "";
}
function payloadTemplate(payload) {
    const nested = payload.template && typeof payload.template === "object"
        ? payload.template
        : payload;
    const name = String(nested.name || payload.templateName || "").trim();
    const language = String(nested.language || payload.templateLanguage || "").trim();
    if (!name || !language)
        return null;
    const components = Array.isArray(nested.components)
        ? nested.components
        : [];
    return { name, language, components };
}
function delayMsFrom(payload) {
    const raw = Number(payload.delayMs ?? payload.delay_ms ?? 0);
    if (!Number.isFinite(raw) || raw <= 0)
        return 0;
    return Math.min(MAX_DELAY_MS, Math.floor(raw));
}
class MetaWhatsappAutomationEngine {
    constructor(messages = new meta_whatsapp_message_repository_1.MetaWhatsappMessageRepository(), conversations = new meta_whatsapp_conversation_repository_1.MetaWhatsappConversationRepository(), settingsRepo = new meta_whatsapp_automation_repository_1.MetaWhatsappAutomationSettingsRepository(), flows = new meta_whatsapp_automation_repository_1.MetaWhatsappAutomationFlowRepository(), rules = new meta_whatsapp_automation_repository_1.MetaWhatsappAutomationRuleRepository(), runs = new meta_whatsapp_automation_repository_1.MetaWhatsappAutomationRunRepository(), messaging = new meta_whatsapp_messaging_service_1.MetaWhatsappMessagingService(), templates = new meta_whatsapp_template_service_1.MetaWhatsappTemplateService(), responder = new meta_whatsapp_automation_responder_1.RulesResponder(), clock = () => new Date(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
        this.messages = messages;
        this.conversations = conversations;
        this.settingsRepo = settingsRepo;
        this.flows = flows;
        this.rules = rules;
        this.runs = runs;
        this.messaging = messaging;
        this.templates = templates;
        this.responder = responder;
        this.clock = clock;
        this.sleep = sleep;
    }
    async handleInbound(event) {
        try {
            await this.processInbound(event);
        }
        catch (error) {
            (0, meta_whatsapp_automation_log_1.logMetaAutomation)("ERROR", {
                tenantId: event.tenantId,
                conversationId: event.conversationId,
                messageId: event.messageId,
                reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
            });
        }
    }
    async processInbound(event) {
        if (event.name !== "inbound_message")
            return;
        const tenantId = String(event.tenantId || "").trim();
        const messageId = String(event.messageId || "").trim();
        const conversationId = String(event.conversationId || "").trim();
        const connectionId = String(event.connectionId || "").trim();
        if (!tenantId || !messageId || !conversationId || !connectionId)
            return;
        const message = await this.messages.findByIdForTenant(tenantId, messageId);
        if (!message || message.tenantId !== tenantId)
            return;
        if (message.direction !== "inbound") {
            (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SKIP", {
                tenantId,
                conversationId,
                messageId,
                reason: "outbound_ignored",
            });
            return;
        }
        (0, meta_whatsapp_automation_log_1.logMetaAutomation)("RECEIVED", {
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
            (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SKIP", { tenantId, conversationId, messageId, reason: "duplicate" });
            return;
        }
        const run = claimed.record;
        try {
            await this.evaluateClaimed(event, run, message);
        }
        catch (error) {
            await this.finish(run, {
                status: "error",
                error: "provider_error",
            });
            (0, meta_whatsapp_automation_log_1.logMetaAutomation)("ERROR", {
                tenantId,
                conversationId,
                messageId,
                reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
            });
        }
    }
    async evaluateClaimed(event, run, message) {
        const tenantId = event.tenantId;
        const conversation = await this.conversations.findByIdForTenant(tenantId, event.conversationId);
        if (!conversation || conversation.tenantId !== tenantId) {
            await this.finish(run, { status: "skipped", error: "conversation_not_found" });
            return;
        }
        const settings = (await this.settingsRepo.findByTenantConnection(tenantId, event.connectionId)) ||
            {
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
            };
        if (!settings.enabled) {
            await this.finish(run, { status: "skipped", error: "automation_disabled" });
            (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SKIP", { tenantId, conversationId: conversation.id, reason: "disabled" });
            return;
        }
        if (conversation.humanTakeover) {
            await this.finish(run, { status: "skipped", error: "human_takeover" });
            (0, meta_whatsapp_automation_log_1.logMetaAutomation)("HUMAN_TAKEOVER", {
                tenantId,
                conversationId: conversation.id,
                messageId: message.id,
                reason: "ignored",
            });
            return;
        }
        const since = new Date(this.clock().getTime() - settings.rateLimitWindowSeconds * 1000).toISOString();
        const recentSends = await this.runs.countRecentSends(tenantId, conversation.id, since);
        if (recentSends >= settings.rateLimitCount) {
            if (settings.rateLimitTakeover) {
                await this.conversations.assign(tenantId, conversation.id, conversation.assignedTo, true);
                await this.conversations.patchStatus(tenantId, conversation.id, "open");
            }
            await this.finish(run, { status: "skipped", error: "rate_limit" });
            (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SKIP", {
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
            (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SKIP", { tenantId, conversationId: conversation.id, reason: "no_flow" });
            return;
        }
        const ruleRows = await this.rules.listByFlow(tenantId, flow.id);
        const inboundCount = await this.messages.countInboundByConversation(tenantId, conversation.id);
        const hours = (0, meta_whatsapp_automation_hours_1.evaluateBusinessHours)(settings, this.clock());
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
            (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SKIP", { tenantId, conversationId: conversation.id, reason: "no_match" });
            return;
        }
        (0, meta_whatsapp_automation_log_1.logMetaAutomation)("MATCH", {
            tenantId,
            conversationId: conversation.id,
            ruleId: decision.rule.id,
            triggerType: decision.rule.triggerType,
            actionType: decision.rule.actionType,
            reason: decision.reason,
        });
        await this.execute(run, conversation, message, decision.rule, flow.id);
    }
    async execute(run, conversation, message, rule, flowId) {
        const payload = rule.actionPayload || {};
        const delay = rule.actionType === "DELAY" ? delayMsFrom(payload) || 0 : delayMsFrom(payload);
        if (delay > 0)
            await this.sleep(delay);
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
                const window = (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({
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
                        (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SKIP", {
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
                    (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SEND", {
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
                });
                await this.finish(run, {
                    status: "sent",
                    flowId,
                    ruleId: rule.id,
                    actionType: rule.actionType,
                });
                (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SEND", {
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
                (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SEND", {
                    tenantId,
                    conversationId: conversation.id,
                    actionType: "SEND_TEMPLATE",
                });
                return;
            }
            case "SET_STATUS": {
                const status = String(payload.status || "").trim();
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
                (0, meta_whatsapp_automation_log_1.logMetaAutomation)("HUMAN_TAKEOVER", {
                    tenantId,
                    conversationId: conversation.id,
                    reason: "enabled",
                });
                return;
            }
            case "DISABLE_AUTOMATION": {
                const notice = payloadText(payload);
                if (notice)
                    await this.maybeSendTakeoverText(conversation, notice);
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
    async maybeSendTakeoverText(conversation, text) {
        const window = (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({
            lastInboundAt: conversation.lastInboundAt,
            now: this.clock(),
        });
        if (window.known && window.withinWindow === false)
            return;
        await this.messaging.sendForTenant(conversation.tenantId, {
            to: conversation.contactWaId,
            type: "text",
            text,
            connectionId: conversation.connectionId,
        });
        (0, meta_whatsapp_automation_log_1.logMetaAutomation)("SEND", {
            tenantId: conversation.tenantId,
            conversationId: conversation.id,
            actionType: "SEND_TEXT",
            reason: "takeover_notice",
        });
    }
    async sendTemplate(tenantId, to, connectionId, template) {
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
            template: {
                name: template.name,
                language: template.language,
                components: template.components,
            },
        });
    }
    async finish(run, patch) {
        await this.runs.update(run.tenantId, run.id, patch);
    }
}
exports.MetaWhatsappAutomationEngine = MetaWhatsappAutomationEngine;
