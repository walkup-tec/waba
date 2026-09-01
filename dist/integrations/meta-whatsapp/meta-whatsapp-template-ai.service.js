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
const meta_whatsapp_template_ai_shell_1 = require("./meta-whatsapp-template-ai-shell");
const meta_whatsapp_template_log_1 = require("./meta-whatsapp-template-log");
const meta_whatsapp_template_service_1 = require("./meta-whatsapp-template.service");
const meta_token_crypto_1 = require("./meta-token-crypto");
const meta_config_1 = require("./meta-config");
const meta_whatsapp_resumable_upload_1 = require("./meta-whatsapp-resumable-upload");
const MEDIA_MIME = {
    IMAGE: new Set(["image/jpeg", "image/jpg", "image/png"]),
    VIDEO: new Set(["video/mp4"]),
    DOCUMENT: new Set(["application/pdf"]),
};
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
function componentsFromAiOption(option) {
    const placeholders = [...new Set([...option.body.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1])))].sort((a, b) => a - b);
    const maxPlaceholder = placeholders.length ? Math.max(...placeholders) : 0;
    if (placeholders.some((value, index) => value !== index + 1)) {
        throw new Error("Variáveis não sequenciais.");
    }
    if (maxPlaceholder !== option.variableExamples.length) {
        throw new Error("Exemplos incompatíveis com variáveis.");
    }
    const buttonText = String(option.buttonText || "").trim();
    if (!buttonText)
        throw new Error("Botão operacional ausente.");
    return [
        {
            type: "BODY",
            text: option.body,
            ...(maxPlaceholder ? { example: { body_text: [option.variableExamples] } } : {}),
        },
        {
            type: "BUTTONS",
            buttons: [{ type: "QUICK_REPLY", text: buttonText }],
        },
    ];
}
class MetaWhatsappTemplateAiService {
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), analyses = new meta_whatsapp_template_ai_repository_1.MetaWhatsappTemplateAiRepository(), openAi = waba_openai_responses_client_1.callOpenAiStructured, templates = new meta_whatsapp_template_service_1.MetaWhatsappTemplateService(), decrypt = meta_token_crypto_1.decryptMetaToken, uploadHeader = meta_whatsapp_resumable_upload_1.uploadMetaResumableImage) {
        this.connections = connections;
        this.analyses = analyses;
        this.openAi = openAi;
        this.templates = templates;
        this.decrypt = decrypt;
        this.uploadHeader = uploadHeader;
    }
    async requirePortfolio(tenantId, connectionId) {
        const id = String(connectionId || "").trim();
        if (!id)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const row = await this.connections.findByIdForTenant(tenantId, id);
        if (!row ||
            row.tenantId !== tenantId ||
            (row.status !== "connected" && row.status !== "pending_confirmation") ||
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
        const variableType = String(input?.variableType || input?.variable_type || "nome").trim().toLowerCase();
        if (!baseText || baseText.length > 4000 || language.length > 20) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        if (variableType !== "nome" && variableType !== "numero" && variableType !== "nenhuma") {
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
                    variableType,
                    baseText,
                }),
                schemaName: meta_whatsapp_template_ai_schema_1.META_TEMPLATE_AI_SCHEMA_NAME,
                schema: meta_whatsapp_template_ai_schema_1.META_TEMPLATE_AI_OUTPUT_SCHEMA,
                maxOutputTokens: 3200,
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
            const names = new Set();
            for (const option of result.options) {
                if (names.has(option.name))
                    throw new Error("Nomes duplicados.");
                names.add(option.name);
                (0, meta_whatsapp_template_validate_1.validateTemplateCreate)({
                    name: option.name,
                    language,
                    category: "UTILITY",
                    components: componentsFromAiOption(option),
                });
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
                language,
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
            language,
            model: ai.model,
            policyVersion: meta_whatsapp_template_ai_prompt_1.META_TEMPLATE_AI_POLICY_VERSION,
            analyzedAt,
        };
    }
    async submitAllFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const connectionId = String(input?.connectionId || input?.connection_id || "").trim();
        const analysisId = String(input?.analysisId || input?.analysis_id || "").trim();
        if (!connectionId || !analysisId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const shell = (0, meta_whatsapp_template_ai_shell_1.parseMetaTemplateAiShell)(input);
        await this.requirePortfolio(tenant.tenantId, connectionId);
        const analysis = await this.analyses.findForSubmission(tenant.tenantId, connectionId, analysisId);
        if (!analysis ||
            !analysis.eligibleForUtility ||
            analysis.result.recommendedCategory !== "UTILITY" ||
            !Array.isArray(analysis.result.options) ||
            analysis.result.options.length !== 3) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_ai_invalid_output");
        }
        const results = [];
        const alreadySubmitted = await this.analyses.listSubmittedNames(tenant.tenantId, connectionId, analysisId);
        for (let index = 0; index < analysis.result.options.length; index += 1) {
            const option = analysis.result.options[index];
            const name = (0, meta_whatsapp_template_ai_shell_1.templateNameForOption)(shell.modelName, index);
            if (alreadySubmitted.has(name)) {
                results.push({
                    index,
                    name,
                    ok: true,
                    status: "ALREADY_SUBMITTED",
                    templateId: null,
                    error: null,
                });
                continue;
            }
            try {
                const template = await this.templates.createFromAuth(auth, {
                    connectionId,
                    aiAnalysisId: analysisId,
                    aiOptionIndex: index,
                    name,
                    language: analysis.language,
                    category: "UTILITY",
                    components: (0, meta_whatsapp_template_ai_shell_1.componentsFromAiOptionAndShell)(option, shell),
                });
                results.push({
                    index,
                    name,
                    ok: true,
                    status: template.status,
                    templateId: template.id,
                    error: null,
                });
            }
            catch (error) {
                results.push({
                    index,
                    name,
                    ok: false,
                    status: null,
                    templateId: null,
                    error: error instanceof meta_whatsapp_errors_1.MetaWhatsappError
                        ? error.message
                        : "Não foi possível cadastrar esta opção.",
                });
            }
        }
        const submitted = results.filter((item) => item.ok).length;
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
            tenantId: tenant.tenantId,
            connectionId,
            batchSubmit: true,
            submitted,
            failed: results.length - submitted,
        });
        return {
            total: results.length,
            submitted,
            failed: results.length - submitted,
            results,
        };
    }
    async uploadHeaderMediaFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const connectionId = String(input.connectionId || "").trim();
        const mediaFormat = String(input.mediaFormat || "").trim().toUpperCase();
        const allowed = MEDIA_MIME[mediaFormat];
        const mime = String(input.mime || "").trim().toLowerCase();
        const bytes = input.bytes;
        const fileName = String(input.fileName || "header").trim() || "header";
        if (!connectionId || !allowed || !bytes?.length || !allowed.has(mime)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        const connection = await this.requirePortfolio(tenant.tenantId, connectionId);
        const appId = (0, meta_config_1.readMetaAppId)();
        if (!appId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("config_invalid");
        let token = "";
        try {
            token = this.decrypt(connection.accessTokenEncrypted);
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        try {
            const uploaded = await this.uploadHeader({
                token,
                appId,
                fileName,
                mime,
                bytes,
            });
            const handle = String(uploaded.handle || "").trim();
            if (!handle)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
            (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", { tenantId: tenant.tenantId, connectionId, headerUpload: mediaFormat });
            return { handle, mediaFormat };
        }
        catch (error) {
            if (error instanceof meta_whatsapp_errors_1.MetaWhatsappError)
                throw error;
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        }
    }
}
exports.MetaWhatsappTemplateAiService = MetaWhatsappTemplateAiService;
