import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { MetaCloudProvider } from "../whatsapp/meta-cloud-provider";
import { MetaWhatsappConversationRepository } from "./meta-whatsapp-conversation.repository";
import { MetaWhatsappMessageRepository } from "./meta-whatsapp-message.repository";
import {
  logMetaWhatsappSafe,
  MetaWhatsappError,
} from "./meta-whatsapp-errors";
import { emitMetaInboxEvent } from "./meta-whatsapp-inbox-events";
import { resolveCustomerCareWindow } from "./meta-whatsapp-customer-care-window";
import {
  normalizeCloudApiRecipient,
  normalizeTemplateLanguage,
} from "./meta-whatsapp-recipient";
import type { WhatsAppSendResult, WhatsAppTemplateComponent } from "../whatsapp/whatsapp-provider";
import { MetaWhatsappTemplateService } from "./meta-whatsapp-template.service";
import { previewFromContent } from "./meta-whatsapp-inbox.types";
import { resolveInboxSendPhoneNumberId } from "./meta-whatsapp-phone-identity.store";

export type MetaSendPublicResult = WhatsAppSendResult & {
  conversationId: string;
  customerCareWindow: {
    known: boolean;
    withinWindow: boolean | null;
  };
};

function requireTenant(auth: WabaRequestAuth) {
  try {
    return resolveMetaWhatsappTenant(auth);
  } catch {
    throw new MetaWhatsappError("unauthenticated");
  }
}

function warnIgnoredClientClaims(body: Record<string, unknown> | undefined, tenantId: string): void {
  if (
    body?.tenant_id ||
    body?.tenantId ||
    body?.owner_email ||
    body?.ownerEmail ||
    body?.access_token ||
    body?.accessToken
  ) {
    logMetaWhatsappSafe("ignored-client-send-claims", { tenantId });
  }
}

function sanitizeTemplateFromBody(value: unknown): {
  name: string;
  language: string;
  components: WhatsAppTemplateComponent[];
} {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const name = String(row.name || "").trim();
  const language = normalizeTemplateLanguage(row.language);
  if (!name || !language) throw new MetaWhatsappError("invalid_payload");
  const components = Array.isArray(row.components) ? (row.components as WhatsAppTemplateComponent[]) : [];
  return { name, language, components };
}

export class MetaWhatsappMessagingService {
  constructor(
    private readonly provider = new MetaCloudProvider(),
    private readonly conversations = new MetaWhatsappConversationRepository(),
    private readonly messages = new MetaWhatsappMessageRepository(),
    private readonly templates = new MetaWhatsappTemplateService(),
  ) {}

  async sendFromAuth(
    auth: WabaRequestAuth,
    body: Record<string, unknown> | undefined,
  ): Promise<MetaSendPublicResult> {
    const tenant = requireTenant(auth);
    warnIgnoredClientClaims(body, tenant.tenantId);
    const cleaned = { ...(body || {}) };
    delete cleaned.source;
    return this.sendForTenant(tenant.tenantId, cleaned);
  }

