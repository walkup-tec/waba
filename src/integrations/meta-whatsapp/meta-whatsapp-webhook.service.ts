import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import {
  hashRawPayload,
  parseMetaWebhookPayload,
  type MetaWebhookNormalizedEvent,
} from "./meta-whatsapp-webhook-parser";
import { MetaWhatsappWebhookEventsRepository } from "./meta-whatsapp-webhook-events.repository";
import { logMetaWebhook } from "./meta-whatsapp-webhook-log";
import { isValidMetaHubSignature, timingSafeEqualString } from "./meta-whatsapp-webhook-signature";
import { readMetaAppSecret, readMetaWebhookVerifyToken } from "./meta-config";
import type { MetaWhatsappWebhookInboxPort } from "./meta-whatsapp-webhook-inbox.service";
import type { MetaWhatsappWebhookTemplatePort } from "./meta-whatsapp-webhook-template.service";
import { syncInboxChannelNameFromMeta } from "./meta-whatsapp-phone-identity.store";
import { applyMetaStatusToBroadcastByWamid } from "./meta-whatsapp-broadcast.store";
import { refreshCompletedLabIntakeReport, scheduleLabReportFinalize } from "./meta-whatsapp-broadcast-report";
import { mapWebhookStatus } from "./meta-whatsapp-messaging.types";

const NOOP_INBOX: MetaWhatsappWebhookInboxPort = {
  persistInbound: async () => undefined,
  applyStatus: async () => undefined,
};

const NOOP_TEMPLATES: MetaWhatsappWebhookTemplatePort = {
  applyStatus: async () => undefined,
};

function webhookOccurredAt(raw: string | null | undefined): string {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 1_000_000_000) {
    const ms = n > 10_000_000_000 ? n : n * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function applyBroadcastStatusFromWebhook(event: MetaWebhookNormalizedEvent): void {
  const mapped = mapWebhookStatus(event.status);
  if (!mapped) return;
  const campaign = applyMetaStatusToBroadcastByWamid(event.messageId || "", mapped, {
    recipientId: event.recipientId,
    phoneNumberId: event.phoneNumberId,
    errorCode: event.errorCode,
    errorMessage: event.errorMessage,
    occurredAt: webhookOccurredAt(event.timestamp),
  });
  if (!campaign?.intakeCampaignId) return;
  refreshCompletedLabIntakeReport(campaign.intakeCampaignId);
  scheduleLabReportFinalize(campaign.intakeCampaignId);
}

export type MetaWebhookVerifyQuery = {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
};

export type MetaWebhookProcessResult = {
  httpStatus: number;
  accepted: boolean;
  duplicate?: boolean;
  reason?: string;
};

export class MetaWhatsappWebhookService {
  constructor(
    private readonly connections = new MetaWhatsappConnectionRepository(),
    private readonly events = new MetaWhatsappWebhookEventsRepository(),
    private readonly inbox: MetaWhatsappWebhookInboxPort = NOOP_INBOX,
    private readonly templates: MetaWhatsappWebhookTemplatePort = NOOP_TEMPLATES,
  ) {}

  verifySubscription(query: MetaWebhookVerifyQuery): { ok: true; challenge: string } | { ok: false } {
    const mode = String(query["hub.mode"] || "").trim();
    const token = String(query["hub.verify_token"] || "");
    const challenge = String(query["hub.challenge"] || "");
    const expected = readMetaWebhookVerifyToken();
    logMetaWebhook("VERIFY", { mode, hasChallenge: Boolean(challenge) });
    if (mode !== "subscribe" || !expected || !timingSafeEqualString(token, expected)) {
      logMetaWebhook("ERROR", { reason: "verify_token_mismatch" });
      return { ok: false };
    }
    return { ok: true, challenge };
  }

  async processPostedEvent(input: {
    rawBody: Buffer | undefined;
    signatureHeader: unknown;
    parsedBody?: unknown;
  }): Promise<MetaWebhookProcessResult> {
    const appSecret = readMetaAppSecret();
    const rawBody = input.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody) || !rawBody.length) {
      logMetaWebhook("SIGNATURE", { valid: false, reason: "missing_raw_body" });
      return { httpStatus: 403, accepted: false, reason: "missing_raw_body" };
    }
    const valid = isValidMetaHubSignature({
      appSecret,
      rawBody,
      header: input.signatureHeader,
    });
    logMetaWebhook("SIGNATURE", { valid, bytes: rawBody.length });
    if (!valid) {
      return { httpStatus: 403, accepted: false, reason: "invalid_signature" };
    }

    const payloadHash = hashRawPayload(rawBody);
    let payload: unknown = input.parsedBody;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      logMetaWebhook("ERROR", { reason: "malformed_json", payloadHash: payloadHash.slice(0, 12) });
      return { httpStatus: 200, accepted: true, reason: "malformed_json" };
    }

    const events = parseMetaWebhookPayload(payload, payloadHash);
    logMetaWebhook("RECEIVED", {
      eventCount: events.length,
      payloadHash: payloadHash.slice(0, 12),
    });

    for (const event of events) {
      try {
        await this.processOne(event, payloadHash);
      } catch {
        logMetaWebhook("ERROR", {
          reason: "process_failed",
          eventType: event.eventType,
          eventKey: event.eventKey.slice(0, 80),
        });
      }
    }

    return { httpStatus: 200, accepted: true };
  }

  private async resolveConnection(
    event: MetaWebhookNormalizedEvent,
  ): Promise<MetaWhatsappConnectionRecord | null> {
    if (event.phoneNumberId) {
      const byPhone = await this.connections.findConnectedByPhoneNumberId(event.phoneNumberId);
      if (byPhone) return byPhone;
    }
    if (event.wabaId) {
      return this.connections.findConnectedByWabaId(event.wabaId);
    }
    return null;
  }

  private async processOne(event: MetaWebhookNormalizedEvent, payloadHash: string): Promise<void> {
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
      logMetaWebhook("DUPLICATE", { eventType: event.eventType });
      if (event.eventType === "statuses") {
        applyBroadcastStatusFromWebhook(event);
      }
      return;
    }

    if (!connection) {
      if (event.eventType === "statuses") applyBroadcastStatusFromWebhook(event);
      logMetaWebhook("PROCESSED", { eventType: event.eventType, unmatched: true });
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
        syncInboxChannelNameFromMeta(connection.tenantId, event.phoneNumberId, event.verifiedName);
      }
    }
    if (event.eventType === "messages") {
      try {
        await this.inbox.persistInbound({ connection, event });
      } catch {
        logMetaWebhook("ERROR", { reason: "inbox_inbound_failed", eventType: event.eventType });
      }
    }
    if (event.eventType === "statuses") {
      try {
        await this.inbox.applyStatus({ connection, event });
      } catch {
        logMetaWebhook("ERROR", { reason: "inbox_status_failed", eventType: event.eventType });
      }
      applyBroadcastStatusFromWebhook(event);
    }
    if (event.eventType === "message_template_status_update") {
      try {
        await this.templates.applyStatus({ connection, event });
      } catch {
        logMetaWebhook("ERROR", { reason: "template_status_failed", eventType: event.eventType });
      }
    }

    logMetaWebhook("PROCESSED", {
      eventType: event.eventType,
      tenantId: connection.tenantId,
      messageId: event.messageId,
      status: event.status,
      messageType: event.messageType,
    });
  }
}
