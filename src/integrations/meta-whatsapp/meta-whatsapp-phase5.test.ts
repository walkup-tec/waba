import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createHmac } from "node:crypto";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { MetaWhatsappWebhookService } from "./meta-whatsapp-webhook.service";
import {
  computeMetaHubSignatureHex,
  isValidMetaHubSignature,
} from "./meta-whatsapp-webhook-signature";
import { parseMetaWebhookPayload, hashRawPayload } from "./meta-whatsapp-webhook-parser";
import { MetaWhatsappWebhookSubscriptionService } from "./meta-whatsapp-webhook-subscription.service";
import {
  MetaWhatsappConnectionService,
  pickConnectionsForWebhookSubscribe,
} from "./meta-whatsapp-connection.service";

function sign(secret: string, raw: Buffer): string {
  return `sha256=${computeMetaHubSignatureHex(secret, raw)}`;
}

function connectedRow(overrides: Partial<MetaWhatsappConnectionRecord> = {}): MetaWhatsappConnectionRecord {
  return {
    id: "conn-1",
    tenantId: "11111111-1111-4111-8111-111111111111",
    ownerEmail: "tenant@example.com",
    metaBusinessId: "bm-1",
    wabaId: "waba-1",
    phoneNumberId: "phone-1",
    displayPhoneNumber: "+15550001111",
    verifiedName: "Loja",
    accessTokenEncrypted: "v1:a:b:c",
    tokenType: "bearer",
    tokenExpiresAt: null,
    configId: "cfg",
    status: "connected",
    qualityRating: "GREEN",
    messagingLimit: null,
    lastTokenValidationAt: null,
    lastWebhookAt: null,
    lastError: null,
    createdBy: "t",
    updatedBy: "t",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    connectedAt: "2026-01-01T00:00:00.000Z",
    disconnectedAt: null,
    ...overrides,
  };
}

function messagesPayload(phoneNumberId = "phone-1") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: phoneNumberId, display_phone_number: "15550001111" },
              messages: [{ id: "wamid.AAA", timestamp: "1710000000", type: "text", from: "15550002222" }],
            },
          },
        ],
      },
    ],
  };
}

