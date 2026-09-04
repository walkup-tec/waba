import assert from "node:assert/strict";
import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import { randomUUID } from "node:crypto";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import { MetaCloudProvider } from "../whatsapp/meta-cloud-provider";
import { EvolutionProvider } from "../whatsapp/evolution-provider";
import { MetaWhatsappMessagingService } from "./meta-whatsapp-messaging.service";
import { MetaWhatsappWebhookInboxService } from "./meta-whatsapp-webhook-inbox.service";
import { MetaWhatsappWebhookService } from "./meta-whatsapp-webhook.service";
import { parseMetaWebhookPayload } from "./meta-whatsapp-webhook-parser";
import { postMetaCloudMessage } from "./meta-whatsapp-graph-messages.client";
import { canAdvanceMetaMessageStatus, mapWebhookStatus } from "./meta-whatsapp-messaging.types";
import type { MetaConversationRecord, MetaMessageRecord, MetaMessageStatus } from "./meta-whatsapp-messaging.types";
import { normalizeCloudApiRecipient } from "./meta-whatsapp-recipient";
import { resolveCustomerCareWindow } from "./meta-whatsapp-customer-care-window";
import { stripMetaSecrets } from "./meta-whatsapp-connection.service";
import { encryptMetaToken } from "./meta-token-crypto";
import { computeMetaHubSignatureHex } from "./meta-whatsapp-webhook-signature";
import { MetaWhatsappError, toPublicMetaError } from "./meta-whatsapp-errors";
import { purgePhoneIdentities, writePhoneIdentity } from "./meta-whatsapp-phone-identity.store";
import type { MetaGraphMessagesResult } from "./meta-whatsapp-graph-messages.client";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function connectedRow(overrides: Partial<MetaWhatsappConnectionRecord> = {}): MetaWhatsappConnectionRecord {
  return {
    id: "conn-a",
    tenantId: TENANT_A,
    ownerEmail: "a@example.com",
    metaBusinessId: "bm",
    wabaId: "waba-a",
    phoneNumberId: "phone-a",
    displayPhoneNumber: "5551999000000",
    verifiedName: "Loja",
    accessTokenEncrypted: "v1:enc",
    tokenType: "bearer",
    tokenExpiresAt: null,
    configId: "cfg",
    status: "connected",
    qualityRating: null,
    messagingLimit: null,
    lastTokenValidationAt: null,
    lastWebhookAt: null,
    lastError: null,
    createdBy: "a",
    updatedBy: "a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    connectedAt: "2026-01-01T00:00:00.000Z",
    disconnectedAt: null,
    ...overrides,
  };
}

class FakeConnections {
  rows: MetaWhatsappConnectionRecord[] = [];

  async findByIdForTenant(tenantId: string, id: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) || null;
  }
  async findConnectedByTenant(tenantId: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.status === "connected") || null;
  }
  async findConnectedByPhoneNumberId(phoneNumberId: string) {
    return this.rows.find((row) => row.phoneNumberId === phoneNumberId && row.status === "connected") || null;
  }
  async findConnectedByWabaId() {
    return null;
  }
  async touchLastWebhookAt() {}
  async patchConfirmedMetadata() {}
}

class FakeConversations {
  rows: MetaConversationRecord[] = [];
  upserts: Array<{ contactWaId: string; inbound?: boolean }> = [];

