"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTOMATION_MATCH_POLICY = exports.AUTOMATION_ACTION_TYPES = exports.AUTOMATION_TRIGGER_TYPES = void 0;
exports.isAutomationTriggerType = isAutomationTriggerType;
exports.isAutomationActionType = isAutomationActionType;
exports.toPublicAutomationSettings = toPublicAutomationSettings;
exports.toPublicAutomationFlow = toPublicAutomationFlow;
exports.toPublicAutomationRule = toPublicAutomationRule;
exports.toPublicAutomationRun = toPublicAutomationRun;
exports.AUTOMATION_TRIGGER_TYPES = [
    "ANY_INBOUND",
    "FIRST_INBOUND",
    "KEYWORD",
    "EXACT_TEXT",
    "OUTSIDE_BUSINESS_HOURS",
    "INSIDE_BUSINESS_HOURS",
];
exports.AUTOMATION_ACTION_TYPES = [
    "SEND_TEXT",
    "SEND_TEMPLATE",
    "SET_STATUS",
    "ASSIGN_HUMAN",
    "ENABLE_HUMAN_TAKEOVER",
    "DISABLE_AUTOMATION",
    "DELAY",
];
function isAutomationTriggerType(value) {
    return exports.AUTOMATION_TRIGGER_TYPES.includes(value);
}
function isAutomationActionType(value) {
    return exports.AUTOMATION_ACTION_TYPES.includes(value);
}
function toPublicAutomationSettings(row) {
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
function toPublicAutomationFlow(row) {
    return {
        id: row.id,
        name: row.name,
        status: row.status,
        isDefault: row.isDefault,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
function toPublicAutomationRule(row) {
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
function toPublicAutomationRun(row) {
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
exports.AUTOMATION_MATCH_POLICY = "first_matching_rule_wins";