describe("meta whatsapp webhook fase 5", () => {
  const previousSecret = process.env.META_APP_SECRET;
  const previousVerify = process.env.META_WEBHOOK_VERIFY_TOKEN;

  before(() => {
    process.env.META_APP_SECRET = "test-app-secret";
    process.env.META_WEBHOOK_VERIFY_TOKEN = "stable-verify-token";
  });

  after(() => {
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
    if (previousVerify === undefined) delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    else process.env.META_WEBHOOK_VERIFY_TOKEN = previousVerify;
  });

  it("GET verify válido devolve o challenge", () => {
    const service = new MetaWhatsappWebhookService();
    const result = service.verifySubscription({
      "hub.mode": "subscribe",
      "hub.verify_token": "stable-verify-token",
      "hub.challenge": "challenge-123",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.challenge, "challenge-123");
  });

  it("GET verify inválido rejeita", () => {
    const service = new MetaWhatsappWebhookService();
    const result = service.verifySubscription({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "challenge-123",
    });
    assert.equal(result.ok, false);
  });

  it("POST sem assinatura retorna 403", async () => {
    const service = new MetaWhatsappWebhookService();
    const raw = Buffer.from(JSON.stringify(messagesPayload()), "utf8");
    const result = await service.processPostedEvent({ rawBody: raw, signatureHeader: undefined });
    assert.equal(result.httpStatus, 403);
    assert.equal(result.accepted, false);
  });

  it("POST assinatura inválida retorna 403", async () => {
    const service = new MetaWhatsappWebhookService();
    const raw = Buffer.from(JSON.stringify(messagesPayload()), "utf8");
    const result = await service.processPostedEvent({
      rawBody: raw,
      signatureHeader: "sha256=" + "a".repeat(64),
    });
    assert.equal(result.httpStatus, 403);
  });

  it("POST assinatura válida retorna 200", async () => {
    const inserts: string[] = [];
    const service = new MetaWhatsappWebhookService(
      {
        findConnectedByPhoneNumberId: async () => connectedRow(),
        findConnectedByWabaId: async () => null,
        touchLastWebhookAt: async () => undefined,
        patchConfirmedMetadata: async () => undefined,
      } as any,
      {
        insertIfNew: async (row: { eventKey: string }) => {
          inserts.push(row.eventKey);
          return { duplicate: false, id: "evt-1" };
        },
      } as any,
    );
    const raw = Buffer.from(JSON.stringify(messagesPayload()), "utf8");
    const result = await service.processPostedEvent({
      rawBody: raw,
      signatureHeader: sign("test-app-secret", raw),
    });
    assert.equal(result.httpStatus, 200);
    assert.equal(result.accepted, true);
    assert.equal(inserts.length, 1);
  });

  it("HMAC usa o raw body e falha se o JSON for resserializado", () => {
    const original = Buffer.from('{"object":"whatsapp_business_account","z":1}', "utf8");
    const header = sign("test-app-secret", original);
    assert.equal(
      isValidMetaHubSignature({ appSecret: "test-app-secret", rawBody: original, header }),
      true,
    );
    const parsed = JSON.parse(original.toString("utf8"));
    const reserialized = Buffer.from(JSON.stringify({ z: parsed.z, object: parsed.object }), "utf8");
    assert.notEqual(original.toString("utf8"), reserialized.toString("utf8"));
    assert.equal(
      isValidMetaHubSignature({ appSecret: "test-app-secret", rawBody: reserialized, header }),
      false,
    );
  });

  it("evento duplicado não reprocessa", async () => {
    let touches = 0;
    const service = new MetaWhatsappWebhookService(
      {
        findConnectedByPhoneNumberId: async () => connectedRow(),
        findConnectedByWabaId: async () => null,
        touchLastWebhookAt: async () => {
          touches += 1;
        },
        patchConfirmedMetadata: async () => undefined,
      } as any,
      {
        insertIfNew: async () => ({ duplicate: true, id: null }),
      } as any,
    );
    const raw = Buffer.from(JSON.stringify(messagesPayload()), "utf8");
    const result = await service.processPostedEvent({
      rawBody: raw,
      signatureHeader: sign("test-app-secret", raw),
    });
    assert.equal(result.httpStatus, 200);
    assert.equal(touches, 0);
  });

  it("resolve tenant por phone_number_id", async () => {
    const phones: string[] = [];
    const service = new MetaWhatsappWebhookService(
      {
        findConnectedByPhoneNumberId: async (id: string) => {
          phones.push(id);
          return connectedRow({ phoneNumberId: id, tenantId: "tenant-phone" });
        },
        findConnectedByWabaId: async () => {
          throw new Error("não deve consultar WABA quando o phone resolve");
        },
        touchLastWebhookAt: async () => undefined,
        patchConfirmedMetadata: async () => undefined,
      } as any,
      {
        insertIfNew: async () => ({ duplicate: false, id: "evt" }),
      } as any,
    );
    const raw = Buffer.from(JSON.stringify(messagesPayload("phone-99")), "utf8");
    await service.processPostedEvent({
      rawBody: raw,
      signatureHeader: sign("test-app-secret", raw),
    });
    assert.deepEqual(phones, ["phone-99"]);
  });

  it("tenant inexistente ainda responde 200", async () => {
    const statuses: string[] = [];
    const service = new MetaWhatsappWebhookService(
      {
        findConnectedByPhoneNumberId: async () => null,
        findConnectedByWabaId: async () => null,
        touchLastWebhookAt: async () => {
          throw new Error("não deve atualizar conexão");
        },
        patchConfirmedMetadata: async () => undefined,
      } as any,
      {
        insertIfNew: async (row: { status: string }) => {
          statuses.push(row.status);
          return { duplicate: false, id: "evt" };
        },
      } as any,
    );
    const raw = Buffer.from(JSON.stringify(messagesPayload("unknown-phone")), "utf8");
    const result = await service.processPostedEvent({
      rawBody: raw,
      signatureHeader: sign("test-app-secret", raw),
    });
    assert.equal(result.httpStatus, 200);
    assert.deepEqual(statuses, ["unmatched_tenant"]);
  });

  it("parseia messages sem persistir texto", () => {
    const events = parseMetaWebhookPayload(messagesPayload(), "abc".repeat(22));
    assert.equal(events[0].eventType, "messages");
    assert.equal(events[0].messageId, "wamid.AAA");
    assert.equal(events[0].messageType, "text");
    assert.equal(JSON.stringify(events[0]).includes("hello"), false);
  });

  it("parseia statuses", () => {
    const payload = {
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "phone-1" },
                statuses: [
                  {
                    id: "wamid.BBB",
                    status: "delivered",
                    timestamp: "1710000001",
                    recipient_id: "15550003333",
                    conversation: { id: "conv-1" },
                    pricing: { category: "utility" },
                    errors: [{ code: "131026" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseMetaWebhookPayload(payload, hashRawPayload(Buffer.from("x")));
    assert.equal(events[0].eventType, "statuses");
    assert.equal(events[0].status, "delivered");
    assert.equal(events[0].recipientId, "15550003333");
    assert.equal(events[0].conversationId, "conv-1");
    assert.equal(events[0].pricingCategory, "utility");
    assert.equal(events[0].errorCode, "131026");
  });

  it("parseia account_update", () => {
    const events = parseMetaWebhookPayload(
      {
        entry: [
          {
            id: "waba-1",
            changes: [{ field: "account_update", value: { event: "ACCOUNT_DELETED" } }],
          },
        ],
      },
      "hash",
    );
    assert.equal(events[0].eventType, "account_update");
    assert.equal(events[0].status, "ACCOUNT_DELETED");
  });

  it("parseia phone_number_quality_update", async () => {
    const patches: Array<{ qualityRating?: string | null }> = [];
    const payload = {
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "phone_number_quality_update",
              value: {
                metadata: { phone_number_id: "phone-1" },
                current_limit: "TIER_1K",
                event: "FLAGGED",
              },
            },
          ],
        },
      ],
    };
    const service = new MetaWhatsappWebhookService(
      {
        findConnectedByPhoneNumberId: async () => connectedRow(),
        findConnectedByWabaId: async () => null,
        touchLastWebhookAt: async () => undefined,
        patchConfirmedMetadata: async (_t: string, _id: string, patch: { qualityRating?: string | null }) => {
          patches.push(patch);
        },
      } as any,
      {
        insertIfNew: async () => ({ duplicate: false, id: "evt" }),
      } as any,
    );
    const raw = Buffer.from(JSON.stringify(payload), "utf8");
    await service.processPostedEvent({
      rawBody: raw,
      signatureHeader: sign("test-app-secret", raw),
    });
    assert.equal(patches[0]?.qualityRating, "TIER_1K");
  });

  it("parseia message_template_status_update", () => {
    const events = parseMetaWebhookPayload(
      {
        entry: [
          {
            id: "waba-1",
            changes: [
              {
                field: "message_template_status_update",
                value: { event: "APPROVED", message_template_id: "tpl-9", message_template_name: "hello" },
              },
            ],
          },
        ],
      },
      "hash",
    );
    assert.equal(events[0].eventType, "message_template_status_update");
    assert.equal(events[0].status, "APPROVED");
    assert.equal(events[0].messageId, "tpl-9");
  });

  it("payload desconhecido gera evento unknown", () => {
    const events = parseMetaWebhookPayload(
      {
        entry: [{ id: "waba-1", changes: [{ field: "smb_message_echoes", value: {} }] }],
      },
      "deadbeef".repeat(8),
    );
    assert.equal(events[0].eventType, "smb_message_echoes");
    assert.match(events[0].eventKey, /^unknown:/);
  });

  it("payload malformado com assinatura válida retorna 200", async () => {
    const service = new MetaWhatsappWebhookService();
    const raw = Buffer.from("{not-json", "utf8");
    const result = await service.processPostedEvent({
      rawBody: raw,
      signatureHeader: sign("test-app-secret", raw),
    });
    assert.equal(result.httpStatus, 200);
    assert.equal(result.reason, "malformed_json");
  });
});

describe("meta webhook subscription", () => {
  it("não chama Graph se já houver app inscrito", async () => {
    const calls: string[] = [];
    const service = new MetaWhatsappWebhookSubscriptionService(
      async (input) => {
        calls.push(input.method);
        return { ok: true, status: 200, json: { data: [{ id: "app-1" }] }, body: "{}" };
      },
      () => "GRAPH-TOKEN",
    );
    const result = await service.ensureSubscribed(connectedRow());
    assert.equal(result.ok, true);
    assert.equal(result.alreadySubscribed, true);
    assert.deepEqual(calls, ["GET"]);
  });

  it("inscreve via POST /{WABA_ID}/subscribed_apps quando vazio", async () => {
    const calls: string[] = [];
    const bodies: unknown[] = [];
    const service = new MetaWhatsappWebhookSubscriptionService(
      async (input) => {
        calls.push(`${input.method}:${input.path}`);
        bodies.push(input.body);
        if (input.method === "GET") {
          return { ok: true, status: 200, json: { data: [] }, body: "{}" };
        }
        return { ok: true, status: 200, json: { success: true }, body: "{}" };
      },
      () => "GRAPH-TOKEN",
    );
    const result = await service.ensureSubscribed(connectedRow());
    assert.equal(result.subscribed, true);
    assert.equal(result.alreadySubscribed, false);
    assert.deepEqual(calls, ["GET:waba-1/subscribed_apps", "POST:waba-1/subscribed_apps"]);
    assert.equal(bodies[1], undefined);
  });
});

describe("multi-WABA webhook subscribe para Inbox", () => {
  it("pickConnectionsForWebhookSubscribe deduplica por WABA e prioriza connectionId", () => {
    const a = connectedRow({ id: "conn-a", wabaId: "waba-a", phoneNumberId: "phone-a", updatedAt: "2026-01-01T00:00:00.000Z" });
    const b = connectedRow({ id: "conn-b", wabaId: "waba-b", phoneNumberId: "phone-b", updatedAt: "2026-01-02T00:00:00.000Z" });
    const aDup = connectedRow({ id: "conn-a2", wabaId: "waba-a", phoneNumberId: "phone-a2", updatedAt: "2026-01-03T00:00:00.000Z" });
    const picked = pickConnectionsForWebhookSubscribe([a, b, aDup], { connectionId: "conn-a", phoneNumberId: "phone-a" });
    assert.equal(picked.length, 2);
    assert.equal(picked[0]?.id, "conn-a");
    assert.equal(picked.some((row) => row.wabaId === "waba-b"), true);
  });

  it("subscribeWebhooksFromAuth inscreve todas as WABAs abertas", async () => {
    const ensured: string[] = [];
    const repo = {
      async listOpenByTenant() {
        return [
          connectedRow({ id: "conn-a", wabaId: "waba-a", phoneNumberId: "phone-a" }),
          connectedRow({ id: "conn-b", wabaId: "waba-b", phoneNumberId: "phone-b" }),
        ];
      },
      async findOpenByTenant() {
        return connectedRow({ id: "conn-b", wabaId: "waba-b", phoneNumberId: "phone-b" });
      },
    };
    const webhookSubscriptions = {
      async ensureSubscribed(connection: MetaWhatsappConnectionRecord) {
        ensured.push(String(connection.wabaId));
        return { ok: true, alreadySubscribed: false, subscribed: true };
      },
    };
    const service = new MetaWhatsappConnectionService(
      repo as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      (async () => ({ ok: true, status: 200, json: {} })) as any,
      undefined as any,
      undefined as any,
      undefined as any,
      webhookSubscriptions as any,
    );
    const auth = {
      email: "tenant@example.com",
      role: "subscriber",
    } as any;
    const result = await service.subscribeWebhooksFromAuth(auth, {
      connectionId: "conn-a",
      phoneNumberId: "phone-a",
    });
    assert.equal(result.subscribed, true);
    assert.equal(result.wabaCount, 2);
    assert.deepEqual(ensured.sort(), ["waba-a", "waba-b"]);
  });
});

describe("hmac helper", () => {
  it("gera sha256 hex do corpo", () => {
    const raw = Buffer.from("abc", "utf8");
    const hex = createHmac("sha256", "test-app-secret").update(raw).digest("hex");
    assert.equal(computeMetaHubSignatureHex("test-app-secret", raw), hex);
  });
});