  async findByIdForTenant(tenantId: string, id: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) || null;
  }

  async findByTenantContact(tenantId: string, contactWaId: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.contactWaId === contactWaId) || null;
  }

  async findByTenantPhoneContact(tenantId: string, phoneNumberId: string, contactWaId: string) {
    return (
      this.rows.find(
        (row) =>
          row.tenantId === tenantId &&
          row.phoneNumberId === phoneNumberId &&
          row.contactWaId === contactWaId,
      ) || null
    );
  }

  async findByTenantConnectionContact(tenantId: string, connectionId: string, contactWaId: string) {
    return (
      this.rows.find(
        (row) =>
          row.tenantId === tenantId && row.connectionId === connectionId && row.contactWaId === contactWaId,
      ) || null
    );
  }

  async upsertForContact(input: {
    tenantId: string;
    connectionId: string;
    phoneNumberId?: string | null;
    contactWaId: string;
    contactPhone?: string | null;
    contactName?: string | null;
    inbound?: boolean;
    outbound?: boolean;
    atIso: string;
  }) {
    this.upserts.push({ contactWaId: input.contactWaId, inbound: input.inbound });
    const phoneNumberId = String(input.phoneNumberId || "").trim();
    const existing = phoneNumberId
      ? await this.findByTenantPhoneContact(input.tenantId, phoneNumberId, input.contactWaId)
      : await this.findByTenantConnectionContact(
          input.tenantId,
          input.connectionId,
          input.contactWaId,
        );
    if (existing) {
      existing.connectionId = input.connectionId;
      if (input.phoneNumberId) existing.phoneNumberId = input.phoneNumberId;
      existing.lastMessageAt = input.atIso;
      if (input.inbound) {
        existing.lastInboundAt = input.atIso;
        existing.unreadCount += 1;
      }
      if (input.outbound) existing.lastOutboundAt = input.atIso;
      if (input.contactName) existing.contactName = input.contactName;
      return { record: existing, created: false };
    }
    const record: MetaConversationRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      phoneNumberId: input.phoneNumberId || null,
      contactWaId: input.contactWaId,
      contactPhone: input.contactPhone || null,
      contactName: input.contactName || null,
      status: "open",
      assignedTo: null,
      lastMessageAt: input.atIso,
      lastInboundAt: input.inbound ? input.atIso : null,
      lastOutboundAt: input.outbound ? input.atIso : null,
      unreadCount: input.inbound ? 1 : 0,
      humanTakeover: false,
      lastMessagePreview: null,
      createdAt: input.atIso,
      updatedAt: input.atIso,
    };
    this.rows.push(record);
    return { record, created: true };
  }
}

class FakeMessages {
  rows: MetaMessageRecord[] = [];

  async findByTenantWamid(tenantId: string, wamid: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.wamid === wamid) || null;
  }

  async insert(input: Partial<MetaMessageRecord> & {
    tenantId: string;
    conversationId: string;
    connectionId: string;
    direction: "inbound" | "outbound";
    type: string;
    status: MetaMessageStatus;
  }) {
    if (input.wamid && this.rows.some((row) => row.wamid === input.wamid)) {
      return { record: null, duplicate: true };
    }
    const record: MetaMessageRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      connectionId: input.connectionId,
      wamid: input.wamid || null,
      direction: input.direction,
      type: input.type,
      status: input.status,
      fromWaId: input.fromWaId || null,
      toWaId: input.toWaId || null,
      textContent: input.textContent || null,
      templateName: input.templateName || null,
      templateLanguage: input.templateLanguage || null,
      provider: input.provider || "meta-cloud",
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.rows.push(record);
    return { record, duplicate: false };
  }

  async updateAfterGraph(
    tenantId: string,
    id: string,
    patch: { wamid?: string | null; status: MetaMessageStatus; errorCode?: string | null; errorMessage?: string | null },
  ) {
    const row = this.rows.find((item) => item.tenantId === tenantId && item.id === id);
    if (!row) return null;
    row.status = patch.status;
    if (patch.wamid) row.wamid = patch.wamid;
    if (patch.status === "failed") row.failedAt = new Date().toISOString();
    row.errorCode = patch.errorCode || null;
    row.errorMessage = patch.errorMessage || null;
    return row;
  }

  async applyWebhookStatus(tenantId: string, wamid: string, next: MetaMessageStatus, atIso: string) {
    const current = await this.findByTenantWamid(tenantId, wamid);
    if (!current) return { updated: false, record: null };
    if (!canAdvanceMetaMessageStatus(current.status, next)) {
      return { updated: false, record: current };
    }
    current.status = next;
    if (next === "sent") current.sentAt = current.sentAt || atIso;
    if (next === "delivered") current.deliveredAt = current.deliveredAt || atIso;
    if (next === "read") current.readAt = current.readAt || atIso;
    if (next === "failed") current.failedAt = current.failedAt || atIso;
    return { updated: true, record: current };
  }
}

