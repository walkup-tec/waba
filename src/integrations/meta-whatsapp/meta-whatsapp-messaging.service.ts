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
import {
  extractTemplateBodyText,
  renderTemplateBodyText,
} from "./meta-whatsapp-inbox-template-preview";
import { resolveInboxSendPhoneNumberId } from "./meta-whatsapp-phone-identity.store";
import { readBotMedia } from "./bots/waba-bot-media.store";
import type { BotMediaKind } from "./bots/waba-bot.types";
import { botTypingDelayMs, waitBotTyping } from "./bots/waba-bot-typing";

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

    const conversationId = String(body?.conversationId || body?.conversation_id || "").trim();
    const existingConversation = conversationId
      ? await this.conversations.findByIdForTenant(tenantId, conversationId)
      : null;
    if (conversationId && !existingConversation) {
      throw new MetaWhatsappError("conversation_not_found");
    }
    const requestedConnection = String(body?.connectionId || body?.connection_id || "").trim();
    const requestedPhone = String(body?.phoneNumberId || body?.phone_number_id || "").trim();
    const preferredConnectionId = String(
      existingConversation?.connectionId || requestedConnection || "",
    ).trim();
    const preferredPhoneNumberId = String(
      existingConversation?.phoneNumberId || requestedPhone || "",
    ).trim();
    let connection;
    try {
      connection = await this.provider.requireConnected(
        tenantId,
        preferredConnectionId || undefined,
        preferredPhoneNumberId || undefined,
      );
    } catch (error) {
      const canFallbackToFirstConnected =
        Boolean(preferredConnectionId) &&
        !requestedConnection &&
        error instanceof MetaWhatsappError &&
        error.code === "not_connected";
      if (canFallbackToFirstConnected) {
        connection = await this.provider.requireConnected(tenantId);
      } else {
        throw error;
      }
    }
    const sendPhoneNumberId =
      !existingConversation && requestedPhone
        ? requestedPhone
        : resolveInboxSendPhoneNumberId({
            tenantId,
            connectionPhoneNumberId: connection.phoneNumberId,
            requestedPhoneNumberId: requestedPhone,
            conversationPhoneNumberId: existingConversation?.phoneNumberId,
            connections: [connection],
          }) || String(existingConversation?.phoneNumberId || connection.phoneNumberId || "").trim() || null;
    const botSend = body?.source === "bot";
    if (botSend) {
      await this.showBotTypingForTenant(tenantId, {
        conversationId: existingConversation?.id || conversationId,
        connectionId: preferredConnectionId || connection.id,
        phoneNumberId: sendPhoneNumberId || undefined,
        inboundWamid: String(body?.inboundWamid || body?.inbound_wamid || body?.message_id || "").trim(),
      });
      await waitBotTyping(
        botTypingDelayMs({
          type,
          text: String(body?.text || body?.caption || "").trim(),
        }),
      );
    }

    const atIso = new Date().toISOString();
    const isTemplateEarly = type === "template";
    const templateEarly = isTemplateEarly ? sanitizeTemplateFromBody(body?.template) : null;
    let templateBodyText = "";
    if (isTemplateEarly && templateEarly && typeof this.templates.findByNameForConnection === "function") {
      try {
        const stored = await this.templates.findByNameForConnection(
          tenantId,
          connection.id,
          templateEarly.name,
          templateEarly.language,
        );
        templateBodyText = renderTemplateBodyText({
          bodyText: extractTemplateBodyText(stored?.components),
          sendComponents: templateEarly.components,
        });
      } catch {
        templateBodyText = "";
      }
    }
    const upserted = await this.conversations.upsertForContact({
      tenantId,
      connectionId: connection.id,
      phoneNumberId: sendPhoneNumberId,
      contactWaId: recipient.waId,
      contactPhone: recipient.waId,
      outbound: true,
      lastMessagePreview: previewFromContent({
        text:
          type === "template"
            ? templateBodyText || null
            : type === "cta_url"
              ? String(body?.text || body?.buttonLabel || "Link").trim()
              : type === "video" || type === "document" || type === "audio"
                ? String(body?.caption || body?.text || `[${type}]`).trim()
                : String(body?.text || "").trim(),
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
    const isCta = type === "cta_url";
    const isMedia = type === "video" || type === "document" || type === "audio";
    const template = isTemplate ? sanitizeTemplateFromBody(body?.template) : null;
    const text = isTemplate ? null : String(body?.text || body?.caption || "").trim();
    if (!isTemplate && !isCta && !isMedia && !text) throw new MetaWhatsappError("invalid_payload");
    if (isTemplate && template) {
      await this.templates.assertSendable({
        tenantId,
        connectionId: connection.id,
        name: template.name,
        language: template.language,
      });
    }

    const persistType = isTemplate ? "template" : isCta ? "cta_url" : isMedia ? type : "text";
    const persistText =
      isTemplate
        ? templateBodyText || null
        : isCta
          ? `${String(body?.text || "").trim()} [${String(body?.buttonLabel || body?.button_label || "").trim()}]`.trim()
          : isMedia
            ? text || `[${type}]`
            : text;

    const inserted = await this.messages.insert({
      tenantId,
      conversationId: upserted.record.id,
      connectionId: connection.id,
      direction: "outbound",
      type: persistType,
      status: "queued",
      fromWaId: sendPhoneNumberId,
      toWaId: recipient.waId,
      textContent: persistText,
      templateName: template?.name || null,
      templateLanguage: template?.language || null,
      provider: botSend ? "automation" : "meta-cloud",
    });
    const localId = inserted.record?.id;
    if (!localId) throw new MetaWhatsappError("persist_failed");

    let send: WhatsAppSendResult;
    try {
      if (isTemplate) {
        send = await this.provider.sendTemplate({
          tenantId,
          to: recipient.waId,
          templateName: template!.name,
          language: template!.language,
          components: template!.components,
          connectionId: connection.id,
          phoneNumberId: sendPhoneNumberId || undefined,
        });
      } else if (isCta) {
        send = await this.provider.sendCtaUrl({
          tenantId,
          to: recipient.waId,
          text: String(body?.text || "").trim(),
          buttonLabel: String(body?.buttonLabel || body?.button_label || "").trim(),
          url: String(body?.url || "").trim(),
          connectionId: connection.id,
          phoneNumberId: sendPhoneNumberId || undefined,
        });
      } else if (isMedia) {
        const mediaKind: BotMediaKind =
          type === "document" ? "pdf" : type === "audio" ? "audio" : "video";
        const mediaRef = String(body?.mediaRef || body?.media_ref || "").trim();
        const stored = mediaRef ? readBotMedia(tenantId, mediaRef) : null;
        send = await this.provider.sendMedia({
          tenantId,
          to: recipient.waId,
          kind: stored?.mediaKind || mediaKind,
          link: String(body?.mediaUrl || body?.link || "").trim() || undefined,
          bytes: stored?.bytes,
          mime: stored?.mime || String(body?.mime || "").trim() || undefined,
          fileName: stored?.fileName || String(body?.fileName || body?.filename || "").trim() || undefined,
          caption: String(body?.caption || body?.text || "").trim() || undefined,
          voice: body?.voice === true || body?.voiceNote === true,
          connectionId: connection.id,
          phoneNumberId: sendPhoneNumberId || undefined,
        });
      } else {
        send = await this.provider.sendText({
          tenantId,
          to: recipient.waId,
          text: text!,
          connectionId: connection.id,
          phoneNumberId: sendPhoneNumberId || undefined,
        });
      }
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

  async showBotTypingForTenant(
    tenantId: string,
    input: {
      conversationId?: string;
      connectionId?: string;
      phoneNumberId?: string;
      inboundWamid?: string;
    },
  ): Promise<boolean> {
    const inboundWamid = await this.resolveInboundWamid(
      tenantId,
      String(input.conversationId || "").trim(),
      String(input.inboundWamid || "").trim(),
    );
    if (!inboundWamid) return false;
    try {
      await this.provider.sendTypingIndicator({
        tenantId,
        messageId: inboundWamid,
        connectionId: String(input.connectionId || "").trim() || undefined,
        phoneNumberId: String(input.phoneNumberId || "").trim() || undefined,
      });
      return true;
    } catch {
      logMetaWhatsappSafe("bot-typing-failed", { tenantId });
      return false;
    }
  }

  private async resolveInboundWamid(
    tenantId: string,
    conversationId: string,
    explicit?: string,
  ): Promise<string> {
    const direct = String(explicit || "").trim();
    if (direct) return direct;
    const id = String(conversationId || "").trim();
    if (!id) return "";
    try {
      const rows = await this.messages.listByConversation(tenantId, id, 30);
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const wamid = String(rows[i]?.wamid || "").trim();
        if (rows[i]?.direction === "inbound" && wamid) return wamid;
      }
    } catch {
      return "";
    }
    return "";
  }
}
