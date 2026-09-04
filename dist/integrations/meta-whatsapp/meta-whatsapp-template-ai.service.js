"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappTemplateAiService = void 0;
exports.normalizeHeaderMediaMime = normalizeHeaderMediaMime;
exports.sniffMetaHeaderMediaMime = sniffMetaHeaderMediaMime;
exports.sanitizeGraphUploadFileName = sanitizeGraphUploadFileName;
exports.resolveMetaHeaderMediaMime = resolveMetaHeaderMediaMime;
const waba_openai_responses_client_1 = require("../openai/waba-openai-responses.client");
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_template_validate_1 = require("./meta-whatsapp-template-validate");
const meta_whatsapp_template_ai_prompt_1 = require("./meta-whatsapp-template-ai.prompt");
const meta_whatsapp_template_ai_repository_1 = require("./meta-whatsapp-template-ai.repository");
const meta_whatsapp_template_header_preview_store_1 = require("./meta-whatsapp-template-header-preview.store");
const meta_whatsapp_template_ai_schema_1 = require("./meta-whatsapp-template-ai.schema");
const meta_whatsapp_template_ai_shell_1 = require("./meta-whatsapp-template-ai-shell");
const meta_whatsapp_template_ai_utility_shape_1 = require("./meta-whatsapp-template-ai-utility-shape");
const meta_whatsapp_template_ai_option_edit_1 = require("./meta-whatsapp-template-ai-option-edit");
const meta_whatsapp_template_log_1 = require("./meta-whatsapp-template-log");
const meta_whatsapp_template_service_1 = require("./meta-whatsapp-template.service");
const meta_token_crypto_1 = require("./meta-token-crypto");
const meta_config_1 = require("./meta-config");
const meta_whatsapp_resumable_upload_1 = require("./meta-whatsapp-resumable-upload");
const meta_whatsapp_template_ai_short_url_1 = require("./meta-whatsapp-template-ai-short-url");
const MEDIA_MIME = {
    IMAGE: new Set(["image/jpeg", "image/png"]),
    VIDEO: new Set(["video/mp4"]),
    DOCUMENT: new Set(["application/pdf"]),
};
const MIME_ALIASES = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "image/x-png": "image/png",
};
function normalizeHeaderMediaMime(mime) {
    return String(mime || "")
        .trim()
        .toLowerCase()
        .split(";")[0]
        .trim();
}
function sniffMetaHeaderMediaMime(bytes) {
    if (!bytes || bytes.length < 8)
        return null;
    if (bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a) {
        return "image/png";
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return "image/jpeg";
    if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-")
        return "application/pdf";
    if (bytes.length >= 8 && bytes.subarray(4, 8).toString("ascii") === "ftyp")
        return "video/mp4";
    return null;
}
function sanitizeGraphUploadFileName(fileName, mime) {
    const type = normalizeHeaderMediaMime(mime);
    const ext = type === "image/png" ? "png" : type === "video/mp4" ? "mp4" : type === "application/pdf" ? "pdf" : "jpg";
    return `header.${ext}`;
}
function resolveMetaHeaderMediaMime(mediaFormat, mime, fileName, bytes) {
    const format = String(mediaFormat || "").trim().toUpperCase();
    const sniffed = sniffMetaHeaderMediaMime(bytes);
    if (sniffed && MEDIA_MIME[format]?.has(sniffed))
        return sniffed;
    if (format === "VIDEO" && sniffed === "video/mp4")
        return sniffed;
    if (format === "DOCUMENT" && sniffed === "application/pdf")
        return sniffed;
    const raw = normalizeHeaderMediaMime(mime);
    const ext = String(fileName || "").toLowerCase().split(".").pop() || "";
    const fromAlias = MIME_ALIASES[raw] || raw;
    if (MEDIA_MIME[format]?.has(fromAlias))
        return fromAlias;
    if (format === "IMAGE" && (ext === "png" || ext === "jpg" || ext === "jpeg")) {
        return ext === "png" ? "image/png" : "image/jpeg";
    }
    if (format === "VIDEO" && ext === "mp4")
        return "video/mp4";
    if (format === "DOCUMENT" && ext === "pdf")
        return "application/pdf";
    return fromAlias;
}
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
function safeHost(url) {
    try {
        return new URL(url).hostname || "";
    }
    catch {
        return "";
    }
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
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), analyses = new meta_whatsapp_template_ai_repository_1.MetaWhatsappTemplateAiRepository(), openAi = waba_openai_responses_client_1.callOpenAiStructured, templates = new meta_whatsapp_template_service_1.MetaWhatsappTemplateService(), decrypt = meta_token_crypto_1.decryptMetaToken, uploadHeader = meta_whatsapp_resumable_upload_1.uploadMetaResumableImage, createButtonShortUrl = meta_whatsapp_template_ai_short_url_1.createMetaTemplateButtonShortUrl) {
        this.connections = connections;
        this.analyses = analyses;
        this.openAi = openAi;
        this.templates = templates;
        this.decrypt = decrypt;
        this.uploadHeader = uploadHeader;
        this.createButtonShortUrl = createButtonShortUrl;
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
        const catalog = this.templates;
        let approvedUtilityExamples = [];
        if (typeof catalog.listApprovedUtilityExamples === "function") {
            try {
                const listed = await catalog.listApprovedUtilityExamples(tenant.tenantId);
                approvedUtilityExamples = Array.isArray(listed) ? listed.slice(0, 8) : [];
            }
            catch {
                approvedUtilityExamples = [];
            }
        }
        let ai;
        try {
            ai = await this.openAi({
                instructions: (0, meta_whatsapp_template_ai_prompt_1.buildMetaTemplateAiInstructions)(),
                input: JSON.stringify({
                    requestedCategory: "UTILITY",
                    language,
                    variableType,
                    baseText,
                    approvedUtilityExamples,
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
            result = (0, meta_whatsapp_template_ai_utility_shape_1.shapeMetaUtilityAiOutput)((0, meta_whatsapp_template_ai_schema_1.validateMetaTemplateAiOutput)(ai.value), variableType);
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
            approvedExampleCount: approvedUtilityExamples.length,
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
    applyOptionBodyEdits(result, edits) {
        if (!edits.length)
            return result;
        const options = result.options.map((option) => ({ ...option }));
        for (const edit of edits) {
            if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index > 2 || !options[edit.index]) {
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
            }
            options[edit.index] = {
                ...options[edit.index],
                body: (0, meta_whatsapp_template_ai_option_edit_1.assertEditedMetaTemplateAiOptionBody)(edit.body),
            };
        }
        return { ...result, options };
    }
    async saveEditedOptionFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const connectionId = String(input?.connectionId || input?.connection_id || "").trim();
        const analysisId = String(input?.analysisId || input?.analysis_id || "").trim();
        const index = Math.round(Number(input?.index ?? input?.optionIndex ?? input?.option_index));
        if (!connectionId || !analysisId || !Number.isInteger(index) || index < 0 || index > 2) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        await this.requirePortfolio(tenant.tenantId, connectionId);
        const analysis = await this.analyses.findForSubmission(tenant.tenantId, connectionId, analysisId);
        if (!analysis || !Array.isArray(analysis.result.options) || analysis.result.options.length !== 3) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_ai_invalid_output");
        }
        const result = this.applyOptionBodyEdits(analysis.result, [
            { index, body: String(input?.body ?? input?.text ?? "") },
        ]);
        try {
            await this.analyses.updateResult(tenant.tenantId, connectionId, analysisId, result);
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        }
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
            tenantId: tenant.tenantId,
            connectionId,
            optionEdited: true,
            optionIndex: index,
        });
        return { analysisId, index, option: result.options[index] };
    }
    async submitAllFromAuth(auth, input, publicBaseHints) {
        const tenant = requireTenant(auth);
        const connectionId = String(input?.connectionId || input?.connection_id || "").trim();
        const analysisId = String(input?.analysisId || input?.analysis_id || "").trim();
        if (!connectionId || !analysisId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const shell = (0, meta_whatsapp_template_ai_shell_1.parseMetaTemplateAiShell)(input);
        const connection = await this.requirePortfolio(tenant.tenantId, connectionId);
        const analysis = await this.analyses.findForSubmission(tenant.tenantId, connectionId, analysisId);
        if (!analysis ||
            !analysis.eligibleForUtility ||
            analysis.result.recommendedCategory !== "UTILITY" ||
            !Array.isArray(analysis.result.options) ||
            analysis.result.options.length !== 3) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_ai_invalid_output");
        }
        const optionEdits = (0, meta_whatsapp_template_ai_option_edit_1.parseMetaTemplateAiOptionBodyOverrides)(input);
        let analysisResult = analysis.result;
        if (optionEdits.length) {
            analysisResult = this.applyOptionBodyEdits(analysis.result, optionEdits);
            try {
                await this.analyses.updateResult(tenant.tenantId, connectionId, analysisId, analysisResult);
            }
            catch {
                throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
            }
        }
        const results = [];
        const alreadySubmitted = await this.analyses.listSubmittedNames(tenant.tenantId, connectionId, analysisId);
        const pendingIndexes = [];
        for (let index = 0; index < analysisResult.options.length; index += 1) {
            const name = (0, meta_whatsapp_template_ai_shell_1.templateNameForOption)(shell.modelName, index);
            if (!alreadySubmitted.has(name)) {
                pendingIndexes.push(index);
                continue;
            }
            const localFinder = this.templates;
            const local = typeof localFinder.findByNameForConnection === "function"
                ? await localFinder.findByNameForConnection(tenant.tenantId, connectionId, name, analysis.language)
                : null;
            if (local) {
                results.push({
                    index,
                    name,
                    ok: true,
                    alreadySubmitted: true,
                    status: local.status || "ALREADY_SUBMITTED",
                    templateId: local.id,
                    error: null,
                });
                continue;
            }
            pendingIndexes.push(index);
        }
        let metaButtonUrl = null;
        if (pendingIndexes.length) {
            metaButtonUrl = await this.createButtonShortUrl({
                destinationUrl: shell.buttonUrl,
                tenantId: tenant.tenantId,
                publicBaseHints,
            });
            (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
                tenantId: tenant.tenantId,
                connectionId,
                buttonShortened: true,
                destinationHost: safeHost(shell.buttonUrl),
                shortHost: safeHost(metaButtonUrl),
            });
        }
        const graphShell = metaButtonUrl ? { ...shell, buttonUrl: metaButtonUrl } : shell;
        for (const index of pendingIndexes) {
            const option = analysisResult.options[index];
            const name = (0, meta_whatsapp_template_ai_shell_1.templateNameForOption)(shell.modelName, index);
            try {
                const template = await this.templates.createFromAuth(auth, {
                    connectionId,
                    aiAnalysisId: analysisId,
                    aiOptionIndex: index,
                    name,
                    language: analysis.language,
                    category: "UTILITY",
                    components: (0, meta_whatsapp_template_ai_shell_1.componentsFromAiOptionAndShell)(option, graphShell),
                });
                results.push({
                    index,
                    name,
                    ok: true,
                    alreadySubmitted: false,
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
                    alreadySubmitted: false,
                    status: null,
                    templateId: null,
                    error: error instanceof meta_whatsapp_errors_1.MetaWhatsappError
                        ? error.message
                        : "Não foi possível cadastrar esta opção.",
                });
            }
        }
        results.sort((a, b) => a.index - b.index);
        const submitted = results.filter((item) => item.ok && !item.alreadySubmitted).length;
        const failed = results.filter((item) => !item.ok).length;
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
            tenantId: tenant.tenantId,
            connectionId,
            batchSubmit: true,
            submitted,
            failed,
            skippedLive: results.filter((item) => item.alreadySubmitted).length,
        });
        return {
            total: results.length,
            submitted,
            failed,
            results,
            portfolioName: String(connection.verifiedName || connection.displayPhoneNumber || "").trim() || "Portfólio",
            wabaId: String(connection.wabaId || ""),
        };
    }
    async uploadHeaderMediaFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const connectionId = String(input.connectionId || "").trim();
        const mediaFormat = String(input.mediaFormat || "").trim().toUpperCase();
        const allowed = MEDIA_MIME[mediaFormat];
        const bytes = input.bytes;
        const originalName = String(input.fileName || "header").trim() || "header";
        const mime = resolveMetaHeaderMediaMime(mediaFormat, input.mime || "", originalName, bytes);
        const fileName = sanitizeGraphUploadFileName(originalName, mime);
        if (!connectionId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        if (!allowed || !bytes?.length || !allowed.has(mime)) {
            const failed = new meta_whatsapp_errors_1.MetaWhatsappError("template_upload_failed");
            if (mediaFormat === "VIDEO") {
                failed.message =
                    "A Meta só aceita vídeo MP4 (H.264, AAC ou sem áudio) no cabeçalho. Confira o arquivo e tente de novo.";
            }
            throw failed;
        }
        if (mediaFormat === "VIDEO" && bytes.length > 16 * 1024 * 1024) {
            const failed = new meta_whatsapp_errors_1.MetaWhatsappError("template_upload_failed");
            failed.message =
                "A Meta recusou o arquivo por tamanho. Vídeo de cabeçalho até 16 MB. Comprima o MP4 e envie de novo.";
            throw failed;
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
                timeoutMs: mediaFormat === "VIDEO" ? 300000 : undefined,
            });
            const handle = String(uploaded.handle || "").trim();
            if (!handle)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("template_upload_failed");
            (0, meta_whatsapp_template_header_preview_store_1.saveTemplateHeaderPreview)({
                tenantId: tenant.tenantId,
                handle,
                mime,
                fileName,
                bytes,
            });
            (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
                tenantId: tenant.tenantId,
                connectionId,
                headerUpload: mediaFormat,
                bytes: bytes.length,
                mime,
            });
            return { handle, mediaFormat };
        }
        catch (error) {
            if (error instanceof meta_whatsapp_errors_1.MetaWhatsappError)
                throw error;
            const msg = String(error?.message || "").replace(/\s+/g, " ").trim();
            (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
                tenantId: tenant.tenantId,
                connectionId,
                headerUploadFailed: mediaFormat,
                mime,
                bytes: bytes.length,
                reason: msg.slice(0, 160),
            });
            throw (0, meta_whatsapp_errors_1.wrapMetaHeaderUploadError)(error);
        }
    }
}
exports.MetaWhatsappTemplateAiService = MetaWhatsappTemplateAiService;