function graphOk(wamid = "wamid.OUT"): MetaGraphMessagesResult {
  return {
    ok: true,
    status: 200,
    json: { messages: [{ id: wamid }] },
    body: "{}",
    timeout: false,
    kind: "permanent",
    graphCode: null,
    wamid,
    attempts: 1,
  };
}

function graphErr(status: number, extra: Partial<MetaGraphMessagesResult> = {}): MetaGraphMessagesResult {
  return {
    ok: false,
    status,
    json: { error: { code: extra.graphCode || status } },
    body: "{}",
    timeout: false,
    kind: extra.kind || (status === 429 || status >= 500 ? "transient" : "permanent"),
    graphCode: extra.graphCode || String(status),
    wamid: null,
    attempts: extra.attempts || 1,
    ...extra,
  };
}

function sign(secret: string, raw: Buffer): string {
  return `sha256=${computeMetaHubSignatureHex(secret, raw)}`;
}

describe("fase 6 recipient e janela", () => {
  it("não altera DDI em silêncio", () => {
    const ok = normalizeCloudApiRecipient("55 51 99988-7766");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.waId, "5551999887766");
    const bad = normalizeCloudApiRecipient("999887766");
    assert.equal(bad.ok, true);
    if (bad.ok) assert.equal(bad.waId, "999887766");
    assert.equal(normalizeCloudApiRecipient("0551999887766").ok, false);
    assert.equal(normalizeCloudApiRecipient("abc").ok, false);
  });

  it("sem last_inbound_at não inventa janela", () => {
    const state = resolveCustomerCareWindow({ lastInboundAt: null });
    assert.equal(state.known, false);
    assert.equal(state.withinWindow, null);
  });
});

describe("fase 6 status rank", () => {
  it("não regride read para delivered", () => {
    assert.equal(canAdvanceMetaMessageStatus("read", "delivered"), false);
    assert.equal(canAdvanceMetaMessageStatus("delivered", "read"), true);
    assert.equal(canAdvanceMetaMessageStatus("sent", "delivered"), true);
    assert.equal(mapWebhookStatus("read"), "read");
  });
});

