import { createHash } from "node:crypto";

export type MetaWebhookNormalizedEvent = {
  eventKey: string;
  eventType: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  messageId: string | null;
  status: string | null;
  timestamp: string | null;
  recipientId: string | null;
  conversationId: string | null;
  pricingCategory: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  qualityRating: string | null;
  verifiedName: string | null;
  messageType: string | null;
  fromWaId: string | null;
  textContent: string | null;
  contactName: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  rejectedReason: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return String(value || "").trim();
}

function reasonText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw || raw.toUpperCase() === "NONE") return null;
    return raw;
  }
  if (typeof value === "object") {
    const row = asRecord(value);
    return reasonText(row.reason) || reasonText(row.error) || reasonText(row.message);
  }
  return null;
}

function shortHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function fromMetadata(value: Record<string, unknown>): { phoneNumberId: string | null } {
  const metadata = asRecord(value.metadata);
  const phoneNumberId = text(metadata.phone_number_id) || null;
  return { phoneNumberId };
}

function contactNameFor(value: Record<string, unknown>, waId: string | null): string | null {
  if (!waId) return null;
  for (const item of asArray(value.contacts)) {
    const row = asRecord(item);
    if (text(row.wa_id) === waId) {
      return text(asRecord(row.profile).name) || null;
    }
  }
  return null;
}

function webhookErrorMessage(firstError: Record<string, unknown>): string | null {
  const nested = asRecord(firstError.error_data);
  const candidates = [
    firstError.error_user_msg,
    firstError.error_user_title,
    nested.details,
    firstError.title,
    firstError.message,
  ];
  for (const candidate of candidates) {
    const value = text(candidate);
    if (!value || value.length > 280) continue;
    if (/EAA[A-Za-z0-9]+|access_token|app_secret|Bearer /i.test(value)) continue;
    return value;
  }
  return null;
}

function extra(): Pick<
  MetaWebhookNormalizedEvent,
  | "fromWaId"
  | "textContent"
  | "contactName"
  | "templateName"
  | "templateLanguage"
  | "rejectedReason"
  | "errorMessage"
> {
  return {
    fromWaId: null,
    textContent: null,
    contactName: null,
    templateName: null,
    templateLanguage: null,
    rejectedReason: null,
    errorMessage: null,
  };
}

