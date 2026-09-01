import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { MetaWebhookNormalizedEvent } from "./meta-whatsapp-webhook-parser";
import { logMetaTemplate } from "./meta-whatsapp-template-log";
import { MetaWhatsappTemplateRepository } from "./meta-whatsapp-template.repository";
import { MetaWhatsappTemplateAiRepository } from "./meta-whatsapp-template-ai.repository";

export type MetaWhatsappWebhookTemplatePort = {
  applyStatus(input: {
    connection: MetaWhatsappConnectionRecord;
    event: MetaWebhookNormalizedEvent;
  }): Promise<void>;
};

export class MetaWhatsappWebhookTemplateService implements MetaWhatsappWebhookTemplatePort {
  constructor(
    private readonly templates = new MetaWhatsappTemplateRepository(),
    private readonly analyses = new MetaWhatsappTemplateAiRepository(),
  ) {}

  async applyStatus(input: {
    connection: MetaWhatsappConnectionRecord;
    event: MetaWebhookNormalizedEvent;
  }): Promise<void> {
    const status = String(input.event.status || "").trim();
    const wabaId = String(input.connection.wabaId || input.event.wabaId || "").trim();
    if (!status || !wabaId) return;
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
      try {
        await this.analyses.patchMetaOutcome({
          tenantId: input.connection.tenantId,
          templateId: updated.id,
          metaTemplateId: updated.metaTemplateId,
          metaStatus: updated.status,
          metaCategory: updated.category,
          rejectedReason: updated.rejectedReason,
        });
      } catch {
        logMetaTemplate("ERROR", {
          reason: "ai_outcome_patch_failed",
          tenantId: input.connection.tenantId,
        });
      }
    }
    logMetaTemplate("WEBHOOK", {
      tenantId: input.connection.tenantId,
      status,
      applied: Boolean(updated),
    });
  }
}
