import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { MetaConversationRecord, MetaMessageRecord } from "./meta-whatsapp-messaging.types";
import { MetaWhatsappInboxService } from "./meta-whatsapp-inbox.service";
import { MetaWhatsappMessagingService } from "./meta-whatsapp-messaging.service";
import { MetaWhatsappWebhookInboxService } from "./meta-whatsapp-webhook-inbox.service";
import { MetaCloudProvider } from "../whatsapp/meta-cloud-provider";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { stripMetaSecrets } from "./meta-whatsapp-connection.service";
import { resolveCustomerCareWindow } from "./meta-whatsapp-customer-care-window";
import { windowStateFromCare, toPublicInboxConversation, toPublicInboxMessage } from "./meta-whatsapp-inbox.types";
import type { MetaGraphMessagesResult } from "./meta-whatsapp-graph-messages.client";
import { purgePhoneIdentities, writePhoneIdentity } from "./meta-whatsapp-phone-identity.store";

const EMAIL_A = "phase8-a@example.com";
const EMAIL_B = "phase8-b@example.com";
const TENANT_A = deriveStableMetaTenantId(EMAIL_A);
const TENANT_B = deriveStableMetaTenantId(EMAIL_B);

function auth(email: string): WabaRequestAuth {
  return { email, role: "subscriber" };
}

function connectedRow(overrides: Partial<MetaWhatsappConnectionRecord> = {}): MetaWhatsappConnectionRecord {
  return {
    id: "conn-a",
    tenantId: TENANT_A,
    ownerEmail: EMAIL_A,
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

function conv(overrides: Partial<MetaConversationRecord> = {}): MetaConversationRecord {
  return {
    id: "conv-1",
    tenantId: TENANT_A,
    connectionId: "conn-a",
    phoneNumberId: "phone-a",
    contactWaId: "5551999887766",
    contactPhone: "5551999887766",
    contactName: "Ana",
    status: "open",
    assignedTo: null,
    lastMessageAt: "2026-08-25T12:00:00.000Z",
    lastInboundAt: "2026-08-25T12:00:00.000Z",
    lastOutboundAt: null,
    unreadCount: 2,
    humanTakeover: false,
    lastMessagePreview: "Oi",
    createdAt: "2026-08-25T11:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
    ...overrides,
  };
}

function msg(overrides: Partial<MetaMessageRecord> = {}): MetaMessageRecord {
  return {
    id: "msg-1",
    tenantId: TENANT_A,
    conversationId: "conv-1",
    connectionId: "conn-a",
    wamid: "wamid.1",
    direction: "inbound",
    type: "text",
    status: "accepted",
    fromWaId: "5551999887766",
    toWaId: "phone-a",
    textContent: "Oi",
    templateName: null,
    templateLanguage: null,
    provider: "meta-cloud",
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
    ...overrides,
  };
}

class FakeConnections {
  rows: MetaWhatsappConnectionRecord[] = [];
  async findConnectedByTenant(tenantId: string) {
    return (
      this.rows
        .filter((row) => row.tenantId === tenantId && row.status === "connected" && !row.disconnectedAt)
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0] || null
    );
  }
  async findOpenByTenant(tenantId: string) {
    return (
      this.rows
        .filter(
          (row) =>
            row.tenantId === tenantId &&
            !row.disconnectedAt &&
            (row.status === "pending_token" ||
              row.status === "pending_confirmation" ||
              row.status === "connected"),
        )
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0] || null
    );
  }
  async listInboxConnections(tenantId: string) {
    return this.rows
      .filter(
        (row) =>
          row.tenantId === tenantId &&
          !row.disconnectedAt &&
          (row.status === "connected" || row.status === "pending_confirmation"),
      )
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }
  async findByIdForTenant(tenantId: string, id: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) || null;
  }
}