describe("fase 6 MetaCloudProvider", () => {
  it("EvolutionProvider não mistura com Meta", async () => {
    const evo = new EvolutionProvider();
    assert.equal(evo.name, "evolution");
    await assert.rejects(() => evo.sendText({ tenantId: TENANT_A, to: "5551999887766", text: "x" }));
  });

  it("envia texto e não devolve token", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const calls: unknown[] = [];
    const provider = new MetaCloudProvider(
      connections as any,
      async (input: { body: unknown; phoneNumberId: string; token: string }) => {
        calls.push(input.body);
        assert.equal(input.phoneNumberId, "phone-a");
        assert.equal(input.token, "PLAIN-TOKEN");
        return graphOk();
      },
      () => "PLAIN-TOKEN",
    );
    const result = await provider.sendText({
      tenantId: TENANT_A,
      to: "5551999887766",
      text: "olá",
    });
    assert.equal(result.provider, "meta-cloud");
    assert.equal(result.messageId, "wamid.OUT");
    assert.equal(result.status, "accepted");
    assert.equal(result.connectionId, "conn-a");
    const publicJson = JSON.stringify(stripMetaSecrets(result));
    assert.equal(/PLAIN-TOKEN|access_token|Bearer/i.test(publicJson), false);
    const body = calls[0] as { type: string; text: { body: string } };
    assert.equal(body.type, "text");
    assert.equal(body.text.body, "olá");
  });

  it("sendTemplate monta payload oficial", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    let payload: any = null;
    const provider = new MetaCloudProvider(
      connections as any,
      async (input: { body: unknown }) => {
        payload = input.body;
        return graphOk("wamid.TPL");
      },
      () => "PLAIN-TOKEN",
    );
    const result = await provider.sendTemplate({
      tenantId: TENANT_A,
      to: "5551999887766",
      templateName: "hello_world",
      language: "pt-BR",
      components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }] }],
    });
    assert.equal(result.messageId, "wamid.TPL");
    assert.equal(payload.type, "template");
    assert.equal(payload.template.name, "hello_world");
    assert.equal(payload.template.language.code, "pt_BR");
  });

  it("recusa conexão que não está connected", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow({ status: "pending_confirmation" }));
    const provider = new MetaCloudProvider(connections as any, async () => graphOk(), () => "t");
    await assert.rejects(
      () => provider.sendText({ tenantId: TENANT_A, to: "5551999887766", text: "x" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "not_connected",
    );
  });

  it("tenant B não usa conexão do tenant A", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const provider = new MetaCloudProvider(connections as any, async () => graphOk(), () => "t");
    await assert.rejects(
      () =>
        provider.sendText({
          tenantId: TENANT_B,
          to: "5551999887766",
          text: "x",
          connectionId: "conn-a",
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "not_connected",
    );
  });

  it("Graph 400 permanente não mascara token", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const provider = new MetaCloudProvider(connections as any, async () => graphErr(400), () => "SECRET-TOKEN");
    await assert.rejects(() => provider.sendText({ tenantId: TENANT_A, to: "5551999887766", text: "x" }));
    try {
      await provider.sendText({ tenantId: TENANT_A, to: "5551999887766", text: "x" });
    } catch (error) {
      const publicError = toPublicMetaError(error);
      assert.equal(/SECRET-TOKEN/i.test(JSON.stringify(publicError)), false);
      assert.equal(publicError.status, 424);
    }
  });

  it("Graph 401 vira invalid_token", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const provider = new MetaCloudProvider(connections as any, async () => graphErr(401), () => "t");
    await assert.rejects(
      () => provider.sendText({ tenantId: TENANT_A, to: "5551999887766", text: "x" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "invalid_token",
    );
  });
});

describe("fase 6 Graph client retry", () => {
  const previousSecret = process.env.META_APP_SECRET;
  const previousGraph = process.env.META_GRAPH_VERSION;

  before(() => {
    process.env.META_APP_SECRET = "test-secret";
    process.env.META_GRAPH_VERSION = "v22.0";
  });
  after(() => {
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
    if (previousGraph === undefined) delete process.env.META_GRAPH_VERSION;
    else process.env.META_GRAPH_VERSION = previousGraph;
  });

  it("200 captura wamid", async () => {
    const result = await postMetaCloudMessage({
      token: "tok",
      phoneNumberId: "123",
      body: { type: "text" },
      fetchImpl: (async () =>
        new Response(JSON.stringify({ messages: [{ id: "wamid.OK" }] }), { status: 200 })) as any,
    });
    assert.equal(result.ok, true);
    assert.equal(result.wamid, "wamid.OK");
    assert.equal(result.attempts, 1);
  });

  it("400 não faz retry", async () => {
    let calls = 0;
    const result = await postMetaCloudMessage({
      token: "tok",
      phoneNumberId: "123",
      body: {},
      fetchImpl: (async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 });
      }) as any,
    });
    assert.equal(result.ok, false);
    assert.equal(result.kind, "permanent");
    assert.equal(calls, 1);
  });

  it("400 com código 4 (rate limit) não faz retry", async () => {
    let calls = 0;
    const result = await postMetaCloudMessage({
      token: "tok",
      phoneNumberId: "123",
      body: {},
      fetchImpl: (async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: { code: 4, message: "(#4) Application request limit reached" } }), {
          status: 400,
        });
      }) as any,
    });
    assert.equal(result.ok, false);
    assert.equal(result.graphCode, "4");
    assert.equal(calls, 1);
  });

  it("429 faz retry", async () => {
    let calls = 0;
    const result = await postMetaCloudMessage({
      token: "tok",
      phoneNumberId: "123",
      body: {},
      fetchImpl: (async () => {
        calls += 1;
        if (calls < 3) return new Response("{}", { status: 429 });
        return new Response(JSON.stringify({ messages: [{ id: "wamid.R" }] }), { status: 200 });
      }) as any,
    });
    assert.equal(result.ok, true);
    assert.equal(calls, 3);
  });

  it("5xx esgota tentativas", async () => {
    let calls = 0;
    const result = await postMetaCloudMessage({
      token: "tok",
      phoneNumberId: "123",
      body: {},
      fetchImpl: (async () => {
        calls += 1;
        return new Response("{}", { status: 503 });
      }) as any,
    });
    assert.equal(result.ok, false);
    assert.equal(result.kind, "transient");
    assert.equal(calls, 3);
  });

  it("timeout é transiente", async () => {
    const result = await postMetaCloudMessage({
      token: "tok",
      phoneNumberId: "123",
      body: {},
      fetchImpl: (async () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }) as any,
    });
    assert.equal(result.ok, false);
    assert.equal(result.kind, "transient");
    assert.equal(result.timeout, true);
  });
});

