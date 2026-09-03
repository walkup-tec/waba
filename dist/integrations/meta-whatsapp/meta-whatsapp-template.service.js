"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappTemplateService = void 0;
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_token_crypto_1 = require("./meta-token-crypto");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_graph_errors_1 = require("./meta-whatsapp-graph-errors");
const meta_whatsapp_template_log_1 = require("./meta-whatsapp-template-log");
const meta_whatsapp_template_approved_at_store_1 = require("./meta-whatsapp-template-approved-at.store");
const meta_whatsapp_template_repository_1 = require("./meta-whatsapp-template.repository");
const meta_whatsapp_template_graph_client_1 = require("./meta-whatsapp-template-graph.client");
const meta_whatsapp_template_silent_block_button_1 = require("./meta-whatsapp-template-silent-block-button");
const meta_whatsapp_template_validate_1 = require("./meta-whatsapp-template-validate");
const meta_whatsapp_template_ai_approved_examples_1 = require("./meta-whatsapp-template-ai-approved-examples");
const meta_whatsapp_template_types_1 = require("./meta-whatsapp-template.types");
const meta_whatsapp_template_ai_repository_1 = require("./meta-whatsapp-template-ai.repository");
const meta_whatsapp_template_header_preview_store_1 = require("./meta-whatsapp-template-header-preview.store");
const meta_whatsapp_broadcast_template_1 = require("./meta-whatsapp-broadcast-template");
function requireTenant(auth) {
    try {
        return (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("unauthenticated");
    }
}
function mimeForApprovedHeaderAttach(format, mime, fileName, bytes) {
    const type = String(mime || "").trim().toLowerCase().split(";")[0];
    const name = String(fileName || "").trim().toLowerCase();
    if (format === "IMAGE") {
        if (bytes[0] === 0x89 && bytes[1] === 0x50)
            return "image/png";
        if (bytes[0] === 0xff && bytes[1] === 0xd8)
            return "image/jpeg";
        if (type === "image/png" || name.endsWith(".png"))
            return "image/png";
        if (type === "image/jpeg" || type === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        return "";
    }
    if (format === "VIDEO") {
        if (type === "video/mp4" || name.endsWith(".mp4"))
            return "video/mp4";
        return "";
    }
    if (type === "application/pdf" || name.endsWith(".pdf") || bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
        return "application/pdf";
    }
    return "";
}
function isGraphTemplateGone(result) {
    if (result.status === 404)
        return true;
    const err = result.json?.error;
    const text = `${err?.message || ""} ${err?.error_user_msg || ""}`;
    return /does not exist|not found|não exist/i.test(text);
}
function throwFromGraph(result) {
    const detail = (0, meta_whatsapp_graph_errors_1.safePublicGraphTemplateDetail)(result.json);
    (0, meta_whatsapp_template_log_1.logMetaTemplate)("ERROR", {
        status: result.status,
        kind: result.kind,
        timeout: result.timeout === true,
        graphCode: result.graphCode || null,
        graphDetail: detail || null,
    });
    if (result.status === 401)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
    if (result.status === 400) {
        const error = new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        error.message = (0, meta_whatsapp_graph_errors_1.publicMetaGraphTemplateMessage)(result.kind, result.status, result.json);
        throw error;
    }
    const status = result.timeout || result.status === 429 || result.status >= 500 || result.status === 0 ? 503 : 424;
    const error = new meta_whatsapp_errors_1.MetaWhatsappError("send_failed", status);
    error.message = (0, meta_whatsapp_graph_errors_1.publicMetaGraphTemplateMessage)(result.kind, result.status, result.json);
    throw error;
}
function warnIgnored(body, tenantId) {
    if (body?.tenant_id ||
        body?.tenantId ||
        body?.owner_email ||
        body?.waba_id ||
        body?.wabaId ||
        body?.access_token) {
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("ERROR", { reason: "ignored_client_claims", tenantId });
    }
}
function publicPortfolioName(connection) {
    return String(connection.verifiedName || connection.displayPhoneNumber || "").trim() || "Portfólio";
}
function rememberApprovedTemplate(row) {
    (0, meta_whatsapp_template_approved_at_store_1.rememberTemplateApprovedAt)({
        tenantId: row.tenantId,
        templateId: row.id,
        metaTemplateId: row.metaTemplateId,
        wabaId: row.wabaId,
        name: row.name,
        language: row.language,
        status: row.status,
    }, row.lastSyncedAt || row.updatedAt);
}
class MetaWhatsappTemplateService {
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), templates = new meta_whatsapp_template_repository_1.MetaWhatsappTemplateRepository(), graph = undefined, decrypt = meta_token_crypto_1.decryptMetaToken, analyses = new meta_whatsapp_template_ai_repository_1.MetaWhatsappTemplateAiRepository()) {
        this.connections = connections;
        this.templates = templates;
        this.graph = graph;
        this.decrypt = decrypt;
        this.analyses = analyses;
    }
    async requireConnectedWaba(tenantId, connectionId) {
        const requested = String(connectionId || "").trim();
        const row = requested
            ? await this.connections.findByIdForTenant(tenantId, requested)
            : await this.connections.findConnectedByTenant(tenantId);
        if (!row ||
            (row.status !== "connected" && row.status !== "pending_confirmation") ||
            !row.wabaId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        if (row.tenantId !== tenantId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        return row;
    }
    async findByNameForConnection(tenantId, connectionId, name, language) {
        const row = await this.templates.findForSend(tenantId, connectionId, name, language);
        if (!row || row.tenantId !== tenantId)
            return null;
        return row;
    }
    async listOpenConnections(tenantId) {
        const repo = this.connections;
        if (typeof repo.listOpenByTenant === "function") {
            return repo.listOpenByTenant(tenantId);
        }
        const one = await this.connections.findConnectedByTenant(tenantId);
        return one ? [one] : [];
    }
    async listApprovedUtilityExamples(tenantId) {
        const id = String(tenantId || "").trim();
        if (!id || typeof this.templates.listByTenant !== "function")
            return [];
        const rows = await this.templates.listByTenant(id);
        return (0, meta_whatsapp_template_ai_approved_examples_1.pickApprovedUtilityExamples)(rows);
    }
    async listFromAuth(auth, connectionId) {
        const tenant = requireTenant(auth);
        const requested = String(connectionId || "").trim();
        if (requested) {
            const connection = await this.requireConnectedWaba(tenant.tenantId, requested);
            const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
            (0, meta_whatsapp_template_log_1.logMetaTemplate)("LIST", { tenantId: tenant.tenantId, count: rows.length });
            return rows.map((row) => (0, meta_whatsapp_template_types_1.toPublicTemplate)(row, publicPortfolioName(connection)));
        }
        const rows = await this.templates.listByTenant(tenant.tenantId);
        const openRows = await this.listOpenConnections(tenant.tenantId);
        const byId = new Map(openRows.map((row) => [row.id, row]));
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("LIST", { tenantId: tenant.tenantId, count: rows.length });
        return rows.map((row) => {
            const connection = byId.get(row.connectionId);
            return (0, meta_whatsapp_template_types_1.toPublicTemplate)(row, connection ? publicPortfolioName(connection) : "Portfólio");
        });
    }
    async createFromAuth(auth, body) {
        const tenant = requireTenant(auth);
        warnIgnored(body, tenant.tenantId);
        const connection = await this.requireConnectedWaba(tenant.tenantId, String(body?.connectionId || body?.connection_id || ""));
        const validated = (0, meta_whatsapp_template_validate_1.validateTemplateCreate)(body);
        const components = (0, meta_whatsapp_template_silent_block_button_1.appendSilentBlockButton)(validated.components);
        let token = "";
        try {
            token = this.decrypt(connection.accessTokenEncrypted);
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        const graphBody = {
            name: validated.name,
            language: validated.language,
            category: validated.category,
            allow_category_change: true,
            components,
        };
        const result = await (0, meta_whatsapp_template_graph_client_1.createWabaMessageTemplate)({
            token,
            wabaId: String(connection.wabaId),
            body: graphBody,
            graph: this.graph,
        });
        if (!result.ok) {
            throwFromGraph(result);
        }
        const now = new Date().toISOString();
        const row = await this.templates.upsertFromGraph({
            tenantId: tenant.tenantId,
            connectionId: connection.id,
            wabaId: String(connection.wabaId),
            metaTemplateId: result.json?.id ? String(result.json.id) : null,
            name: validated.name,
            language: validated.language,
            category: result.json?.category ? String(result.json.category) : validated.category,
            status: result.json?.status ? String(result.json.status) : "PENDING",
            components,
            lastSyncedAt: now,
        });
        (0, meta_whatsapp_template_header_preview_store_1.bindTemplateHeaderPreview)({
            tenantId: tenant.tenantId,
            handle: (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(components),
            templateId: row.id,
            metaTemplateId: row.metaTemplateId,
            name: row.name,
            language: row.language,
        });
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("CREATE", {
            tenantId: tenant.tenantId,
            name: validated.name,
            language: validated.language,
            status: row.status,
        });
        rememberApprovedTemplate(row);
        const analysisId = String(body?.aiAnalysisId || body?.ai_analysis_id || "").trim();
        if (analysisId) {
            try {
                const optionIndexRaw = Number(body?.aiOptionIndex ?? body?.ai_option_index);
                await this.analyses.linkSubmission({
                    tenantId: tenant.tenantId,
                    connectionId: connection.id,
                    analysisId,
                    templateId: row.id,
                    metaTemplateId: row.metaTemplateId,
                    optionIndex: Number.isInteger(optionIndexRaw) ? optionIndexRaw : undefined,
                    submittedTemplate: {
                        name: validated.name,
                        language: validated.language,
                        category: validated.category,
                        components,
                    },
                    submittedCategory: validated.category,
                    metaStatus: row.status,
                    metaCategory: row.category,
                });
            }
            catch {
                (0, meta_whatsapp_template_log_1.logMetaTemplate)("ERROR", { reason: "ai_analysis_link_failed", tenantId: tenant.tenantId });
            }
        }
        return (0, meta_whatsapp_template_types_1.toPublicTemplate)(row, publicPortfolioName(connection));
    }
    async syncFromAuth(auth, connectionId) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnectedWaba(tenant.tenantId, connectionId);
        let token = "";
        try {
            token = this.decrypt(connection.accessTokenEncrypted);
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        const listed = await (0, meta_whatsapp_template_graph_client_1.listWabaMessageTemplates)({
            token,
            wabaId: String(connection.wabaId),
            graph: this.graph,
        });
        if (!listed.ok) {
            throwFromGraph(listed.result);
        }
        const now = new Date().toISOString();
        const upserted = [];
        for (const item of listed.items) {
            if (!item)
                continue;
            const previous = (item.metaTemplateId
                ? await this.templates.findByMetaId(tenant.tenantId, item.metaTemplateId)
                : null) ||
                (await this.templates.findByWabaNameLanguage(tenant.tenantId, String(connection.wabaId), item.name, item.language));
            const oldHandle = previous ? (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(previous.components) : "";
            const saved = await this.templates.upsertFromGraph({
                tenantId: tenant.tenantId,
                connectionId: connection.id,
                wabaId: String(connection.wabaId),
                metaTemplateId: item.metaTemplateId,
                name: item.name,
                language: item.language,
                category: item.category,
                status: item.status,
                components: item.components,
                qualityScore: item.qualityScore,
                rejectedReason: item.rejectedReason,
                lastSyncedAt: now,
            });
            const newHandle = (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(saved.components);
            (0, meta_whatsapp_template_header_preview_store_1.bindTemplateHeaderPreview)({
                tenantId: tenant.tenantId,
                handle: newHandle,
                previousHandle: oldHandle,
                templateId: saved.id,
                metaTemplateId: saved.metaTemplateId,
                name: saved.name,
                language: saved.language,
            });
            upserted.push(saved);
            rememberApprovedTemplate(saved);
            try {
                await this.analyses.patchMetaOutcome({
                    tenantId: tenant.tenantId,
                    templateId: saved.id,
                    metaTemplateId: saved.metaTemplateId,
                    metaStatus: saved.status,
                    metaCategory: saved.category,
                    rejectedReason: saved.rejectedReason,
                });
            }
            catch {
                (0, meta_whatsapp_template_log_1.logMetaTemplate)("ERROR", { reason: "ai_outcome_sync_failed", tenantId: tenant.tenantId });
            }
        }
        let removed = 0;
        if (listed.complete) {
            const keepMetaIds = new Set(listed.items
                .map((item) => String(item?.metaTemplateId || "").trim())
                .filter(Boolean));
            const keepNameLang = new Set(listed.items
                .filter((item) => Boolean(item))
                .map((item) => `${item.name}::${item.language}`));
            const locals = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
            for (const row of locals) {
                const keepById = Boolean(row.metaTemplateId && keepMetaIds.has(row.metaTemplateId));
                const keepByName = keepNameLang.has(`${row.name}::${row.language}`);
                if (keepById || keepByName)
                    continue;
                if (await this.templates.deleteForTenant(tenant.tenantId, row.id))
                    removed += 1;
            }
        }
        else {
            (0, meta_whatsapp_template_log_1.logMetaTemplate)("SYNC", {
                reason: "skip_prune_incomplete_list",
                tenantId: tenant.tenantId,
                pages: listed.pages,
            });
        }
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("SYNC", {
            tenantId: tenant.tenantId,
            pages: listed.pages,
            upserted: upserted.length,
            removed,
            complete: listed.complete,
        });
        const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
        return {
            templates: rows.map((row) => (0, meta_whatsapp_template_types_1.toPublicTemplate)(row, publicPortfolioName(connection))),
            pages: listed.pages,
            removed,
        };
    }
    async deleteFromAuth(auth, templateId) {
        const tenant = requireTenant(auth);
        const id = String(templateId || "").trim();
        if (!id)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const row = await this.templates.findByIdForTenant(tenant.tenantId, id);
        if (!row || row.tenantId !== tenant.tenantId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_not_found");
        }
        const connection = await this.requireConnectedWaba(tenant.tenantId, row.connectionId);
        let metaDeleted = false;
        if (row.metaTemplateId || row.name) {
            let token = "";
            try {
                token = this.decrypt(connection.accessTokenEncrypted);
            }
            catch {
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            }
            const result = await (0, meta_whatsapp_template_graph_client_1.deleteWabaMessageTemplate)({
                token,
                wabaId: String(connection.wabaId),
                name: row.name,
                metaTemplateId: row.metaTemplateId,
                graph: this.graph,
            });
            const missing = isGraphTemplateGone(result);
            if (!result.ok && !missing)
                throwFromGraph(result);
            metaDeleted = result.ok || missing;
        }
        const removed = await this.templates.deleteForTenant(tenant.tenantId, row.id);
        if (!removed)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_not_found");
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("DELETE", {
            tenantId: tenant.tenantId,
            connectionId: connection.id,
            metaDeleted,
        });
        return { deleted: true, metaDeleted };
    }
    async assertSendable(input) {
        const row = await this.templates.findForSend(input.tenantId, input.connectionId, input.name, input.language);
        if (!row || row.tenantId !== input.tenantId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_not_found");
        }
        if (!(0, meta_whatsapp_template_types_1.isTemplateApprovedForSend)(row.status)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_not_ready");
        }
        return row;
    }
    async readHeaderPreviewFromAuth(auth, templateId) {
        const tenant = requireTenant(auth);
        const id = String(templateId || "").trim();
        if (!id)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const row = await this.templates.findByIdForTenant(tenant.tenantId, id);
        if (!row || row.tenantId !== tenant.tenantId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_not_found");
        }
        const handle = (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(row.components);
        return (0, meta_whatsapp_template_header_preview_store_1.readTemplateHeaderPreviewForSend)({
            tenantId: tenant.tenantId,
            handle,
            templateId: id,
            metaTemplateId: row.metaTemplateId,
            name: row.name,
            language: row.language,
        });
    }
    async attachHeaderMediaFromAuth(auth, templateId, input) {
        const tenant = requireTenant(auth);
        const id = String(templateId || "").trim();
        const bytes = input.bytes;
        if (!id || !bytes?.length)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const row = await this.templates.findByIdForTenant(tenant.tenantId, id);
        if (!row || row.tenantId !== tenant.tenantId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_not_found");
        }
        const format = (0, meta_whatsapp_broadcast_template_1.inspectMetaBroadcastTemplate)(row.components).headerFormat;
        if (format !== "IMAGE" && format !== "VIDEO" && format !== "DOCUMENT") {
            const error = new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
            error.message = "Este template não tem mídia de cabeçalho.";
            throw error;
        }
        const mime = mimeForApprovedHeaderAttach(format, input.mime || "", input.fileName || "", bytes);
        if (!mime)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_upload_failed");
        (0, meta_whatsapp_template_header_preview_store_1.saveTemplateHeaderPreviewAliases)({
            tenantId: tenant.tenantId,
            mime,
            fileName: input.fileName,
            bytes,
            aliases: (0, meta_whatsapp_template_header_preview_store_1.templateHeaderPreviewKeys)({
                handle: (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(row.components),
                templateId: row.id,
                metaTemplateId: row.metaTemplateId,
                name: row.name,
                language: row.language,
            }),
        });
        const headerPreviewUrl = `/integrations/meta/whatsapp/templates/${encodeURIComponent(row.id)}/header`;
        return { headerReady: true, headerPreviewUrl };
    }
}
exports.MetaWhatsappTemplateService = MetaWhatsappTemplateService;
