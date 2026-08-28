import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { MetaWebhookNormalizedEvent } from "./meta-whatsapp-webhook-parser";
import { MetaWhatsappConversationRepository } from "./meta-whatsapp-conversation.repository";
import { MetaWhatsappMessageRepository } from "./meta-whatsapp-message.repository";
import { emitMetaInboxEvent } from "./meta-whatsapp-inbox-events";
import { previewFromContent } from "./meta-whatsapp-inbox.types";
import { mapWebhookStatus } from "./meta-whatsapp-messaging.types";
import { logMetaWebhook } from "./meta-whatsapp-webhook-log";
import { listEnabledInboxPhoneIds } from "./meta-whatsapp-phone-identity.store";

export type MetaWhatsappWebhookInboxPort = {
  persistInbound(input: {
    connection: MetaWhatsappConnectionRecord;
    event: MetaWebhookNormalizedEvent;
  }): Promise<void>;
  applyStatus(input: {
    connection: MetaWhatsappConnectionRecord;
    event: MetaWebhookNormalizedEvent;
  }): Promise<void>;
};

function isoFromUnix(value: string | null): string {
  const n = Number(value || "");
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString();
  return new Date().toISOString();
}

export class MetaWhatsappWebhookInboxService implements MetaWhatsappWebhookInboxPort {
  constructor(
    private readonly conversations = new MetaWhatsappConversationRepository(),
    private readonly messages = new MetaWhatsappMessageRepository(),
  ) {}

  async persistInbound(input: {
    connection: MetaWhatsappConnectionRecord;
    event: MetaWebhookNormalizedEvent;
  }): Promise<void> {
    const from = String(input.event.fromWaId || "").trim();
    const wamid = String(input.event.messageId || "").trim();
    if (!from || !wamid) return;
    const phoneNumberId = String(input.event.phoneNumberId || input.connection.phoneNumberId || "").trim() || null;
    if (!phoneNumberId || !listEnabledInboxPhoneIds(input.connection.tenantId).includes(phoneNumberId)) {
      logMetaWebhook("PROCESSED", { eventType: "messages", reason: "inbox_disabled" });
      return;
    }
    const already = await this.messages.findByTenantWamid(input.connection.tenantId, wamid);
    if (already) {
      logMetaWebhook("DUPLICATE", { eventType: "messages", reason: "wamid" });
      return;
    }
    const atIso = isoFromUnix(input.event.timestamp);
    const type = String(input.event.messageType || "unknown");
    const textContent = type === "text" ? input.event.textContent : null;
    const upserted = await this.conversations.upsertForContact({
      tenantId: input.connection.tenantId,
      connectionId: input.connection.id,
      phoneNumberId,
      contactWaId: from,
      contactPhone: from,
      contactName: input.event.contactName,
      inbound: true,
      lastMessagePreview: previewFromContent({ text: textContent, type }),
      atIso,
    });
    await emitMetaInboxEvent({
      name: upserted.created ? "conversation_created" : "conversation_updated",
      tenantId: input.connection.tenantId,
      conversationId: upserted.record.id,
      connectionId: input.connection.id,
      occurredAt: atIso,
    });
    const inserted = await this.messages.insert({
      tenantId: input.connection.tenantId,
      conversationId: upserted.record.id,
      connectionId: input.connection.id,
      wamid,
      direction: "inbound",
      type,
      status: "accepted",
      fromWaId: from,
      toWaId: phoneNumberId,
      textContent,
      provider: "meta-cloud",
    });
    if (inserted.duplicate) {
      logMetaWebhook("DUPLICATE", { eventType: "messages", reason: "wamid" });
      return;
    }
    await emitMetaInboxEvent({
      name: "inbound_message",
      tenantId: input.connection.tenantId,
      conversationId: upserted.record.id,
      messageId: inserted.record?.id,
      connectionId: input.connection.id,
      occurredAt: atIso,
    });
  }

  async applyStatus(input: {
    connection: MetaWhatsappConnectionRecord;
    event: MetaWebhookNormalizedEvent;
  }): Promise<void> {
    const wamid = String(input.event.messageId || "").trim();
    const next = mapWebhookStatus(input.event.status);
    if (!wamid || !next) return;
    const atIso = isoFromUnix(input.event.timestamp);
    const applied = await this.messages.applyWebhookStatus(
      input.connection.tenantId,
      wamid,
      next,
      atIso,
      { code: input.event.errorCode, message: null },
    );
    if (applied.record) return;
    const recipient = String(input.event.recipientId || "").trim();
    const phoneNumberId = String(input.event.phoneNumberId || input.connection.phoneNumberId || "").trim();
    if (!recipient || !phoneNumberId) return;
    if (!listEnabledInboxPhoneIds(input.connection.tenantId).includes(phoneNumberId)) {
      return;
    }
    await this.conversations.upsertForContact({
      tenantId: input.connection.tenantId,
      connectionId: input.connection.id,
      phoneNumberId,
      contactWaId: recipient,
      contactPhone: recipient,
      outbound: true,
      lastMessagePreview: previewFromContent({ type: "text", text: "Mensagem enviada" }),
      atIso,
    });
  }
}
