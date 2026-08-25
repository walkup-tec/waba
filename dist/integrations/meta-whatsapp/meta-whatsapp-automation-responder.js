"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIResponder = exports.RulesResponder = void 0;
const meta_whatsapp_automation_text_1 = require("./meta-whatsapp-automation-text");
class RulesResponder {
    async decide(ctx) {
        const active = ctx.rules
            .filter((rule) => rule.active && rule.tenantId === ctx.tenantId && rule.flowId === ctx.flow.id)
            .slice()
            .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
        for (const rule of active) {
            const reason = matchRule(rule, ctx);
            if (reason)
                return { rule, reason };
        }
        return null;
    }
}
exports.RulesResponder = RulesResponder;
/** Reservado à fase de IA. Não chama OpenAI/Gemini/Anthropic. */
class AIResponder {
    async decide(_ctx) {
        return null;
    }
}
exports.AIResponder = AIResponder;
function matchRule(rule, ctx) {
    const text = ctx.message.textContent || "";
    switch (rule.triggerType) {
        case "EXACT_TEXT":
            return (0, meta_whatsapp_automation_text_1.exactTextMatches)(text, rule.triggerValue) ? "exact_text" : null;
        case "KEYWORD":
            return (0, meta_whatsapp_automation_text_1.keywordMatches)(text, rule.triggerValue) ? "keyword" : null;
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