class FakeConversations {
  rows: MetaConversationRecord[] = [];
  async findByIdForTenant(tenantId: string, id: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) || null;
  }
  async findByTenantContact(tenantId: string, contactWaId: string) {
    return (
      this.rows
        .filter((row) => row.tenantId === tenantId && row.contactWaId === contactWaId)
        .sort((a, b) => String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || "")))[0] ||
      null
    );
  }
  async findByTenantConnectionContact(tenantId: string, connectionId: string, contactWaId: string) {
    return (
      this.rows.find(
        (row) => row.tenantId === tenantId && row.connectionId === connectionId && row.contactWaId === contactWaId,
      ) || null
    );
  }
  async listForInbox(input: {
    tenantId: string;
    connectionId?: string;
    connectionIds?: string[];
    filter: string;
    assignedTo?: string | null;
    phoneNumberId?: string | null;
    includePhoneNumberIds?: string[];
    excludePhoneNumberIds?: string[];
    limit: number;
    offset: number;
  }) {
    let rows = this.rows
      .filter((row) => row.tenantId === input.tenantId)
      .sort((a, b) => String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || "")));
    if (input.connectionIds?.length) {
      const allowed = new Set(input.connectionIds);
      rows = rows.filter((row) => allowed.has(row.connectionId));
    } else if (input.connectionId) {
      rows = rows.filter((row) => row.connectionId === input.connectionId);
    }
    if (input.filter === "unread") rows = rows.filter((row) => row.unreadCount > 0);
    if (input.filter === "open" || input.filter === "pending" || input.filter === "closed") {
      rows = rows.filter((row) => row.status === input.filter);
    }
    if (input.filter === "mine") rows = rows.filter((row) => row.assignedTo === input.assignedTo);
    if (input.phoneNumberId) {
      rows = rows.filter((row) => row.phoneNumberId === input.phoneNumberId);
    } else if (input.includePhoneNumberIds) {
      const allowed = new Set(input.includePhoneNumberIds);
      rows = rows.filter((row) => Boolean(row.phoneNumberId) && allowed.has(row.phoneNumberId as string));
    } else if (input.excludePhoneNumberIds && input.excludePhoneNumberIds.length) {
      const blocked = new Set(input.excludePhoneNumberIds);
      rows = rows.filter((row) => !row.phoneNumberId || !blocked.has(row.phoneNumberId));
    }
    return rows.slice(input.offset, input.offset + input.limit);
  }
  async listUnreadByPhone(tenantId: string, connectionIds?: string[]) {
    const allowed = connectionIds?.length ? new Set(connectionIds) : null;
    return this.rows
      .filter(
        (row) =>
          row.tenantId === tenantId &&
          row.unreadCount > 0 &&
          (!allowed || allowed.has(row.connectionId)),
      )
      .map((row) => ({ phoneNumberId: row.phoneNumberId, unreadCount: row.unreadCount }));
  }
  async markRead(tenantId: string, id: string) {
    const row = await this.findByIdForTenant(tenantId, id);
    if (!row) return null;
    row.unreadCount = 0;
    return row;
  }
  async patchStatus(tenantId: string, id: string, status: MetaConversationRecord["status"]) {
    const row = await this.findByIdForTenant(tenantId, id);
    if (!row) return null;
    row.status = status;
    return row;
  }
  async assign(tenantId: string, id: string, assignedTo: string | null, humanTakeover: boolean) {
    const row = await this.findByIdForTenant(tenantId, id);
    if (!row) return null;
    row.assignedTo = assignedTo;
    row.humanTakeover = humanTakeover;
    return row;
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
    lastMessagePreview?: string | null;
  }) {
    const existing =
      (await this.findByTenantContact(input.tenantId, input.contactWaId)) ||
      (await this.findByTenantConnectionContact(input.tenantId, input.connectionId, input.contactWaId));
    if (existing) {
      existing.lastMessageAt = input.atIso;
      if (input.phoneNumberId) existing.phoneNumberId = input.phoneNumberId;
      if (input.lastMessagePreview !== undefined) existing.lastMessagePreview = input.lastMessagePreview || null;
      if (input.inbound) {
        existing.lastInboundAt = input.atIso;
        existing.unreadCount += 1;
      }
      if (input.outbound) existing.lastOutboundAt = input.atIso;
      if (input.contactName) existing.contactName = input.contactName;
      return { created: false, record: existing };
    }
    const record = conv({
      id: `conv-${this.rows.length + 1}`,
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      phoneNumberId: input.phoneNumberId || null,
      contactWaId: input.contactWaId,
      contactPhone: input.contactPhone || input.contactWaId,
      contactName: input.contactName || null,
      lastMessagePreview: input.lastMessagePreview || null,
      lastMessageAt: input.atIso,
      lastInboundAt: input.inbound ? input.atIso : null,
      lastOutboundAt: input.outbound ? input.atIso : null,
      unreadCount: input.inbound ? 1 : 0,
    });
    this.rows.push(record);
    return { created: true, record };
  }
}