  async sendForTenant(
    tenantId: string,
    body: Record<string, unknown> | undefined,
  ): Promise<MetaSendPublicResult> {
    const type = String(body?.type || "text").trim().toLowerCase();
    const toRaw = String(body?.to || "").trim();
    const recipient = normalizeCloudApiRecipient(toRaw);
    if (!recipient.ok) throw new MetaWhatsappError("invalid_recipient");

    const clientConnectionId = String(body?.connectionId || body?.connection_id || "").trim();
    const connection = await this.provider.requireConnected(
      tenantId,
      clientConnectionId || undefined,
    );

    const conversationId = String(body?.conversationId || body?.conversation_id || "").trim();
    const existingConversation = conversationId
      ? await this.conversations.findByIdForTenant(tenantId, conversationId)
      : null;
    if (conversationId && (!existingConversation || existingConversation.connectionId !== connection.id)) {
      throw new MetaWhatsappError("conversation_not_found");
    }
    const requestedPhone = String(body?.phoneNumberId || body?.phone_number_id || "").trim();
    const sendPhoneNumberId =
      resolveInboxSendPhoneNumberId({
        tenantId,
        connectionPhoneNumberId: connection.phoneNumberId,
        requestedPhoneNumberId: requestedPhone,
        conversationPhoneNumberId: existingConversation?.phoneNumberId,
      }) || String(existingConversation?.phoneNumberId || connection.phoneNumberId || "").trim() || null;
    const botSend = body?.source === "bot";

    const atIso = new Date().toISOString();
    const upserted = await this.conversations.upsertForContact({
      tenantId,
      connectionId: connection.id,
      phoneNumberId: sendPhoneNumberId,
      contactWaId: recipient.waId,
      contactPhone: recipient.waId,
      outbound: true,
      lastMessagePreview: previewFromContent({
        text: type === "template" ? null : String(body?.text || "").trim(),
        type,
        templateName: type === "template" ? sanitizeTemplateFromBody(body?.template).name : null,
      }),
      atIso,
    });
    await emitMetaInboxEvent({
      name: upserted.created ? "conversation_created" : "conversation_updated",
      tenantId,
      conversationId: upserted.record.id,
      connectionId: connection.id,
      occurredAt: atIso,
    });

    const isTemplate = type === "template";
    const template = isTemplate ? sanitizeTemplateFromBody(body?.template) : null;
    const text = isTemplate ? null : String(body?.text || "").trim();
    if (!isTemplate && !text) throw new MetaWhatsappError("invalid_payload");
    if (isTemplate && template) {
      await this.templates.assertSendable({
        tenantId,
        connectionId: connection.id,
        name: template.name,
        language: template.language,
      });
    }

    const inserted = await this.messages.insert({
      tenantId,
      conversationId: upserted.record.id,
      connectionId: connection.id,
      direction: "outbound",
      type: isTemplate ? "template" : "text",
      status: "queued",
      fromWaId: sendPhoneNumberId,
      toWaId: recipient.waId,
      textContent: text,
      templateName: template?.name || null,
      templateLanguage: template?.language || null,
      provider: botSend ? "automation" : "meta-cloud",
    });
    const localId = inserted.record?.id;
    if (!localId) throw new MetaWhatsappError("persist_failed");

    let send: WhatsAppSendResult;
    try {
      send = isTemplate
        ? await this.provider.sendTemplate({
            tenantId,
            to: recipient.waId,
            templateName: template!.name,
            language: template!.language,
            components: template!.components,
            connectionId: connection.id,
            phoneNumberId: sendPhoneNumberId || undefined,
          })
        : await this.provider.sendText({
            tenantId,
            to: recipient.waId,
            text: text!,
            connectionId: connection.id,
            phoneNumberId: sendPhoneNumberId || undefined,
          });
    } catch (error) {
      await this.messages.updateAfterGraph(tenantId, localId, {
        status: "failed",
        errorCode: "send_failed",
        errorMessage: error instanceof Error ? error.message.slice(0, 180) : "send_failed",
      });
      throw error;
    }

    await this.messages.updateAfterGraph(tenantId, localId, {
      wamid: send.messageId,
      status: "accepted",
    });
    await emitMetaInboxEvent({
      name: "outbound_message",
      tenantId,
      conversationId: upserted.record.id,
      messageId: localId,
      connectionId: connection.id,
      occurredAt: atIso,
    });

    const window = resolveCustomerCareWindow({ lastInboundAt: upserted.record.lastInboundAt });
    logMetaWhatsappSafe("message-sent", {
      tenantId,
      connectionId: connection.id,
      type: isTemplate ? "template" : "text",
      hasWamid: Boolean(send.messageId),
    });
    return {
      ...send,
      conversationId: upserted.record.id,
      customerCareWindow: {
        known: window.known,
        withinWindow: window.withinWindow,
      },
    };
  }
}
