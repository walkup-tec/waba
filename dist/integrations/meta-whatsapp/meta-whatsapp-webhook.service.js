"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappWebhookService = void 0;
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_webhook_parser_1 = require("./meta-whatsapp-webhook-parser");
const meta_whatsapp_webhook_events_repository_1 = require("./meta-whatsapp-webhook-events.repository");
const meta_whatsapp_webhook_log_1 = require("./meta-whatsapp-webhook-log");
const meta_whatsapp_webhook_signature_1 = require("./meta-whatsapp-webhook-signature");
const meta_config_1 = require("./meta-config");
const meta_whatsapp_phone_identity_store_1 = require("./meta-whatsapp-phone-identity.store");
const NOOP_INBOX = {
    persistInbound: async () => undefined,
    applyStatus: async () => undefined,
};
const NOOP_TEMPLATES = {
    applyStatus: async () => undefined,
};
class MetaWhatsappWebhookService {
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), events = new meta_whatsapp_webhook_events_repository_1.MetaWhatsappWebhookEventsRepository(), inbox = NOOP_INBOX, templates = NOOP_TEMPLATES) {
        this.connections = connections;
        this.events = events;
        this.inbox = inbox;
        this.templates = templates;
    }
    verifySubscription(query) {
        const mode = String(query["hub.mode"] || "").trim();
        const token = String(query["hub.verify_token"] || "");
        const challenge = String(query["hub.challenge"] || "");
        const expected = (0, meta_config_1.readMetaWebhookVerifyToken)();
        (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("VERIFY", { mode, hasChallenge: Boolean(challenge) });
        if (mode !== "subscribe" || !expected || !(0, meta_whatsapp_webhook_signature_1.timingSafeEqualString)(token, expected)) {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", { reason: "verify_token_mismatch" });
            return { ok: false };
        }
        return { ok: true, challenge };
    }
    async processPostedEvent(input) {
        const appSecret = (0, meta_config_1.readMetaAppSecret)();
        const rawBody = input.rawBody;
        if (!rawBody || !Buffer.isBuffer(rawBody) || !rawBody.length) {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("SIGNATURE", { valid: false, reason: "missing_raw_body" });
            return { httpStatus: 403, accepted: false, reason: "missing_raw_body" };
        }
        const valid = (0, meta_whatsapp_webhook_signature_1.isValidMetaHubSignature)({
            appSecret,
            rawBody,
            header: input.signatureHeader,
        });
        (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("SIGNATURE", { valid, bytes: rawBody.length });
        if (!valid) {
            return { httpStatus: 403, accepted: false, reason: "invalid_signature" };
        }
        const payloadHash = (0, meta_whatsapp_webhook_parser_1.hashRawPayload)(rawBody);
        let payload = input.parsedBody;
        try {
            payload = JSON.parse(rawBody.toString("utf8"));
        }
        catch {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", { reason: "malformed_json", payloadHash: payloadHash.slice(0, 12) });
            return { httpStatus: 200, accepted: true, reason: "malformed_json" };
        }
        const events = (0, meta_whatsapp_webhook_parser_1.parseMetaWebhookPayload)(payload, payloadHash);
        (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("RECEIVED", {
            eventCount: events.length,
            payloadHash: payloadHash.slice(0, 12),
        });
        for (const event of events) {
            try {
                await this.processOne(event, payloadHash);
            }
            catch {
                (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", {
                    reason: "process_failed",
                    eventType: event.eventType,
                    eventKey: event.eventKey.slice(0, 80),
                });
            }
        }
        return { httpStatus: 200, accepted: true };
    }
    async resolveConnection(event) {
        if (event.phoneNumberId) {
            const byPhone = await this.connections.findConnectedByPhoneNumberId(event.phoneNumberId);
            if (byPhone)
                return byPhone;
        }
        if (event.wabaId) {
            return this.connections.findConnectedByWabaId(event.wabaId);
        }
        return null;
    }
    async processOne(event, payloadHash) {
        const connection = await this.resolveConnection(event);
        const tenantId = connection?.tenantId || null;
        const insert = await this.events.insertIfNew({
            eventKey: event.eventKey,
            tenantId,
            wabaId: event.wabaId || connection?.wabaId || null,
            phoneNumberId: event.phoneNumberId || connection?.phoneNumberId || null,
            eventType: event.eventType,
            payloadHash,
            status: connection ? "processed" : "unmatched_tenant",
        });
        if (insert.duplicate) {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("DUPLICATE", { eventType: event.eventType });
            return;
        }
        if (!connection) {
            (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("PROCESSED", { eventType: event.eventType, unmatched: true });
            return;
        }
        const at = new Date().toISOString();
        await this.connections.touchLastWebhookAt(connection.tenantId, connection.id, at);
        if (event.eventType === "phone_number_quality_update" || event.eventType === "phone_number_name_update") {
            await this.connections.patchConfirmedMetadata(connection.tenantId, connection.id, {
                qualityRating: event.qualityRating,
                verifiedName: event.verifiedName,
            });
            if (event.eventType === "phone_number_name_update" && event.phoneNumberId && event.verifiedName) {
                (0, meta_whatsapp_phone_identity_store_1.syncInboxChannelNameFromMeta)(connection.tenantId, event.phoneNumberId, event.verifiedName);
            }
        }
        if (event.eventType === "messages") {
            try {
                await this.inbox.persistInbound({ connection, event });
            }
            catch {
                (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", { reason: "inbox_inbound_failed", eventType: event.eventType });
            }
        }
        if (event.eventType === "statuses") {
            try {
                await this.inbox.applyStatus({ connection, event });
            }
            catch {
                (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", { reason: "inbox_status_failed", eventType: event.eventType });
            }
        }
        if (event.eventType === "message_template_status_update") {
            try {
                await this.templates.applyStatus({ connection, event });
            }
            catch {
                (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("ERROR", { reason: "template_status_failed", eventType: event.eventType });
            }
        }
        (0, meta_whatsapp_webhook_log_1.logMetaWebhook)("PROCESSED", {
            eventType: event.eventType,
            tenantId: connection.tenantId,
            messageId: event.messageId,
            status: event.status,
            messageType: event.messageType,
        });
    }
}
exports.MetaWhatsappWebhookService = MetaWhatsappWebhookService;