class FakeMessages {
  rows: MetaMessageRecord[] = [];
  async findByTenantWamid(tenantId: string, wamid: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.wamid === wamid) || null;
  }
  async listByConversation(tenantId: string, conversationId: string, limit: number) {
    return this.rows
      .filter((row) => row.tenantId === tenantId && row.conversationId === conversationId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .slice(-limit);
  }
  async insert(input: Partial<MetaMessageRecord>) {
    const record = msg({
      id: `msg-${this.rows.length + 1}`,
      status: "queued",
      ...input,
    } as MetaMessageRecord);
    this.rows.push(record);
    return { record, duplicate: false };
  }
  async updateAfterGraph(_tenantId: string, id: string, patch: Partial<MetaMessageRecord>) {
    const row = this.rows.find((item) => item.id === id);
    if (row) Object.assign(row, patch);
    return row || null;
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

function inboxOf(connections: FakeConnections, conversations: FakeConversations, messages: FakeMessages, messaging?: MetaWhatsappMessagingService) {
  return new MetaWhatsappInboxService(
    connections as any,
    conversations as any,
    messages as any,
    messaging || (new MetaWhatsappMessagingService() as any),
  );
}

function enableInbox(phoneNumberId = "phone-a") {
  writePhoneIdentity(TENANT_A, phoneNumberId, {
    inboxEnabled: true,
    channelName: "Loja",
    displayPhoneNumber: "5551999000000",
  });
}

describe("fase 8 janela", () => {
  it("janela open / closed / unknown", () => {
    const open = resolveCustomerCareWindow({ lastInboundAt: new Date().toISOString() });
    const closed = resolveCustomerCareWindow({
      lastInboundAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    const unknown = resolveCustomerCareWindow({ lastInboundAt: null });
    assert.equal(windowStateFromCare(open), "OPEN");
    assert.equal(windowStateFromCare(closed), "CLOSED");
    assert.equal(windowStateFromCare(unknown), "UNKNOWN");
  });
});

describe("fase 8 listagem e isolamento", () => {
  beforeEach(() => enableInbox());
  afterEach(() => purgePhoneIdentities(TENANT_A));

  it("lista conversas do tenant ordered e pagina", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv({ id: "c1", lastMessageAt: "2026-08-25T10:00:00.000Z" }));
    conversations.rows.push(conv({ id: "c2", lastMessageAt: "2026-08-25T12:00:00.000Z", unreadCount: 0 }));
    conversations.rows.push(conv({ id: "other", tenantId: TENANT_B, connectionId: "conn-b" }));
    const service = inboxOf(connections, conversations, new FakeMessages());
    const result = await service.listConversations(auth(EMAIL_A), { limit: 1, offset: 0 });
    assert.equal(result.conversations.length, 1);
    assert.equal(result.conversations[0].id, "c2");
    assert.equal(result.page.hasMore, true);
    assert.equal(result.conversations[0].contactName, "Ana");
    assert.equal("tenantId" in result.conversations[0], false);
    assert.equal(/access_token/i.test(JSON.stringify(stripMetaSecrets(result))), false);
  });

  it("IDOR: tenant A não abre conversa do tenant B", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv({ id: "conv-b", tenantId: TENANT_B, connectionId: "conn-b" }));
    const service = inboxOf(connections, conversations, new FakeMessages());
    await assert.rejects(
      () => service.listMessages(auth(EMAIL_A), "conv-b", {}),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "conversation_not_found",
    );
  });

  it("sem conexão connected recusa a Inbox", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow({ status: "pending_token" }));
    const service = inboxOf(connections, new FakeConversations(), new FakeMessages());
    await assert.rejects(
      () => service.listConversations(auth(EMAIL_A), {}),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "not_connected",
    );
  });
});

