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
const meta_whatsapp_graph_client_1 = require("./meta-whatsapp-graph.client");
const meta_whatsapp_template_graph_client_1 = require("./meta-whatsapp-template-graph.client");
const meta_whatsapp_template_waba_ids_1 = require("./meta-whatsapp-template-waba-ids");
const meta_whatsapp_template_silent_block_button_1 = require("./meta-whatsapp-template-silent-block-button");
const meta_whatsapp_template_validate_1 = require("./meta-whatsapp-template-validate");
const meta_whatsapp_template_ai_approved_examples_1 = require("./meta-whatsapp-template-ai-approved-examples");
const meta_whatsapp_template_types_1 = require("./meta-whatsapp-template.types");
const meta_whatsapp_template_ai_repository_1 = require("./meta-whatsapp-template-ai.repository");
const meta_whatsapp_template_header_preview_store_1 = require("./meta-whatsapp-template-header-preview.store");
const meta_whatsapp_broadcast_template_1 = require("./meta-whatsapp-broadcast-template");
const meta_whatsapp_known_owned_wabas_1 = require("./meta-whatsapp-known-owned-wabas");
const meta_whatsapp_header_handle_cache_1 = require("./meta-whatsapp-header-handle-cache");
const meta_whatsapp_graph_cooldown_1 = require("./meta-whatsapp-graph-cooldown");
/** Traefik/EasyPanel devolve 502 HTML se o POST de sync passar de ~30s. */
const META_TEMPLATE_SYNC_BUDGET_MS = 20000;
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
    if ((0, meta_whatsapp_graph_errors_1.isMetaGraphRateLimitPayload)(result.json, result.graphCode)) {
        const error = new meta_whatsapp_errors_1.MetaWhatsappError("graph_rate_limited");
        error.message = (0, meta_whatsapp_graph_errors_1.publicMetaGraphTemplateMessage)(result.kind, result.status, result.json);
        throw error;
    }
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
    async findByWabaNameLanguage(tenantId, wabaId, name, language) {
        const row = await this.templates.findByWabaNameLanguage(tenantId, wabaId, name, language);
        if (!row || row.tenantId !== tenantId)
            return null;
        return row;
    }
    async listWabasFromAuth(auth, connectionId) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnectedWaba(tenant.tenantId, connectionId);
        let token = "";
        try {
            token = this.decrypt(connection.accessTokenEncrypted);
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        const graph = this.graph || meta_whatsapp_graph_client_1.callMetaGraphJson;
        const extraWabaIds = (0, meta_whatsapp_template_waba_ids_1.extraWabaIdsFromConnections)(await this.listOpenConnections(tenant.tenantId), connection);
        if ((0, meta_whatsapp_graph_cooldown_1.isMetaGraphUploadCooldown)()) {
            const ids = [
                String(connection.wabaId || "").trim(),
                ...(0, meta_whatsapp_known_owned_wabas_1.knownOwnedWabaIdsForBusiness)(String(connection.metaBusinessId || "")),
            ].filter(Boolean);
            return {
                connectionId: connection.id,
                wabas: [...new Set(ids)].map((id) => ({ id, name: `WABA ${id}` })),
            };
        }
        const discovered = await (0, meta_whatsapp_template_waba_ids_1.discoverTemplateWabas)({
            token,
            connection,
            extraWabaIds,
            graph,
        });
        const unique = new Map();
        for (const row of discovered) {
            const id = String((row && row.id) || "").trim();
            if (!id)
                continue;
            unique.set(id, String((row && row.name) || "").trim());
        }
        const wabas = [];
        for (const [id, listedName] of unique) {
            let name = listedName && listedName !== `WABA ${id}` ? listedName : "";
            if (!name) {
                const result = await graph({
                    token,
                    method: "GET",
                    path: id,
                    query: { fields: "id,name" },
                    maxAttempts: 1,
                    timeoutMs: 6000,
                });
                name = result.ok
                    ? String(result.json?.name || "").trim()
                    : "";
            }
            wabas.push({ id, name: name || `WABA ${id}` });
        }
        if (!wabas.length && connection.wabaId) {
            wabas.push({
                id: String(connection.wabaId),
                name: publicPortfolioName(connection),
            });
        }
        return { connectionId: connection.id, wabas };
    }
    async resolveCreateWabaId(connection, token, requestedRaw) {
        const primary = String(connection.wabaId || "").trim();
        const requested = String(requestedRaw || "").trim();
        if (!requested || requested === primary)
            return primary;
        const allowed = await (0, meta_whatsapp_template_waba_ids_1.discoverTemplateWabaIds)({
            token,
            connection,
            extraWabaIds: (0, meta_whatsapp_template_waba_ids_1.extraWabaIdsFromConnections)(await this.listOpenConnections(connection.tenantId), connection),
            graph: this.graph,
        });
        if (allowed.includes(requested))
            return requested;
        const error = new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        error.message =
            "Esta conta WABA não pertence ao portfólio selecionado. Escolha a WABA onde o template deve ser cadastrado.";
        throw error;
    }
    async listOpenConnections(tenantId) {
        const repo = this.connections;
        if (typeof repo.listOpenByTenant === "function") {
            return repo.listOpenByTenant(tenantId);
        }
        const one = await this.connections.findConnectedByTenant(tenantId);
        return one ? [one] : [];
    }
    async findReusableHeaderHandleForBytes(tenantId, bytes) {
        const id = String(tenantId || "").trim();
        if (!id || !bytes?.length || typeof this.templates.listByTenant !== "function") {
            return { resumable: "", any: "" };
        }
        try {
            const rows = await this.templates.listByTenant(id);
            return (0, meta_whatsapp_header_handle_cache_1.pickReusableHeaderHandle)({ tenantId: id, bytes, rows });
        }
        catch {
            return { resumable: "", any: "" };
        }
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
        const wabaId = await this.resolveCreateWabaId(connection, token, String(body?.wabaId || body?.waba_id || ""));
        const writers = (0, meta_whatsapp_template_waba_ids_1.pickTemplateWriteConnections)(await this.listOpenConnections(tenant.tenantId), connection, wabaId);
        let result = null;
        for (const writer of writers) {
            try {
                token = this.decrypt(writer.accessTokenEncrypted);
            }
            catch {
                continue;
            }
            if (!token)
                continue;
            result = await (0, meta_whatsapp_template_graph_client_1.createWabaMessageTemplate)({
                token,
                wabaId,
                body: graphBody,
                graph: this.graph,
            });
            if (result.ok)
                break;
            if (!(0, meta_whatsapp_graph_errors_1.isMetaGraphWabaWriteDenied)(result.json, result.status))
                break;
        }
        if (!result || !result.ok) {
            if (result && (0, meta_whatsapp_graph_errors_1.isMetaGraphWabaWriteDenied)(result.json, result.status)) {
                const wabaLabel = (0, meta_whatsapp_known_owned_wabas_1.knownWabaNameForId)(wabaId) || wabaId;
                const error = new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
                error.message =
                    `A Meta recusou o cadastro na ${wabaLabel}. O token desta conexão não gerencia essa WABA. ` +
                        "Clique em + no portfólio, conecte essa conta e envie de novo só nela. " +
                        "Os templates já aceitos nas outras WABAs não precisam ser reenviados.";
                throw error;
            }
            throwFromGraph(result || { status: 424, kind: "permanent", json: null, graphCode: null });
        }
        const now = new Date().toISOString();
        const row = await this.templates.upsertFromGraph({
            tenantId: tenant.tenantId,
            connectionId: connection.id,
            wabaId,
            metaTemplateId: result.json?.id ? String(result.json.id) : null,
            name: validated.name,
            language: validated.language,
            category: result.json?.category ? String(result.json.category) : validated.category,
            status: result.json?.status ? String(result.json.status) : "PENDING",
            components,
            lastSyncedAt: now,
            createdAt: now,
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
        if ((0, meta_whatsapp_graph_cooldown_1.isMetaGraphUploadCooldown)()) {
            const limited = new meta_whatsapp_errors_1.MetaWhatsappError("graph_rate_limited");
            limited.message = (0, meta_whatsapp_graph_cooldown_1.metaGraphUploadCooldownMessage)();
            throw limited;
        }
        let token = "";
        try {
            token = this.decrypt(connection.accessTokenEncrypted);
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        const listedByWaba = [];
        let pages = 0;
        const startedAt = Date.now();
        const primaryWabaId = String(connection.wabaId);
        const wabaIds = await (0, meta_whatsapp_template_waba_ids_1.discoverTemplateWabaIds)({
            token,
            connection,
            extraWabaIds: (0, meta_whatsapp_template_waba_ids_1.extraWabaIdsFromConnections)(await this.listOpenConnections(tenant.tenantId), connection),
            graph: this.graph,
        });
        const targets = wabaIds.length ? wabaIds : [primaryWabaId];
        for (const wabaId of targets) {
            const elapsed = Date.now() - startedAt;
            if (elapsed >= META_TEMPLATE_SYNC_BUDGET_MS) {
                if (!listedByWaba.length) {
                    const error = new meta_whatsapp_errors_1.MetaWhatsappError("send_failed", 503);
                    error.message =
                        "A Meta demorou demais para listar os templates. Tente de novo em instantes.";
                    throw error;
                }
                (0, meta_whatsapp_template_log_1.logMetaTemplate)("SYNC", {
                    reason: "skip_sync_budget",
                    tenantId: tenant.tenantId,
                    wabaId,
                    elapsedMs: elapsed,
                    listed: listedByWaba.length,
                });
                break;
            }
            const listed = await (0, meta_whatsapp_template_graph_client_1.listWabaMessageTemplates)({
                token,
                wabaId,
                graph: this.graph,
                maxAttempts: 1,
                timeoutMs: Math.min(8000, Math.max(2000, META_TEMPLATE_SYNC_BUDGET_MS - elapsed)),
            });
            if (!listed.ok) {
                if (wabaId === primaryWabaId)
                    throwFromGraph(listed.result);
                (0, meta_whatsapp_template_log_1.logMetaTemplate)("SYNC", {
                    reason: "skip_extra_waba",
                    tenantId: tenant.tenantId,
                    wabaId,
                    status: listed.result.status,
                });
                continue;
            }
            pages += listed.pages;
            listedByWaba.push({ wabaId, items: listed.items, pages: listed.pages, complete: listed.complete });
        }
        if (!listedByWaba.length) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("send_failed", 424);
        }
        const now = new Date().toISOString();
        const upserted = [];
        const keepMetaIds = new Set();
        const keepNameLang = new Set();
        const completedWabas = new Set();
        for (const listed of listedByWaba) {
            if (listed.complete)
                completedWabas.add(listed.wabaId);
            for (const item of listed.items) {
                if (!item)
                    continue;
                keepMetaIds.add(String(item.metaTemplateId || "").trim());
                keepNameLang.add(`${listed.wabaId}::${item.name}::${item.language}`);
                const previous = (item.metaTemplateId
                    ? await this.templates.findByMetaId(tenant.tenantId, item.metaTemplateId)
                    : null) ||
                    (await this.templates.findByWabaNameLanguage(tenant.tenantId, listed.wabaId, item.name, item.language));
                const oldHandle = previous ? (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(previous.components) : "";
                const saved = await this.templates.upsertFromGraph({
                    tenantId: tenant.tenantId,
                    connectionId: connection.id,
                    wabaId: listed.wabaId,
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
        }
        let removed = 0;
        if (completedWabas.size) {
            const locals = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
            for (const row of locals) {
                if (!completedWabas.has(row.wabaId))
                    continue;
                const keepById = Boolean(row.metaTemplateId && keepMetaIds.has(row.metaTemplateId));
                const keepByName = keepNameLang.has(`${row.wabaId}::${row.name}::${row.language}`);
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
                pages,
            });
        }
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("SYNC", {
            tenantId: tenant.tenantId,
            pages,
            upserted: upserted.length,
            removed,
            wabaCount: listedByWaba.length,
            complete: completedWabas.size === listedByWaba.length,
        });
        const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
        return {
            templates: rows.map((row) => (0, meta_whatsapp_template_types_1.toPublicTemplate)(row, publicPortfolioName(connection))),
            pages,
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
                wabaId: String(row.wabaId || connection.wabaId),
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