describe("fase 6 messaging service", () => {
  const previousKey = process.env.META_TOKEN_ENCRYPTION_KEY;

  before(() => {
    process.env.META_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  });
  after(() => {
    if (previousKey === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY;
    else process.env.META_TOKEN_ENCRYPTION_KEY = previousKey;
  });

  it("sessão define tenant e persiste wamid accepted", async () => {
    const email = "phase6-lab@example.com";
    const tenantId = deriveStableMetaTenantId(email);
    const connections = new FakeConnections();
    connections.rows.push(connectedRow({ tenantId, ownerEmail: email, accessTokenEncrypted: encryptMetaToken("tok") }));
    const conversations = new FakeConversations();
    const messages = new FakeMessages();
    const provider = new MetaCloudProvider(connections as any, async () => graphOk("wamid.S1"), () => "tok");
    const service = new MetaWhatsappMessagingService(provider, conversations as any, messages as any);
    const auth: WabaRequestAuth = { email, role: "subscriber" };
    const result = await service.sendFromAuth(auth, {
      to: "5551999887766",
      type: "text",
      text: "ping",
      tenant_id: TENANT_B,
      access_token: "should-ignore",
    });
    assert.equal(result.messageId, "wamid.S1");
    assert.equal(result.status, "accepted");
    assert.equal(messages.rows[0].status, "accepted");
    assert.equal(messages.rows[0].wamid, "wamid.S1");
    assert.equal(messages.rows[0].textContent, "ping");
    assert.equal(JSON.stringify(result).includes("should-ignore"), false);
    assert.equal(JSON.stringify(result).includes("tok"), false);
  });

  it("conexão pending devolve 409", async () => {
    const email = "phase6-pending@example.com";
    const tenantId = deriveStableMetaTenantId(email);
    const connections = new FakeConnections();
    connections.rows.push(connectedRow({ tenantId, status: "pending_token" }));
    const service = new MetaWhatsappMessagingService(
      new MetaCloudProvider(connections as any, async () => graphOk(), () => "t"),
      new FakeConversations() as any,
      new FakeMessages() as any,
    );
    await assert.rejects(
      () => service.sendFromAuth({ email, role: "subscriber" }, { to: "5551999887766", text: "x" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "not_connected",
    );
  });

  it("teste de lab envia pelo connectionId e phoneNumberId escolhidos", async () => {
    const email = "phase6-lab-from@example.com";
    const tenantId = deriveStableMetaTenantId(email);
    writePhoneIdentity(tenantId, "phone-drax", { inboxEnabled: true, channelName: "Drax" });
    try {
      const tokWalkup = encryptMetaToken("tok-walkup");
      const tokDrax = encryptMetaToken("tok-drax");
      const connections = new FakeConnections();
      connections.rows.push(
        connectedRow({
          id: "conn-drax",
          tenantId,
          ownerEmail: email,
          phoneNumberId: "phone-drax",
          accessTokenEncrypted: tokDrax,
        }),
        connectedRow({
          id: "conn-walkup",
          tenantId,
          ownerEmail: email,
          phoneNumberId: "phone-walkup",
          accessTokenEncrypted: tokWalkup,
        }),
      );
      const conversations = new FakeConversations();
      const messages = new FakeMessages();
      const calls: Array<{ phoneNumberId: string; token: string }> = [];
      const provider = new MetaCloudProvider(
        connections as any,
        async (input: { phoneNumberId: string; token: string }) => {
          calls.push({ phoneNumberId: input.phoneNumberId, token: input.token });
          return graphOk("wamid.FROM");
        },
        (encrypted: string) => (encrypted === tokWalkup ? "tok-walkup" : "tok-drax"),
      );
      const service = new MetaWhatsappMessagingService(provider, conversations as any, messages as any);
      const result = await service.sendFromAuth(
        { email, role: "subscriber" },
        {
          to: "5551999887766",
          type: "text",
          text: "ping walkup",
          connectionId: "conn-walkup",
          phoneNumberId: "phone-walkup",
        },
      );
      assert.equal(result.messageId, "wamid.FROM");
      assert.equal(result.connectionId, "conn-walkup");
      assert.equal(result.phoneNumberId, "phone-walkup");
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.phoneNumberId, "phone-walkup");
      assert.equal(calls[0]?.token, "tok-walkup");
      assert.equal(conversations.rows[0]?.connectionId, "conn-walkup");
      assert.equal(conversations.rows[0]?.phoneNumberId, "phone-walkup");
    } finally {
      purgePhoneIdentities(tenantId);
    }
  });

  it("resposta do Inbox corrige conexão antiga pelo número receptor", async () => {
    const email = "phase6-inbox-stale-connection@example.com";
    const tenantId = deriveStableMetaTenantId(email);
    writePhoneIdentity(tenantId, "phone-walkup", { inboxEnabled: true, channelName: "Walkup" });
    try {
      const connections = new FakeConnections();
      connections.rows.push(
        connectedRow({
          id: "conn-drax",
          tenantId,
          ownerEmail: email,
          phoneNumberId: "phone-drax",
          accessTokenEncrypted: "enc-drax",
        }),
        connectedRow({
          id: "conn-walkup",
          tenantId,
          ownerEmail: email,
          phoneNumberId: "phone-walkup",
          accessTokenEncrypted: "enc-walkup",
        }),
      );
      const conversations = new FakeConversations();
      const stale = await conversations.upsertForContact({
        tenantId,
        connectionId: "conn-drax",
        phoneNumberId: "phone-walkup",
        contactWaId: "5551999887766",
        inbound: true,
        atIso: "2026-09-01T12:00:00.000Z",
      });
      const messages = new FakeMessages();
      const calls: Array<{ token: string; phoneNumberId: string }> = [];
      const provider = new MetaCloudProvider(
        connections as any,
        async (input: { token: string; phoneNumberId: string }) => {
          calls.push(input);
          return graphOk("wamid.WALKUP");
        },
        (encrypted: string) => (encrypted === "enc-walkup" ? "tok-walkup" : "tok-drax"),
      );
      const service = new MetaWhatsappMessagingService(provider, conversations as any, messages as any);
      const result = await service.sendFromAuth(
        { email, role: "subscriber" },
        {
          conversationId: stale.record.id,
          to: "5551999887766",
          type: "text",
          text: "Resposta pelo número Walkup",
        },
      );

      assert.equal(result.connectionId, "conn-walkup");
      assert.equal(calls[0]?.token, "tok-walkup");
      assert.equal(calls[0]?.phoneNumberId, "phone-walkup");
      assert.equal(conversations.rows[0]?.connectionId, "conn-walkup");
    } finally {
      purgePhoneIdentities(tenantId);
    }
  });
});

describe("fase 6 inbox inbound/status", () => {
  beforeEach(() => {
    writePhoneIdentity(TENANT_A, "phone-a", { inboxEnabled: true, channelName: "Loja" });
    writePhoneIdentity(TENANT_A, "phone-chip", { inboxEnabled: true, channelName: "Chip" });
  });
  afterEach(() => {
    purgePhoneIdentities(TENANT_A);
  });

  it("persiste inbound e não duplica wamid", async () => {
    const conversations = new FakeConversations();
    const messages = new FakeMessages();
    const inbox = new MetaWhatsappWebhookInboxService(conversations as any, messages as any);
    const event = {
      eventKey: "msg:1",
      eventType: "messages",
      wabaId: "waba-a",
      phoneNumberId: "phone-a",
      messageId: "wamid.IN",
      status: null,
      timestamp: "1710000000",
      recipientId: null,
      conversationId: null,
      pricingCategory: null,
      errorCode: null,
      qualityRating: null,
      verifiedName: null,
      messageType: "text",
      fromWaId: "5551999111111",
      textContent: "oi",
      contactName: "Ana",
    };
    await inbox.persistInbound({ connection: connectedRow(), event: event as any });
    await inbox.persistInbound({ connection: connectedRow(), event: event as any });
    assert.equal(messages.rows.length, 1);
    assert.equal(messages.rows[0].textContent, "oi");
    assert.equal(conversations.rows.length, 1);
    assert.equal(conversations.rows[0].unreadCount, 1);
    assert.equal(conversations.rows[0].contactName, "Ana");
    assert.equal(conversations.rows[0].phoneNumberId, "phone-a");
  });

  it("grava a conversa no phoneNumberId do webhook, não no da conexão", async () => {
    const conversations = new FakeConversations();
    const messages = new FakeMessages();
    const inbox = new MetaWhatsappWebhookInboxService(conversations as any, messages as any);
    await inbox.persistInbound({
      connection: connectedRow({ phoneNumberId: "phone-conexao" }),
      event: {
        eventKey: "msg:2",
        eventType: "messages",
        wabaId: "waba-a",
        phoneNumberId: "phone-chip",
        messageId: "wamid.CHIP",
        status: null,
        timestamp: "1710000000",
        recipientId: null,
        conversationId: null,
        pricingCategory: null,
        errorCode: null,
        qualityRating: null,
        verifiedName: null,
        messageType: "text",
        fromWaId: "5551999111111",
        textContent: "oi",
        contactName: "Ana",
      } as any,
    });
    assert.equal(conversations.rows[0]?.phoneNumberId, "phone-chip");
    assert.equal(messages.rows[0]?.toWaId, "phone-chip");
  });

  it("não persiste inbound se o Inbox do chip estiver desligado", async () => {
    writePhoneIdentity(TENANT_A, "phone-a", { inboxEnabled: false });
    const conversations = new FakeConversations();
    const messages = new FakeMessages();
    const inbox = new MetaWhatsappWebhookInboxService(conversations as any, messages as any);
    await inbox.persistInbound({
      connection: connectedRow(),
      event: {
        eventType: "messages",
        phoneNumberId: "phone-a",
        messageId: "wamid.OFF",
        fromWaId: "5551999111111",
        messageType: "text",
        textContent: "oi",
        timestamp: "1710000000",
      } as any,
    });
    assert.equal(conversations.rows.length, 0);
    assert.equal(messages.rows.length, 0);
  });

  it("status sent/delivered/read e ignora regressão", async () => {
    const conversations = new FakeConversations();
    const messages = new FakeMessages();
    messages.rows.push({
      id: "m1",
      tenantId: TENANT_A,
      conversationId: "c1",
      connectionId: "conn-a",
      wamid: "wamid.OUT",
      direction: "outbound",
      type: "text",
      status: "accepted",
      fromWaId: "phone-a",
      toWaId: "5551",
      textContent: "x",
      templateName: null,
      templateLanguage: null,
      provider: "meta-cloud",
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: "",
      updatedAt: "",
    });
    const inbox = new MetaWhatsappWebhookInboxService(conversations as any, messages as any);
    const base = {
      eventKey: "s",
      eventType: "statuses",
      wabaId: "waba-a",
      phoneNumberId: "phone-a",
      messageId: "wamid.OUT",
      timestamp: "1710000001",
      recipientId: "5551",
      conversationId: null,
      pricingCategory: null,
      errorCode: null,
      qualityRating: null,
      verifiedName: null,
      messageType: null,
      fromWaId: null,
      textContent: null,
      contactName: null,
    };
    await inbox.applyStatus({ connection: connectedRow(), event: { ...base, status: "sent" } as any });
    await inbox.applyStatus({ connection: connectedRow(), event: { ...base, status: "delivered" } as any });
    await inbox.applyStatus({ connection: connectedRow(), event: { ...base, status: "read" } as any });
    await inbox.applyStatus({ connection: connectedRow(), event: { ...base, status: "delivered" } as any });
    assert.equal(messages.rows[0].status, "read");
    await inbox.applyStatus({ connection: connectedRow(), event: { ...base, status: "failed" } as any });
    assert.equal(messages.rows[0].status, "read");
  });

  it("status failed a partir de sent", async () => {
    const messages = new FakeMessages();
    messages.rows.push({
      id: "m2",
      tenantId: TENANT_A,
      conversationId: "c1",
      connectionId: "conn-a",
      wamid: "wamid.F",
      direction: "outbound",
      type: "text",
      status: "sent",
      fromWaId: "phone-a",
      toWaId: "5551",
      textContent: "x",
      templateName: null,
      templateLanguage: null,
      provider: "meta-cloud",
      sentAt: "2026-01-01T00:00:00.000Z",
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: "",
      updatedAt: "",
    });
    const inbox = new MetaWhatsappWebhookInboxService(new FakeConversations() as any, messages as any);
    await inbox.applyStatus({
      connection: connectedRow(),
      event: {
        eventType: "statuses",
        messageId: "wamid.F",
        status: "failed",
        timestamp: "1",
      } as any,
    });
    assert.equal(messages.rows[0].status, "failed");
  });

  it("status sem wamid local cria a conversa se o Inbox do chip estiver ligado", async () => {
    const conversations = new FakeConversations();
    const messages = new FakeMessages();
    const inbox = new MetaWhatsappWebhookInboxService(conversations as any, messages as any);
    await inbox.applyStatus({
      connection: connectedRow(),
      event: {
        eventType: "statuses",
        messageId: "wamid.MISSING",
        status: "sent",
        timestamp: "1710000001",
        recipientId: "5551999111111",
        phoneNumberId: "phone-a",
      } as any,
    });
    assert.equal(conversations.rows.length, 1);
    assert.equal(conversations.rows[0].contactWaId, "5551999111111");
    assert.equal(conversations.rows[0].phoneNumberId, "phone-a");
  });
});

describe("fase 6 webhook usa inbox", () => {
  const previousSecret = process.env.META_APP_SECRET;

  before(() => {
    process.env.META_APP_SECRET = "test-app-secret";
  });
  after(() => {
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  });

  it("inbound do webhook chega no inbox do tenant certo", async () => {
    const inbound: string[] = [];
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const service = new MetaWhatsappWebhookService(
      connections as any,
      {
        insertIfNew: async () => ({ duplicate: false, id: "e1" }),
      } as any,
      {
        persistInbound: async ({ connection, event }) => {
          inbound.push(`${connection.tenantId}:${event.messageId}`);
        },
        applyStatus: async () => undefined,
      },
    );
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-a",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "phone-a" },
                contacts: [{ wa_id: "5551999111111", profile: { name: "Ana" } }],
                messages: [
                  {
                    id: "wamid.IN2",
                    timestamp: "1710000000",
                    type: "text",
                    from: "5551999111111",
                    text: { body: "hello" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const raw = Buffer.from(JSON.stringify(payload), "utf8");
    const result = await service.processPostedEvent({
      rawBody: raw,
      signatureHeader: sign("test-app-secret", raw),
    });
    assert.equal(result.httpStatus, 200);
    assert.deepEqual(inbound, [`${TENANT_A}:wamid.IN2`]);
    const parsed = parseMetaWebhookPayload(payload, "h");
    assert.equal(parsed[0].textContent, "hello");
    assert.equal(parsed[0].contactName, "Ana");
  });
});