describe("fase 8 histórico unread status assign", () => {
  beforeEach(() => enableInbox());
  afterEach(() => purgePhoneIdentities(TENANT_A));
  it("histórico só do tenant e DTO sem token", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv());
    const messages = new FakeMessages();
    messages.rows.push(msg());
    messages.rows.push(msg({ id: "other", tenantId: TENANT_B, conversationId: "conv-b", textContent: "segredo" }));
    const service = inboxOf(connections, conversations, messages);
    const result = await service.listMessages(auth(EMAIL_A), "conv-1", {});
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].text, "Oi");
    assert.equal("tenantId" in result.messages[0], false);
  });

  it("marcar como lida zera unread interno", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv({ unreadCount: 4 }));
    const service = inboxOf(connections, conversations, new FakeMessages());
    const updated = await service.markRead(auth(EMAIL_A), "conv-1");
    assert.equal(updated.unreadCount, 0);
  });

  it("status open pending closed", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv());
    const service = inboxOf(connections, conversations, new FakeMessages());
    assert.equal((await service.patchStatus(auth(EMAIL_A), "conv-1", { status: "pending" })).status, "pending");
    assert.equal((await service.patchStatus(auth(EMAIL_A), "conv-1", { status: "closed" })).status, "closed");
    assert.equal((await service.patchStatus(auth(EMAIL_A), "conv-1", { status: "open" })).status, "open");
  });

  it("assign assume human_takeover e unassign libera", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv());
    const service = inboxOf(connections, conversations, new FakeMessages());
    const assumed = await service.assign(auth(EMAIL_A), "conv-1", { action: "assume" });
    assert.equal(assumed.assignedTo, EMAIL_A);
    assert.equal(assumed.humanTakeover, true);
    const released = await service.assign(auth(EMAIL_A), "conv-1", { action: "release" });
    assert.equal(released.assignedTo, null);
    assert.equal(released.humanTakeover, false);
  });
});

describe("fase 8 envio", () => {
  beforeEach(() => enableInbox());
  afterEach(() => purgePhoneIdentities(TENANT_A));
  it("resposta texto reutiliza messaging e aparece no histórico", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv());
    const messages = new FakeMessages();
    messages.rows.push(msg());
    const provider = new MetaCloudProvider(connections as any, async () => graphOk("wamid.INBOX"), () => "tok");
    const messaging = new MetaWhatsappMessagingService(provider, conversations as any, messages as any, {
      assertSendable: async () => conv(),
    } as any);
    const service = inboxOf(connections, conversations, messages, messaging);
    const result = await service.sendMessage(auth(EMAIL_A), "conv-1", { type: "text", text: "retorno" });
    assert.equal(result.messageId, "wamid.INBOX");
    assert.equal(messages.rows.some((row) => row.textContent === "retorno" && row.direction === "outbound"), true);
    assert.equal(result.conversationId, "conv-1");
  });

  it("tenant A não responde conversa do B", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv({ id: "conv-b", tenantId: TENANT_B, connectionId: "conn-b" }));
    const service = inboxOf(connections, conversations, new FakeMessages());
    await assert.rejects(
      () => service.sendMessage(auth(EMAIL_A), "conv-b", { type: "text", text: "x" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "conversation_not_found",
    );
  });

  it("resposta template só com assertSendable do tenant", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv());
    const messages = new FakeMessages();
    let asserted = false;
    const provider = new MetaCloudProvider(connections as any, async () => graphOk("wamid.TPL"), () => "tok");
    const messaging = new MetaWhatsappMessagingService(provider, conversations as any, messages as any, {
      assertSendable: async (input: { tenantId: string; name: string }) => {
        asserted = true;
        assert.equal(input.tenantId, TENANT_A);
        assert.equal(input.name, "retorno_lead");
        return { status: "APPROVED" };
      },
    } as any);
    const service = inboxOf(connections, conversations, messages, messaging);
    const result = await service.sendMessage(auth(EMAIL_A), "conv-1", {
      type: "template",
      template: { name: "retorno_lead", language: "pt_BR" },
    });
    assert.equal(asserted, true);
    assert.equal(result.messageId, "wamid.TPL");
  });
});

describe("fase 8 DTO público", () => {
  it("conversa e mensagem não expõem token", () => {
    const publicConv = toPublicInboxConversation(
      conv({ assignedTo: EMAIL_A, humanTakeover: true }),
      resolveCustomerCareWindow({ lastInboundAt: new Date().toISOString() }),
    );
    const publicMsg = toPublicInboxMessage(msg({ status: "failed", errorMessage: "Não foi possível enviar." }));
    assert.equal(publicConv.humanTakeover, true);
    assert.equal(publicMsg.errorMessage, "Não foi possível enviar.");
    assert.equal(JSON.stringify(publicConv).includes("access_token"), false);
  });
});

