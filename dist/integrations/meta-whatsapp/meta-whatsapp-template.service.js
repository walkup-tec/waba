"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappTemplateService = void 0;
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_token_crypto_1 = require("./meta-token-crypto");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_graph_errors_1 = require("./meta-whatsapp-graph-errors");
const meta_whatsapp_template_log_1 = require("./meta-whatsapp-template-log");
const meta_whatsapp_template_repository_1 = require("./meta-whatsapp-template.repository");
const meta_whatsapp_template_graph_client_1 = require("./meta-whatsapp-template-graph.client");
const meta_whatsapp_template_validate_1 = require("./meta-whatsapp-template-validate");
const meta_whatsapp_template_types_1 = require("./meta-whatsapp-template.types");
function requireTenant(auth) {
    try {
        return (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("unauthenticated");
    }
}
function throwFromGraph(result) {
    (0, meta_whatsapp_template_log_1.logMetaTemplate)("ERROR", { status: result.status, kind: result.kind, timeout: result.timeout === true });
    if (result.status === 401)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
    if (result.status === 400) {
        const error = new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        error.message = (0, meta_whatsapp_graph_errors_1.publicMetaGraphTemplateMessage)(result.kind, result.status);
        throw error;
    }
    const status = result.timeout || result.status === 429 || result.status >= 500 || result.status === 0 ? 503 : 424;
    const error = new meta_whatsapp_errors_1.MetaWhatsappError("send_failed", status);
    error.message = (0, meta_whatsapp_graph_errors_1.publicMetaGraphTemplateMessage)(result.kind, result.status);
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
class MetaWhatsappTemplateService {
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), templates = new meta_whatsapp_template_repository_1.MetaWhatsappTemplateRepository(), graph = undefined, decrypt = meta_token_crypto_1.decryptMetaToken) {
        this.connections = connections;
        this.templates = templates;
        this.graph = graph;
        this.decrypt = decrypt;
    }
    async requireConnectedWaba(tenantId) {
        const row = await this.connections.findConnectedByTenant(tenantId);
        if (!row || row.status !== "connected" || !row.wabaId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        if (row.tenantId !== tenantId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        return row;
    }
    async listFromAuth(auth) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnectedWaba(tenant.tenantId);
        const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("LIST", { tenantId: tenant.tenantId, count: rows.length });
        return rows.map(meta_whatsapp_template_types_1.toPublicTemplate);
    }
    async createFromAuth(auth, body) {
        const tenant = requireTenant(auth);
        warnIgnored(body, tenant.tenantId);
        const connection = await this.requireConnectedWaba(tenant.tenantId);
        const validated = (0, meta_whatsapp_template_validate_1.validateTemplateCreate)(body);
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
            components: validated.components,
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
            components: validated.components,
            lastSyncedAt: now,
        });
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("CREATE", {
            tenantId: tenant.tenantId,
            name: validated.name,
            language: validated.language,
            status: row.status,
        });
        return (0, meta_whatsapp_template_types_1.toPublicTemplate)(row);
    }
    async syncFromAuth(auth) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnectedWaba(tenant.tenantId);
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
            upserted.push(await this.templates.upsertFromGraph({
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
            }));
        }
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("SYNC", {
            tenantId: tenant.tenantId,
            pages: listed.pages,
            upserted: upserted.length,
        });
        const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
        return { templates: rows.map(meta_whatsapp_template_types_1.toPublicTemplate), pages: listed.pages };
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
}
exports.MetaWhatsappTemplateService = MetaWhatsappTemplateService;
