"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappWebhookTemplateService = void 0;
const meta_whatsapp_template_log_1 = require("./meta-whatsapp-template-log");
const meta_whatsapp_template_approved_at_store_1 = require("./meta-whatsapp-template-approved-at.store");
const meta_whatsapp_template_repository_1 = require("./meta-whatsapp-template.repository");
const meta_whatsapp_template_ai_repository_1 = require("./meta-whatsapp-template-ai.repository");
class MetaWhatsappWebhookTemplateService {
    constructor(templates = new meta_whatsapp_template_repository_1.MetaWhatsappTemplateRepository(), analyses = new meta_whatsapp_template_ai_repository_1.MetaWhatsappTemplateAiRepository()) {
        this.templates = templates;
        this.analyses = analyses;
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
        if (updated) {
            (0, meta_whatsapp_template_approved_at_store_1.rememberTemplateApprovedAt)({
                tenantId: updated.tenantId,
                templateId: updated.id,
                metaTemplateId: updated.metaTemplateId,
                wabaId,
                name: updated.name,
                language: updated.language,
                status,
            }, updated.lastSyncedAt || updated.updatedAt);
            try {
                await this.analyses.patchMetaOutcome({
                    tenantId: input.connection.tenantId,
                    templateId: updated.id,
                    metaTemplateId: updated.metaTemplateId,
                    metaStatus: updated.status,
                    metaCategory: updated.category,
                    rejectedReason: updated.rejectedReason,
                });
            }
            catch {
                (0, meta_whatsapp_template_log_1.logMetaTemplate)("ERROR", {
                    reason: "ai_outcome_patch_failed",
                    tenantId: input.connection.tenantId,
                });
            }
        }
        (0, meta_whatsapp_template_log_1.logMetaTemplate)("WEBHOOK", {
            tenantId: input.connection.tenantId,
            status,
            applied: Boolean(updated),
        });
    }
}
exports.MetaWhatsappWebhookTemplateService = MetaWhatsappWebhookTemplateService;
