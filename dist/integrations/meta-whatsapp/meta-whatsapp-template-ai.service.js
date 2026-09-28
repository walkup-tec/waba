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
const meta_whatsapp_header_handle_cache_1 = require("./meta-whatsapp-header-handle-cache");
const meta_whatsapp_graph_cooldown_1 = require("./meta-whatsapp-graph-cooldown");
const meta_whatsapp_template_ai_schema_1 = require("./meta-whatsapp-template-ai.schema");
const meta_whatsapp_template_ai_shell_1 = require("./meta-whatsapp-template-ai-shell");
const meta_whatsapp_template_ai_utility_shape_1 = require("./meta-whatsapp-template-ai-utility-shape");
const meta_whatsapp_template_ai_option_edit_1 = require("./meta-whatsapp-template-ai-option-edit");
const meta_whatsapp_known_owned_wabas_1 = require("./meta-whatsapp-known-owned-wabas");
const meta_whatsapp_template_log_1 = require("./meta-whatsapp-template-log");
const meta_whatsapp_template_service_1 = require("./meta-whatsapp-template.service");
const meta_whatsapp_template_waba_ids_1 = require("./meta-whatsapp-template-waba-ids");
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
function submitAllBudgetMs() {
    return Math.max(4000, Math.min(25000, Number(process.env.META_TEMPLATE_AI_SUBMIT_BUDGET_MS || 22000)));
}
function isEnabled() {
    const raw = String(process.env.META_TEMPLATE_AI_ENABLED || "").trim().toLowerCase();
    if (raw === "0" || raw === "false" || raw === "off")
        return false;
    return Boolean(String(process.env.OPENAI_API_KEY || "").trim());
}
function hasUsableToken(row) {
    return Boolean(row && String(row.accessTokenEncrypted || "").trim());
}
/** Card do Lab pode apontar para pending_token com token (fan-out do catálogo). */
function isAiReadyConnection(row) {
    if (!row || row.disconnectedAt || !hasUsableToken(row))
        return false;
    return (row.status === "connected" ||
        row.status === "pending_confirmation" ||
        row.status === "pending_token");
}
function isUsableTemplateConnection(row) {
    return Boolean(row &&
        !row.disconnectedAt &&
        (row.status === "connected" || row.status === "pending_confirmation") &&
        String(row.wabaId || "").trim());
}
function connectionMatchesRequest(row, requested) {
    const want = String(requested || "").trim();
    if (!want)
        return false;
    if (String(row.id || "").trim() === want)
        return true;
    return (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(row.metaBusinessId || ""), want);
}
function pickUsableOpenConnection(open, requested) {
    const matches = open.filter((row) => connectionMatchesRequest(row, requested) && isUsableTemplateConnection(row));
    return matches.find((row) => row.status === "connected") || matches[0] || null;
}
function pickCatalogAgencyWriter(open) {
    const agency = open.filter((row) => isUsableTemplateConnection(row) &&
        (0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)().some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, String(row.metaBusinessId || ""))));
    return agency.find((row) => row.status === "connected") || agency[0] || null;
}
function componentsFromAiOption(option, hasLinkButton = true) {
    const placeholders = [...new Set([...option.body.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1])))].sort((a, b) => a - b);
    const maxPlaceholder = placeholders.length ? Math.max(...placeholders) : 0;
    if (placeholders.some((value, index) => value !== index + 1)) {
        throw new Error("Variáveis não sequenciais.");
    }
    if (maxPlaceholder !== option.variableExamples.length) {
        throw new Error("Exemplos incompatíveis com variáveis.");
    }
    const buttonText = String(option.buttonText || "").trim();
    if (hasLinkButton && !buttonText)
        throw new Error("Botão operacional ausente.");
    const components = [
        {
            type: "BODY",
            text: option.body,
            ...(maxPlaceholder ? { example: { body_text: [option.variableExamples] } } : {}),
        },
    ];
    if (hasLinkButton && buttonText) {
        components.push({
            type: "BUTTONS",
            buttons: [{ type: "QUICK_REPLY", text: buttonText }],
        });
    }
    return components;
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
    async listOpenConnections(tenantId) {
        const repo = this.connections;
        if (typeof repo.listOpenByTenant === "function") {
            return repo.listOpenByTenant(tenantId);
        }
        return [];
    }
    async requirePortfolio(tenantId, connectionId) {
        const id = String(connectionId || "").trim();
        if (!id)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        let row = null;
        try {
            row = await this.connections.findByIdForTenant(tenantId, id);
        }
        catch (error) {
            const text = String(error?.message || error || "");
            if (!/invalid input syntax for type uuid/i.test(text))
                throw error;
            row = null;
        }
        if (!isUsableTemplateConnection(row)) {
            const open = await this.listOpenConnections(tenantId);
            const sibling = pickUsableOpenConnection(open, id) ||
                (row?.metaBusinessId ? pickUsableOpenConnection(open, String(row.metaBusinessId)) : null);
            if (sibling)
                row = sibling;
            const repo = this.connections;
            const bmHint = String((isUsableTemplateConnection(row) ? "" : row?.metaBusinessId) ||
                (/^\d{6,}$/.test(id) ? id : "")).trim();
            if (!isUsableTemplateConnection(row) && bmHint && typeof repo.findByBusinessId === "function") {
                const byBm = await repo.findByBusinessId(tenantId, bmHint);
                if (isUsableTemplateConnection(byBm))
                    row = byBm;
            }
        }
        if (!row || row.tenantId !== tenantId || !isAiReadyConnection(row)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        return row;
    }
    async pickSubmitWriter(tenantId, preferred, targetWabaId) {
        const open = await this.listOpenConnections(tenantId);
        const pool = open.length ? open : [preferred];
        const writers = (0, meta_whatsapp_template_waba_ids_1.pickTemplateWriteConnections)(pool, preferred, targetWabaId);
        const usable = writers.find((row) => isUsableTemplateConnection(row));
        if (usable)
            return usable;
        const agency = pickCatalogAgencyWriter(pool);
        if (agency)
            return agency;
        return (pool.find((row) => isUsableTemplateConnection(row) && row.status === "connected") ||
            pool.find((row) => isUsableTemplateConnection(row)) ||
            preferred);
    }
    async resolveSubmitPortfolios(tenantId, connectionIds) {
        const requested = [...new Set(connectionIds.map((id) => String(id || "").trim()).filter(Boolean))];
        if (!requested.length)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const out = [];
        const seenWaba = new Set();
        for (const id of requested) {
            const row = await this.requirePortfolio(tenantId, id);
            const wabaId = String(row.wabaId || "").trim();
            if (wabaId && seenWaba.has(wabaId))
                continue;
            if (wabaId)
                seenWaba.add(wabaId);
            out.push(row);
        }
        if (!out.length)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        return out;
    }
    async generateFromAuth(auth, input) {
        if (!isEnabled())
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_ai_unavailable");
        const tenant = requireTenant(auth);
        const connectionId = String(input?.connectionId || input?.connection_id || "").trim();
        const baseText = String(input?.baseText || input?.base_text || "").trim();
        const language = String(input?.language || "pt_BR").trim() || "pt_BR";
        const variableType = String(input?.variableType || input?.variable_type || "nome").trim().toLowerCase();
        const hasLinkButton = (0, meta_whatsapp_template_ai_shell_1.parseMetaTemplateAiHasLinkButton)(input);
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
                instructions: (0, meta_whatsapp_template_ai_prompt_1.buildMetaTemplateAiInstructions)({ hasLinkButton }),
                input: JSON.stringify({
                    requestedCategory: "UTILITY",
                    language,
                    variableType,
                    hasLinkButton,
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
            result = (0, meta_whatsapp_template_ai_utility_shape_1.shapeMetaUtilityAiOutput)((0, meta_whatsapp_template_ai_schema_1.validateMetaTemplateAiOutput)(ai.value), variableType, hasLinkButton);
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
                    components: componentsFromAiOption(option, hasLinkButton),
                });
            }
        }
        catch (error) {
            (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
                tenantId: tenant.tenantId,
                connectionId: connection.id,
                invalidOutput: true,
                hasLinkButton,
                reason: error instanceof Error ? error.message : "invalid_output",
            });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_ai_invalid_output");
        }
        const analyzedAt = new Date().toISOString();
        let analysisId = "";
        try {
            analysisId = await this.analyses.create({
                tenantId: tenant.tenantId,
                connectionId: connection.id,
                wabaId: String(connection.wabaId || ""),
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
            wabaId: String(connection.wabaId || ""),
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
        const connectionIds = (0, meta_whatsapp_template_ai_shell_1.parseTemplateAiConnectionIds)(input);
        const requestedWabaIds = (0, meta_whatsapp_template_ai_shell_1.parseTemplateAiWabaIds)(input);
        const requestedTargets = (0, meta_whatsapp_template_ai_shell_1.parseTemplateAiWabaTargets)(input);
        const analysisId = String(input?.analysisId || input?.analysis_id || "").trim();
        const portfolioIds = [
            ...new Set([
                ...connectionIds,
                ...requestedTargets.map((item) => item.connectionId).filter(Boolean),
            ]),
        ];
        if (!portfolioIds.length || !analysisId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const portfolios = await this.resolveSubmitPortfolios(tenant.tenantId, portfolioIds);
        const byConnectionId = new Map(portfolios.map((row) => [row.id, row]));
        const portfolioLabel = (connection) => String(connection.verifiedName || connection.displayPhoneNumber || "").trim() || "Portfólio";
        const submitTargets = requestedTargets.length
            ? requestedTargets.flatMap((item) => {
                const connection = (item.connectionId && byConnectionId.get(item.connectionId)) ||
                    portfolios.find((row) => String(row.wabaId || "") === item.wabaId) ||
                    (portfolios.length === 1 ? portfolios[0] : null);
                if (!connection)
                    return [];
                return [
                    {
                        connection,
                        wabaId: item.wabaId,
                        portfolioName: portfolioLabel(connection),
                    },
                ];
            })
            : requestedWabaIds.length
                ? requestedWabaIds.map((wabaId) => ({
                    connection: portfolios.find((row) => String(row.wabaId || "") === wabaId) || portfolios[0],
                    wabaId,
                    portfolioName: portfolioLabel(portfolios.find((row) => String(row.wabaId || "") === wabaId) || portfolios[0]),
                }))
                : portfolios.map((connection) => ({
                    connection,
                    wabaId: String(connection.wabaId || ""),
                    portfolioName: portfolioLabel(connection),
                }));
        if (!submitTargets.length)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        let analysis = await this.analyses.findForSubmission(tenant.tenantId, portfolios[0].id, analysisId);
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
                await this.analyses.updateResult(tenant.tenantId, portfolios[0].id, analysisId, analysisResult);
            }
            catch {
                throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
            }
        }
        const headerHandles = (0, meta_whatsapp_template_ai_shell_1.parseTemplateAiHeaderHandles)(input);
        const fallbackHandle = (0, meta_whatsapp_header_handle_cache_1.normalizeResumableUploadHandle)(String(input?.headerHandle || input?.header_handle || ""));
        const firstHandle = (0, meta_whatsapp_header_handle_cache_1.normalizeResumableUploadHandle)(headerHandles[portfolios[0].id] || "") || fallbackHandle;
        const shell = (0, meta_whatsapp_template_ai_shell_1.parseMetaTemplateAiShell)({
            ...input,
            headerHandle: firstHandle,
        });
        if ((shell.mediaFormat === "IMAGE" || shell.mediaFormat === "VIDEO" || shell.mediaFormat === "DOCUMENT") &&
            firstHandle &&
            !(0, meta_whatsapp_header_handle_cache_1.isResumableUploadHandle)(firstHandle)) {
            const failed = new meta_whatsapp_errors_1.MetaWhatsappError("template_upload_failed");
            failed.message =
                "A Meta exige o handle do upload da imagem (4::), não o link lookaside do template antigo. Envie a foto de novo no Enviar.";
            throw failed;
        }
        const results = [];
        const anyPending = [];
        const localFinder = this.templates;
        const findLocal = async (wabaId, connectionId, name) => {
            if (typeof localFinder.findByWabaNameLanguage === "function" && wabaId) {
                const byWaba = await localFinder.findByWabaNameLanguage(tenant.tenantId, wabaId, name, analysis.language);
                if (byWaba)
                    return byWaba;
            }
            if (typeof localFinder.findByNameForConnection === "function") {
                return localFinder.findByNameForConnection(tenant.tenantId, connectionId, name, analysis.language);
            }
            return null;
        };
        const alreadyOnThisWaba = (local, wabaId) => Boolean(local && (!wabaId || String(local.wabaId || "") === wabaId || !local.wabaId));
        for (const target of submitTargets) {
            for (let index = 0; index < analysisResult.options.length; index += 1) {
                const name = (0, meta_whatsapp_template_ai_shell_1.templateNameForOption)(shell.modelName, index);
                const local = await findLocal(target.wabaId, target.connection.id, name);
                if (!alreadyOnThisWaba(local, target.wabaId))
                    anyPending.push(index);
            }
        }
        let metaButtonUrl = null;
        const ensureMetaButtonUrl = async () => {
            if (metaButtonUrl)
                return metaButtonUrl;
            metaButtonUrl = (0, meta_whatsapp_template_ai_short_url_1.assertMetaReadyButtonShortUrl)(await this.createButtonShortUrl({
                destinationUrl: shell.buttonUrl,
                tenantId: tenant.tenantId,
                publicBaseHints,
            }));
            (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
                tenantId: tenant.tenantId,
                connectionId: portfolios[0].id,
                buttonShortened: true,
                destinationHost: safeHost(shell.buttonUrl),
                shortHost: safeHost(metaButtonUrl),
            });
            return metaButtonUrl;
        };
        if (anyPending.length && shell.hasLinkButton)
            await ensureMetaButtonUrl();
        const deadlineAt = Date.now() + submitAllBudgetMs();
        const budgetError = "A Meta demorou neste envio. As opções já aceitas não precisam ser reenviadas. Clique em Enviar de novo só para as que faltaram.";
        for (const target of submitTargets) {
            const { connection, wabaId, portfolioName } = target;
            const handle = (0, meta_whatsapp_header_handle_cache_1.normalizeResumableUploadHandle)(headerHandles[connection.id] || "") || firstHandle;
            for (let index = 0; index < analysisResult.options.length; index += 1) {
                const option = analysisResult.options[index];
                const name = (0, meta_whatsapp_template_ai_shell_1.templateNameForOption)(shell.modelName, index);
                const local = await findLocal(wabaId, connection.id, name);
                if (alreadyOnThisWaba(local, wabaId) && local) {
                    results.push({
                        index,
                        name,
                        ok: true,
                        alreadySubmitted: true,
                        status: local.status || "ALREADY_SUBMITTED",
                        templateId: local.id,
                        error: null,
                        connectionId: connection.id,
                        portfolioName,
                        wabaId,
                    });
                    continue;
                }
                if (Date.now() >= deadlineAt) {
                    results.push({
                        index,
                        name,
                        ok: false,
                        alreadySubmitted: false,
                        status: null,
                        templateId: null,
                        error: budgetError,
                        connectionId: connection.id,
                        portfolioName,
                        wabaId,
                    });
                    continue;
                }
                try {
                    const buttonUrl = shell.hasLinkButton ? await ensureMetaButtonUrl() : "";
                    const writer = await this.pickSubmitWriter(tenant.tenantId, connection, wabaId);
                    const template = await this.templates.createFromAuth(auth, {
                        connectionId: writer.id,
                        wabaId,
                        aiAnalysisId: analysisId,
                        aiOptionIndex: index,
                        name,
                        language: analysis.language,
                        category: "UTILITY",
                        components: (0, meta_whatsapp_template_ai_shell_1.componentsFromAiOptionAndShell)(option, {
                            ...shell,
                            buttonUrl,
                            headerHandle: handle || shell.headerHandle,
                        }),
                    });
                    results.push({
                        index,
                        name,
                        ok: true,
                        alreadySubmitted: false,
                        status: template.status,
                        templateId: template.id,
                        error: null,
                        connectionId: connection.id,
                        portfolioName,
                        wabaId,
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
                        connectionId: connection.id,
                        portfolioName,
                        wabaId,
                    });
                }
            }
        }
        results.sort((a, b) => {
            const byPortfolio = a.connectionId.localeCompare(b.connectionId);
            if (byPortfolio)
                return byPortfolio;
            const byWaba = String(a.wabaId || "").localeCompare(String(b.wabaId || ""));
            if (byWaba)
                return byWaba;
            return a.index - b.index;
        });
        const submitted = results.filter((item) => item.ok && !item.alreadySubmitted).length;
        const failed = results.filter((item) => !item.ok).length;
        const portfolioSummaries = submitTargets.map((target) => {
            const rows = results.filter((item) => item.connectionId === target.connection.id && item.wabaId === target.wabaId);
            return {
                connectionId: target.connection.id,
                portfolioName: target.portfolioName,
                wabaId: target.wabaId,
                submitted: rows.filter((item) => item.ok && !item.alreadySubmitted).length,
                failed: rows.filter((item) => !item.ok).length,
            };
        });
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
            tenantId: tenant.tenantId,
            connectionId: portfolios[0].id,
            batchSubmit: true,
            submitted,
            failed,
            portfolios: submitTargets.length,
            skippedLive: results.filter((item) => item.alreadySubmitted).length,
        });
        return {
            total: results.length,
            submitted,
            failed,
            results,
            portfolioName: portfolioSummaries.map((row) => row.portfolioName).join(" · "),
            wabaId: portfolioSummaries.map((row) => row.wabaId).filter(Boolean).join(" · "),
            portfolios: portfolioSummaries,
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
        const preferred = await this.requirePortfolio(tenant.tenantId, connectionId);
        const appId = (0, meta_config_1.readMetaAppId)();
        if (!appId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("config_invalid");
        const fileSha = (0, meta_whatsapp_header_handle_cache_1.headerFileSha256)(bytes);
        const cachedHandle = (0, meta_whatsapp_header_handle_cache_1.readCachedHeaderHandle)(tenant.tenantId, fileSha);
        if (cachedHandle && (0, meta_whatsapp_header_handle_cache_1.isResumableUploadHandle)(cachedHandle)) {
            (0, meta_whatsapp_template_header_preview_store_1.saveTemplateHeaderPreview)({
                tenantId: tenant.tenantId,
                handle: cachedHandle,
                mime,
                fileName,
                bytes,
            });
            (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
                tenantId: tenant.tenantId,
                connectionId,
                headerUpload: mediaFormat,
                headerCache: true,
                bytes: bytes.length,
                mime,
            });
            return { handle: cachedHandle, mediaFormat };
        }
        if ((0, meta_whatsapp_graph_cooldown_1.isMetaGraphUploadCooldown)()) {
            const failed = new meta_whatsapp_errors_1.MetaWhatsappError("template_upload_failed");
            failed.message = (0, meta_whatsapp_graph_cooldown_1.metaGraphUploadCooldownMessage)();
            throw failed;
        }
        const repo = this.connections;
        const openRows = typeof repo.listOpenByTenant === "function" ? await repo.listOpenByTenant(tenant.tenantId) : [];
        const writer = await this.pickSubmitWriter(tenant.tenantId, preferred, String(preferred.wabaId || ""));
        const candidates = [];
        const seen = new Set();
        const pushCandidate = (row) => {
            if (!row || seen.has(row.id) || row.disconnectedAt)
                return;
            if (!isUsableTemplateConnection(row))
                return;
            seen.add(row.id);
            candidates.push(row);
        };
        pushCandidate(writer);
        pushCandidate(preferred);
        for (const row of openRows)
            pushCandidate(row);
        if (!candidates.length)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        let lastError = null;
        for (const candidate of candidates) {
            let token = "";
            try {
                token = this.decrypt(candidate.accessTokenEncrypted);
            }
            catch {
                continue;
            }
            if (!token)
                continue;
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
                (0, meta_whatsapp_header_handle_cache_1.writeCachedHeaderHandle)(tenant.tenantId, fileSha, handle);
                (0, meta_whatsapp_template_header_preview_store_1.saveTemplateHeaderPreview)({
                    tenantId: tenant.tenantId,
                    handle,
                    mime,
                    fileName,
                    bytes,
                });
                (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
                    tenantId: tenant.tenantId,
                    connectionId: candidate.id,
                    headerUpload: mediaFormat,
                    headerFallback: candidate.id !== preferred.id,
                    bytes: bytes.length,
                    mime,
                });
                return { handle, mediaFormat };
            }
            catch (error) {
                if (error instanceof meta_whatsapp_errors_1.MetaWhatsappError && error.code !== "template_upload_failed")
                    throw error;
                lastError = error;
                const msg = String(error?.message || "").replace(/\s+/g, " ").trim();
                (0, meta_whatsapp_template_log_1.logMetaTemplate)("AI", {
                    tenantId: tenant.tenantId,
                    connectionId: candidate.id,
                    headerUploadFailed: mediaFormat,
                    mime,
                    bytes: bytes.length,
                    reason: msg.slice(0, 160),
                });
                // Código 4 é cota do aplicativo: outro token no mesmo app só queima mais cota.
                if ((0, meta_whatsapp_header_handle_cache_1.isHeaderUploadAppRateLimit)(error)) {
                    (0, meta_whatsapp_graph_cooldown_1.markMetaGraphUploadCooldown)();
                    break;
                }
            }
        }
        const failed = (0, meta_whatsapp_errors_1.wrapMetaHeaderUploadError)(lastError || new meta_whatsapp_errors_1.MetaWhatsappError("template_upload_failed"));
        if (/código 4|limitou temporariamente/i.test(failed.message)) {
            (0, meta_whatsapp_graph_cooldown_1.markMetaGraphUploadCooldown)();
            failed.message =
                "A Meta bloqueou o upload de mídia deste aplicativo (código 4). Não é o tamanho da imagem. Feche Conexão, não clique em Atualizar da Meta e não tente de novo agora — cada clique atrasa a cota.";
        }
        throw failed;
    }
}
exports.MetaWhatsappTemplateAiService = MetaWhatsappTemplateAiService;
