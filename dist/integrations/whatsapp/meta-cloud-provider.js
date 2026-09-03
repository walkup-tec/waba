"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaCloudProvider = void 0;
const meta_whatsapp_connection_repository_1 = require("../meta-whatsapp/meta-whatsapp-connection.repository");
const meta_token_crypto_1 = require("../meta-whatsapp/meta-token-crypto");
const meta_whatsapp_graph_messages_client_1 = require("../meta-whatsapp/meta-whatsapp-graph-messages.client");
const meta_whatsapp_errors_1 = require("../meta-whatsapp/meta-whatsapp-errors");
const meta_whatsapp_graph_errors_1 = require("../meta-whatsapp/meta-whatsapp-graph-errors");
const meta_whatsapp_recipient_1 = require("../meta-whatsapp/meta-whatsapp-recipient");
function sanitizeTemplateComponents(input) {
    if (!Array.isArray(input))
        return [];
    return input.slice(0, 20).map((item) => {
        const row = item && typeof item === "object" ? item : { type: "body" };
        const out = {
            type: String(row.type || "body").trim() || "body",
        };
        if (Array.isArray(row.parameters))
            out.parameters = row.parameters.slice(0, 20);
        if (row.sub_type)
            out.sub_type = String(row.sub_type).slice(0, 40);
        if (row.index !== undefined)
            out.index = row.index;
        return out;
    });
}
class MetaCloudProvider {
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), graph = (input) => (0, meta_whatsapp_graph_messages_client_1.postMetaCloudMessage)(input), decrypt = meta_token_crypto_1.decryptMetaToken) {
        this.connections = connections;
        this.graph = graph;
        this.decrypt = decrypt;
        this.name = "meta-cloud";
    }
    async sendText(input) {
        const text = String(input.text || "").trim();
        if (!text)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        if (text.length > 4096)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const recipient = (0, meta_whatsapp_recipient_1.normalizeCloudApiRecipient)(input.to);
        if (!recipient.ok)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_recipient");
        const connection = await this.requireConnected(input.tenantId, input.connectionId, input.phoneNumberId);
        return this.dispatch(connection, {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient.waId,
            type: "text",
            text: { preview_url: false, body: text },
        }, input.phoneNumberId);
    }
    async sendTemplate(input) {
        const name = String(input.templateName || "").trim();
        const language = (0, meta_whatsapp_recipient_1.normalizeTemplateLanguage)(input.language);
        if (!name || !language)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const recipient = (0, meta_whatsapp_recipient_1.normalizeCloudApiRecipient)(input.to);
        if (!recipient.ok)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_recipient");
        const connection = await this.requireConnected(input.tenantId, input.connectionId, input.phoneNumberId);
        const template = {
            name,
            language: { code: language },
        };
        const components = sanitizeTemplateComponents(input.components);
        if (components.length)
            template.components = components;
        return this.dispatch(connection, {
            messaging_product: "whatsapp",
            to: recipient.waId,
            type: "template",
            template,
        }, input.phoneNumberId);
    }
    async requireConnected(tenantId, connectionId, phoneNumberId) {
        let row = null;
        const phone = String(phoneNumberId || "").trim();
        if (phone) {
            row = await this.connections.findConnectedByPhoneNumberId(phone);
            const usableByPhone = Boolean(row) &&
                row.tenantId === tenantId &&
                !row.disconnectedAt &&
                (row.status === "connected" || row.status === "pending_confirmation");
            if (usableByPhone && row)
                return row;
            row = null;
        }
        if (connectionId) {
            row = await this.connections.findByIdForTenant(tenantId, connectionId);
            const usable = Boolean(row) &&
                row.tenantId === tenantId &&
                !row.disconnectedAt &&
                Boolean(row.phoneNumberId) &&
                (row.status === "connected" || row.status === "pending_confirmation");
            if (!usable || !row)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
            return row;
        }
        row = await this.connections.findConnectedByTenant(tenantId);
        if (!row || row.status !== "connected" || !row.phoneNumberId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        if (row.tenantId !== tenantId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        return row;
    }
    async dispatch(connection, body, phoneNumberId) {
        let token = "";
        try {
            token = this.decrypt(connection.accessTokenEncrypted);
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        const sendPhone = String(phoneNumberId || connection.phoneNumberId || "").trim();
        if (!sendPhone)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        const result = await this.graph({
            token,
            phoneNumberId: sendPhone,
            body,
        });
        if (!result.ok) {
            if (result.status === 401)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            const error = new meta_whatsapp_errors_1.MetaWhatsappError("send_failed");
            error.graphStatus = result.status;
            error.graphKind = result.kind;
            error.graphCode = result.graphCode;
            const detail = (0, meta_whatsapp_graph_errors_1.safePublicGraphTemplateDetail)(result.json);
            error.message = detail || (0, meta_whatsapp_graph_errors_1.publicMetaGraphSendMessage)(result.kind, result.status);
            throw error;
        }
        return {
            provider: this.name,
            messageId: result.wamid,
            status: "accepted",
            connectionId: connection.id,
            phoneNumberId: sendPhone,
        };
    }
}
exports.MetaCloudProvider = MetaCloudProvider;