describe("fase 8 canais do Inbox", () => {
  it("só incorpora o número no Inbox depois de ligar o switch", async () => {
    purgePhoneIdentities(TENANT_A);
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    conversations.rows.push(conv());
    const service = inboxOf(connections, conversations, new FakeMessages());
    const off = await service.listConversations(auth(EMAIL_A), {});
    assert.equal(off.conversations.length, 0);
    assert.equal(off.channels.length, 0);

    writePhoneIdentity(TENANT_A, "phone-a", { inboxEnabled: true, channelName: "Drax" });
    const listed = await service.listConversations(auth(EMAIL_A), {});
    assert.equal(listed.conversations[0]?.phoneNumberId, "phone-a");
    assert.equal(listed.conversations[0]?.agentKind, "bot");
    assert.equal(
      listed.channels.some((item: { phoneNumberId: string }) => item.phoneNumberId === "phone-a"),
      true,
    );

    writePhoneIdentity(TENANT_A, "phone-a", { inboxEnabled: false, channelName: "Drax" });
    const hidden = await service.listConversations(auth(EMAIL_A), {});
    assert.equal(hidden.conversations.length, 0);
    assert.equal(hidden.channels.length, 0);
    purgePhoneIdentities(TENANT_A);
  });

  it("WABA pending_confirmation ainda serve o Inbox se o switch estiver ligado", async () => {
    purgePhoneIdentities(TENANT_A);
    writePhoneIdentity(TENANT_A, "phone-a", {
      inboxEnabled: true,
      channelName: "Drax",
      displayPhoneNumber: "+55 51 8200-1279",
    });
    const connections = new FakeConnections();
    connections.rows.push(connectedRow({ status: "pending_confirmation" }));
    const conversations = new FakeConversations();
    conversations.rows.push(conv());
    const service = inboxOf(connections, conversations, new FakeMessages());
    const listed = await service.listConversations(auth(EMAIL_A), {});
    assert.equal(listed.connected, true);
    assert.equal(listed.channels[0]?.displayPhoneNumber, "+55 51 8200-1279");
    assert.equal(listed.conversations.length, 1);
    purgePhoneIdentities(TENANT_A);
  });

  it("ponta a ponta: switch cinza, ligar, receber webhook, listar e responder", async () => {
    purgePhoneIdentities(TENANT_A);
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const conversations = new FakeConversations();
    const messages = new FakeMessages();
    const provider = new MetaCloudProvider(connections as any, async () => graphOk("wamid.E2E"), () => "tok");
    const messaging = new MetaWhatsappMessagingService(
      provider,
      conversations as any,
      messages as any,
      { assertSendable: async () => ({ status: "APPROVED" }) } as any,
    );
    const inbox = inboxOf(connections, conversations, messages, messaging);
    const webhookInbox = new MetaWhatsappWebhookInboxService(conversations as any, messages as any);

    const off = await inbox.listConversations(auth(EMAIL_A), {});
    assert.equal(off.conversations.length, 0);
    assert.equal(off.channels.length, 0);

    await webhookInbox.persistInbound({
      connection: connectedRow(),
      event: {
        eventKey: "msg:skip",
        eventType: "messages",
        wabaId: "waba-a",
        phoneNumberId: "phone-a",
        messageId: "wamid.SKIP",
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
        textContent: "antes de ligar",
        contactName: "Ana",
      } as any,
    });
    assert.equal(conversations.rows.length, 0);

    writePhoneIdentity(TENANT_A, "phone-a", {
      inboxEnabled: true,
      channelName: "Drax Sistema",
      displayPhoneNumber: "+55 51 8200-1279",
    });

    const labSend = await messaging.sendFromAuth(auth(EMAIL_A), {
      to: "5551999111111",
      type: "text",
      text: "mensagem teste",
    });
    assert.ok(labSend.messageId);
    const afterSend = await inbox.listConversations(auth(EMAIL_A), {});
    assert.equal(afterSend.conversations.length, 1);
    assert.equal(afterSend.channels[0]?.displayPhoneNumber, "+55 51 8200-1279");
    assert.equal(afterSend.channels[0]?.name, "Drax Sistema");
    assert.match(String(afterSend.conversations[0]?.channelPhone || ""), /8200-1279/);

    await webhookInbox.persistInbound({
      connection: connectedRow(),
      event: {
        eventKey: "msg:in",
        eventType: "messages",
        wabaId: "waba-a",
        phoneNumberId: "phone-a",
        messageId: "wamid.IN",
        status: null,
        timestamp: "1710000001",
        recipientId: null,
        conversationId: null,
        pricingCategory: null,
        errorCode: null,
        qualityRating: null,
        verifiedName: null,
        messageType: "text",
        fromWaId: "5551999111111",
        textContent: "resposta do cliente",
        contactName: "Ana",
      } as any,
    });
    const inbound = await inbox.listConversations(auth(EMAIL_A), {});
    assert.equal(inbound.conversations[0]?.lastMessagePreview, "resposta do cliente");

    const reply = await inbox.sendMessage(auth(EMAIL_A), inbound.conversations[0].id, {
      type: "text",
      text: "ok",
    });
    assert.equal(reply.messageId, "wamid.E2E");
    purgePhoneIdentities(TENANT_A);
  });

  it("envio Cloud e resposta no Inbox usam o chip ligado mesmo se a conexão tiver outro phone id", async () => {
    writePhoneIdentity(TENANT_A, "phone-chip", {
      inboxEnabled: true,
      channelName: "Drax Sistema",
      displayPhoneNumber: "+55 51 8200-1279",
    });
    const connections = new FakeConnections();
    connections.rows.push(connectedRow({ phoneNumberId: "phone-conn" }));
    const conversations = new FakeConversations();
    const messages = new FakeMessages();
    const provider = new MetaCloudProvider(connections as any, async () => graphOk("wamid.LAB"), () => "tok");
    const messaging = new MetaWhatsappMessagingService(
      provider,
      conversations as any,
      messages as any,
      { assertSendable: async () => ({ status: "APPROVED" }) } as any,
    );
    const inbox = inboxOf(connections, conversations, messages, messaging);

    const labSend = await messaging.sendFromAuth(auth(EMAIL_A), {
      to: "5551999111111",
      type: "text",
      text: "mensagem teste",
    });
    assert.ok(labSend.messageId);
    const listed = await inbox.listConversations(auth(EMAIL_A), {});
    assert.equal(listed.conversations.length, 1);
    assert.equal(listed.conversations[0]?.phoneNumberId, "phone-chip");
    assert.equal(listed.channels[0]?.phoneNumberId, "phone-chip");

    conversations.rows[0].phoneNumberId = "phone-conn";
    const aliased = await inbox.listConversations(auth(EMAIL_A), {});
    assert.equal(aliased.conversations.length, 1);
    const reply = await inbox.sendMessage(auth(EMAIL_A), aliased.conversations[0].id, {
      type: "text",
      text: "resposta pelo inbox",
    });
    assert.equal(reply.messageId, "wamid.LAB");
    purgePhoneIdentities(TENANT_A);
  });

  it("lista e responde conversa gravada em outra conexão do mesmo tenant", async () => {
    writePhoneIdentity(TENANT_A, "phone-a", {
      inboxEnabled: true,
      channelName: "Drax Sistema",
      displayPhoneNumber: "+55 51 8200-1279",
    });
    const connections = new FakeConnections();
    connections.rows.push(
      connectedRow({ id: "conn-old", phoneNumberId: "phone-a", updatedAt: "2026-01-01T00:00:00.000Z" }),
    );
    connections.rows.push(
      connectedRow({ id: "conn-new", phoneNumberId: "phone-a", updatedAt: "2026-08-28T00:00:00.000Z" }),
    );
    const conversations = new FakeConversations();
    conversations.rows.push(conv({ connectionId: "conn-old" }));
    const messages = new FakeMessages();
    const provider = new MetaCloudProvider(connections as any, async () => graphOk("wamid.OLD"), () => "tok");
    const messaging = new MetaWhatsappMessagingService(
      provider,
      conversations as any,
      messages as any,
      { assertSendable: async () => ({ status: "APPROVED" }) } as any,
    );
    const inbox = inboxOf(connections, conversations, messages, messaging);
    const listed = await inbox.listConversations(auth(EMAIL_A), {});
    assert.equal(listed.conversations.length, 1);
    const reply = await inbox.sendMessage(auth(EMAIL_A), listed.conversations[0].id, {
      type: "text",
      text: "ok",
    });
    assert.equal(reply.messageId, "wamid.OLD");
    purgePhoneIdentities(TENANT_A);
  });
});