export function hashRawPayload(rawBody: Buffer): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function parseMetaWebhookPayload(
  payload: unknown,
  payloadHash: string,
): MetaWebhookNormalizedEvent[] {
  const root = asRecord(payload);
  const events: MetaWebhookNormalizedEvent[] = [];
  const entries = asArray(root.entry);

  if (!entries.length) {
    events.push({
      eventKey: `unknown:root:${payloadHash.slice(0, 32)}`,
      eventType: "unknown",
      wabaId: null,
      phoneNumberId: null,
      messageId: null,
      status: null,
      timestamp: null,
      recipientId: null,
      conversationId: null,
      pricingCategory: null,
      errorCode: null,
      qualityRating: null,
      verifiedName: null,
      messageType: null,
      ...extra(),
    });
    return events;
  }

  for (const entry of entries) {
    const entryObj = asRecord(entry);
    const wabaId = text(entryObj.id) || null;
    for (const change of asArray(entryObj.changes)) {
      const changeObj = asRecord(change);
      const field = text(changeObj.field) || "unknown";
      const value = asRecord(changeObj.value);
      const { phoneNumberId } = fromMetadata(value);

      if (field === "messages") {
        for (const message of asArray(value.messages)) {
          const msg = asRecord(message);
          const messageId = text(msg.id);
          const fromWaId = text(msg.from) || null;
          const messageType = text(msg.type) || null;
          const textBody = messageType === "text" ? text(asRecord(msg.text).body) || null : null;
          events.push({
            eventKey: `msg:${phoneNumberId || wabaId || "na"}:${messageId || shortHash([payloadHash, text(msg.timestamp)])}`,
            eventType: "messages",
            wabaId,
            phoneNumberId,
            messageId: messageId || null,
            status: null,
            timestamp: text(msg.timestamp) || null,
            recipientId: null,
            conversationId: null,
            pricingCategory: null,
            errorCode: null,
            qualityRating: null,
            verifiedName: null,
            messageType,
            fromWaId,
            textContent: textBody,
            contactName: contactNameFor(value, fromWaId),
            templateName: null,
            templateLanguage: null,
            rejectedReason: null,
            errorMessage: null,
          });
        }
        for (const statusRow of asArray(value.statuses)) {
          const row = asRecord(statusRow);
          const conversation = asRecord(row.conversation);
          const pricing = asRecord(row.pricing);
          const errors = asArray(row.errors);
          const firstError = asRecord(errors[0]);
          const statusId = text(row.id);
          const status = text(row.status);
          events.push({
            eventKey: `status:${phoneNumberId || wabaId || "na"}:${statusId}:${status || shortHash([payloadHash])}`,
            eventType: "statuses",
            wabaId,
            phoneNumberId,
            messageId: statusId || null,
            status: status || null,
            timestamp: text(row.timestamp) || null,
            recipientId: text(row.recipient_id) || null,
            conversationId: text(conversation.id) || null,
            pricingCategory: text(pricing.category) || null,
            errorCode: text(firstError.code) || null,
            qualityRating: null,
            verifiedName: null,
            messageType: null,
            ...extra(),
            errorMessage: webhookErrorMessage(firstError),
          });
        }
        if (!asArray(value.messages).length && !asArray(value.statuses).length) {
          events.push({
            eventKey: `messages:${phoneNumberId || wabaId || "na"}:${shortHash([payloadHash, field])}`,
            eventType: "messages",
            wabaId,
            phoneNumberId,
            messageId: null,
            status: null,
            timestamp: null,
            recipientId: null,
            conversationId: null,
            pricingCategory: null,
            errorCode: null,
            qualityRating: null,
            verifiedName: null,
            messageType: null,
            ...extra(),
          });
        }
        continue;
      }

      if (field === "account_update") {
        events.push({
          eventKey: `account_update:${wabaId || "na"}:${shortHash([payloadHash, text(value.event)])}`,
          eventType: field,
          wabaId,
          phoneNumberId: phoneNumberId || text(value.phone_number) || null,
          messageId: null,
          status: text(value.event) || null,
          timestamp: null,
          recipientId: null,
          conversationId: null,
          pricingCategory: null,
          errorCode: null,
          qualityRating: null,
            verifiedName: null,
            messageType: null,
            ...extra(),
          });
          continue;
        }

        if (field === "phone_number_name_update") {
        const verifiedName =
          text(value.requested_verified_name) || text(value.verified_name) || null;
        events.push({
          eventKey: `name:${phoneNumberId || wabaId || "na"}:${shortHash([payloadHash, verifiedName || ""])}`,
          eventType: field,
          wabaId,
          phoneNumberId,
          messageId: null,
          status: text(value.decision) || null,
          timestamp: null,
          recipientId: null,
          conversationId: null,
          pricingCategory: null,
          errorCode: null,
          qualityRating: null,
            verifiedName,
            messageType: null,
            ...extra(),
          });
          continue;
        }

        if (field === "phone_number_quality_update") {
        const qualityRating =
          text(value.current_limit) || text(value.quality_rating) || text(value.event) || null;
        events.push({
          eventKey: `quality:${phoneNumberId || wabaId || "na"}:${shortHash([payloadHash, qualityRating || ""])}`,
          eventType: field,
          wabaId,
          phoneNumberId,
          messageId: null,
          status: text(value.event) || null,
          timestamp: null,
          recipientId: null,
          conversationId: null,
          pricingCategory: null,
          errorCode: null,
            qualityRating,
            verifiedName: null,
            messageType: null,
            ...extra(),
          });
          continue;
        }

        if (field === "message_template_status_update") {
        const templateId = text(value.message_template_id) || text(value.message_template_name);
        events.push({
          eventKey: `tpl:${wabaId || "na"}:${templateId || shortHash([payloadHash])}:${text(value.event)}`,
          eventType: field,
          wabaId,
          phoneNumberId,
          messageId: templateId || null,
          status: text(value.event) || null,
          timestamp: null,
          recipientId: null,
          conversationId: null,
          pricingCategory: null,
          errorCode: text(asRecord(asArray(value.reason)[0]).code) || null,
            qualityRating: null,
            verifiedName: null,
            messageType: null,
            ...extra(),
            templateName: text(value.message_template_name) || null,
            templateLanguage: text(value.message_template_language) || null,
            rejectedReason: reasonText(value.reason),
          });
          continue;
        }

        events.push({
          eventKey: `unknown:${field}:${wabaId || "na"}:${payloadHash.slice(0, 32)}`,
          eventType: field,
          wabaId,
          phoneNumberId,
          messageId: null,
          status: null,
          timestamp: null,
          recipientId: null,
          conversationId: null,
          pricingCategory: null,
          errorCode: null,
          qualityRating: null,
          verifiedName: null,
          messageType: null,
          ...extra(),
        });
    }
  }

  return events;
}
