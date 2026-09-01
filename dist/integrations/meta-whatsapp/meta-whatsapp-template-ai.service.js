"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappTemplateAiService = void 0;
const waba_openai_responses_client_1 = require("../openai/waba-openai-responses.client");
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_template_validate_1 = require("./meta-whatsapp-template-validate");
const meta_whatsapp_template_ai_prompt_1 = require("./meta-whatsapp-template-ai.prompt");
const meta_whatsapp_template_ai_repository_1 = require("./meta-whatsapp-template-ai.repository");
const meta_whatsapp_template_ai_schema_1 = require("./meta-whatsapp-template-ai.schema");
const meta_whatsapp_template_log_1 = require("./meta-whatsapp-template-log");
const windows = new Map();
const FORBIDDEN_APPROVAL_PROMISE = /\b(será|vai ser|garantid[ao]|100%)\s+(aprovad[ao]|aceit[ao])/i;
function requireTenant(auth) {
    try {
        return (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("unauthenticated");
    }
}
function ensureRateLimit(key) {
    const now = Date.now();
    const limit = Math.max(1, Math.min(30, Number(process.env.META_TEMPLATE_AI_RATE_LIMIT_PER_MINUTE || 5)));
    const recent = (windows.get(key) || []).filter((at) => now - at < 60000);
    if (recent.length >= limit)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_ai_rate_limited");
    recent.push(now);
    windows.set(key, recent);
}
function isEnabled() {
    const raw = String(process.env.META_TEMPLATE_AI_ENABLED || "").trim().toLowerCase();
    if (raw === "0" || raw === "false" || raw === "off")
        return false;
    return Boolean(String(process.env.OPENAI_API_KEY || "").trim());
}
class MetaWhatsappTemplateAiService {
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), analyses = new meta_whatsapp_template_ai_repository_1.MetaWhatsappTemplateAiRepository(), openAi = waba_openai_responses_client_1.callOpenAiStructured) {
        this.connections = connections;
        this.analyses = analyses;
        this.openAi = openAi;
    }
    async requirePortfolio(tenantId, connectionId) {
        const id = String(connectionId || "").trim();
        if (!id)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const row = await this.connections.findByIdForTenant(tenantId, id);
        if (!row ||
            row.tenantId !== tenantId ||
            row.status !== "connected" ||
            row.disconnectedAt ||
            !row.wabaId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        return row;
    }
    async generateFromAuth(auth, input) {
        if (!isEnabled())
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_ai_unavailable");
        const tenant = requireTenant(auth);
        const connectionId = String(input?.connectionId || input?.connection_id || "").trim();
        const baseText = String(input?.baseText || input?.base_text || "").trim();
        const language = String(input?.language || "pt_BR").trim() || "pt_BR";
        if (!baseText || baseText.length > 4000 || language.length > 20) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        const connection = await this.requirePortfolio(tenant.tenantId, connectionId);
        ensureRateLimit(`${tenant.tenantId}:${auth.email}`);
        let ai;
        try {
            ai = await this.openAi({
                instructions: (0, meta_whatsapp_template_ai_prompt_1.buildMetaTemplateAiInstructions)(),
                input: JSON.stringify({
                    requestedCategory: "UTILITY",
                    language,
                    baseText,
                }),
                schemaName: meta_whatsapp_template_ai_schema_1.META_TEMPLATE_AI_SCHEMA_NAME,
                schema: meta_whatsapp_template_ai_schema_1.META_TEMPLATE_AI_OUTPUT_SCHEMA,
                maxOutputTokens: 2400,
                timeoutMs: Number(process.env.META_TEMPLATE_AI_TIMEOUT_MS || 20000),
                maxAttempts: 3,
            });
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_ai_unavailable");
        }
        let result;
        try {
            result = (0, meta_whatsapp_template_ai_schema_1.validateMetaTemplateAiOutput)(ai.value);
            const serialized = JSON.stringify(result);
            if (FORBIDDEN_APPROVAL_PROMISE.test(serialized)) {
                throw new Error("A IA prometeu aprovação.");
            }
            if (result.eligibleForUtility) {
                const names = new Set();
                for (const option of result.options) {
                    if (names.has(option.name))
                        throw new Error("Nomes duplicados.");
                    names.add(option.name);
                    const placeholders = [...new Set([...option.body.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1])))].sort((a, b) => a - b);
                    const maxPlaceholder = placeholders.length ? Math.max(...placeholders) : 0;
                    if (placeholders.some((value, index) => value !== index + 1)) {
                        throw new Error("Variáveis não sequenciais.");
                    }
                    if (maxPlaceholder !== option.variableExamples.length) {
                        throw new Error("Exemplos incompatíveis com variáveis.");
                    }
                    (0, meta_whatsapp_template_validate_1.validateTemplateCreate)({
                        name: option.name,
                        language,
                        category: "UTILITY",
                        components: [
                            {
                                type: "BODY",
                                text: option.body,
                                ...(maxPlaceholder
                                    ? { example: { body_text: [option.variableExamples] } }
                                    : {}),
                            },
                        ],
                    });
                }
            }
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_ai_invalid_output");
        }
        const analyzedAt = new Date().toISOString();
        let analysisId = "";
        try {
            analysisId = await this.analyses.create({
                tenantId: tenant.tenantId,
                connectionId: connection.id,
                wabaId: String(connection.wabaId),
                createdBy: auth.email,
                baseText,
                result,
                model: ai.model,
                responseId: ai.responseId,
                promptVersion: meta_whatsapp_template_ai_prompt_1.META_TEMPLATE_AI_PROMPT_VERSION,
                policyVersion: meta_whatsapp_template_ai_prompt_1.META_TEMPLATE_AI_POLICY_VERSION,
            });
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        }
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
            tenantId: tenant.tenantId,
            connectionId: connection.id,
            model: ai.model,
            latencyMs: ai.latencyMs,
            eligibleForUtility: result.eligibleForUtility,
            riskLevel: result.riskLevel,
        });
        return {
            ...result,
            analysisId,
            connectionId: connection.id,
            wabaId: String(connection.wabaId),
            model: ai.model,
            policyVersion: meta_whatsapp_template_ai_prompt_1.META_TEMPLATE_AI_POLICY_VERSION,
            analyzedAt,
        };
    }
}
exports.MetaWhatsappTemplateAiService = MetaWhatsappTemplateAiService;
