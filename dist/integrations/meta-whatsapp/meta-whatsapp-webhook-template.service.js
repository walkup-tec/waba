"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappWebhookTemplateService = void 0;
const meta_whatsapp_template_log_1 = require("./meta-whatsapp-template-log");
const meta_whatsapp_template_repository_1 = require("./meta-whatsapp-template.repository");
class MetaWhatsappWebhookTemplateService {
    constructor(templates = new meta_whatsapp_template_repository_1.MetaWhatsappTemplateRepository()) {
        this.templates = templates;
    }
    async applyStatus(input) {
        const status = String(input.event.status || "").trim();
        const wabaId = String(input.connection.wabaId || input.event.wabaId || "").trim();
        if (!status || !wabaId)
            return;
        const updated = await this.templates.patchStatus({
            tenantId: input.connection.tenantId,
            wabaId,
            metaTemplateId: input.event.messageId,
            name: input.event.templateName,
            language: input.event.templateLanguage,
            status,
            rejectedReason: input.event.rejectedReason,
            atIso: new Date().toISOString(),
        });
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("WEBHOOK", {
            tenantId: input.connection.tenantId,
            status,
            applied: Boolean(updated),
        });
    }
}
exports.MetaWhatsappWebhookTemplateService = MetaWhatsappWebhookTemplateService;
