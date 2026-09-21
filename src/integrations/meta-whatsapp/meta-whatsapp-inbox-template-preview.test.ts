import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accumulateInboxFilterCounts,
  emptyInboxFilterCounts,
  extractTemplateBodyText,
  fillTemplatePlaceholders,
  isGenericInboxPreview,
  renderTemplateBodyText,
} from "./meta-whatsapp-inbox-template-preview";
import { previewFromContent } from "./meta-whatsapp-inbox.types";
import { MetaWhatsappWebhookInboxService } from "./meta-whatsapp-webhook-inbox.service";
import { MetaWhatsappInboxService } from "./meta-whatsapp-inbox.service";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import { purgePhoneIdentities, writePhoneIdentity } from "./meta-whatsapp-phone-identity.store";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { MetaConversationRecord, MetaMessageRecord } from "./meta-whatsapp-messaging.types";

const EMAIL = "inbox-tpl@example.com";
const TENANT = deriveStableMetaTenantId(EMAIL);

function connection(): MetaWhatsappConnectionRecord {
  return {
    id: "conn-a",
    tenantId: TENANT,
    ownerEmail: EMAIL,
    metaBusinessId: "bm",
    wabaId: "waba-a",
    phoneNumberId: "phone-a",
    displayPhoneNumber: "5551999000000",
    verifiedName: "Relacionamento e Atendimento",
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
    createdAt: "2026-09-21T11:00:00.000Z",
    updatedAt: "2026-09-21T11:00:00.000Z",
    connectedAt: "2026-09-21T11:00:00.000Z",
    disconnectedAt: null,
  };
}

function conv(overrides: Partial<MetaConversationRecord> = {}): MetaConversationRecord {
  return {
    id: "conv-1",
    tenantId: TENANT,
    connectionId: "conn-a",
    phoneNumberId: "phone-a",
    contactWaId: "555184035014",
    contactPhone: "555184035014",
    contactName: null,
    status: "open",
    assignedTo: null,
    lastMessageAt: "2026-09-21T14:53:53.000Z",
    lastInboundAt: null,
    lastOutboundAt: "2026-09-21T14:53:53.000Z",
    unreadCount: 0,
    humanTakeover: false,
    lastMessagePreview: "Mensagem enviada",
    createdAt: "2026-09-21T14:53:53.000Z",
    updatedAt: "2026-09-21T14:53:53.000Z",
    ...overrides,
  };
}

class FakeConversations {
  rows: MetaConversationRecord[] = [];
  async findByIdForTenant(tenantId: string, id: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) || null;
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
    lastMessagePreview?: string | null;
    atIso: string;
    outbound?: boolean;
    contactName?: string | null;
  }) {
    const existing =
      (input.phoneNumberId &&
        (await this.findByTenantPhoneContact(input.tenantId, input.phoneNumberId, input.contactWaId))) ||
      (await this.findByTenantConnectionContact(input.tenantId, input.connectionId, input.contactWaId));
    if (existing) {
      if (input.lastMessagePreview !== undefined) existing.lastMessagePreview = input.lastMessagePreview || null;
      existing.lastMessageAt = input.atIso;
      return { record: existing, created: false };
    }
    const record = conv({
      id: `conv-${this.rows.length + 1}`,
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      phoneNumberId: input.phoneNumberId || null,
      contactWaId: input.contactWaId,
      lastMessagePreview: input.lastMessagePreview || null,
      lastMessageAt: input.atIso,
      contactName: input.contactName || null,
    });
    this.rows.push(record);
    return { record, created: true };
  }
  async patchLastMessagePreview(tenantId: string, id: string, lastMessagePreview: string | null) {
    const row = await this.findByIdForTenant(tenantId, id);
    if (!row) return null;
    row.lastMessagePreview = lastMessagePreview;
    return row;
  }
  async listForInbox(input: { tenantId: string; limit: number; offset: number }) {
    return this.rows
      .filter((row) => row.tenantId === input.tenantId)
      .slice(input.offset, input.offset + input.limit);
  }
  async countForInbox(input: { tenantId: string; assignedTo?: string | null }) {
    const counts = emptyInboxFilterCounts();
    for (const row of this.rows.filter((item) => item.tenantId === input.tenantId)) {
      accumulateInboxFilterCounts(counts, row, input.assignedTo);
    }
    return counts;
  }
  async listUnreadByPhone() {
    return [];
  }
}

class FakeMessages {
  rows: MetaMessageRecord[] = [];
  async findByTenantWamid(tenantId: string, wamid: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.wamid === wamid) || null;
  }
  async listByConversation(tenantId: string, conversationId: string) {
    return this.rows.filter((row) => row.tenantId === tenantId && row.conversationId === conversationId);
  }
  async insert(input: Partial<MetaMessageRecord>) {
    const record = {
      id: `msg-${this.rows.length + 1}`,
      tenantId: input.tenantId || TENANT,
      conversationId: String(input.conversationId || ""),
      connectionId: String(input.connectionId || ""),
      wamid: input.wamid || null,
      direction: input.direction || "outbound",
      type: input.type || "template",
      status: input.status || "accepted",
      fromWaId: input.fromWaId || null,
      toWaId: input.toWaId || null,
      textContent: input.textContent || null,
      templateName: input.templateName || null,
      templateLanguage: input.templateLanguage || null,
      provider: "meta-cloud",
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as MetaMessageRecord;
    this.rows.push(record);
    return { record, duplicate: false };
  }
  async applyWebhookStatus() {
    return { updated: false, record: null };
  }
}

class FakeConnections {
  rows = [connection()];
  async listInboxConnections() {
    return this.rows;
  }
  async findConnectedByTenant() {
    return this.rows[0] || null;
  }
  async findOpenByTenant() {
    return this.rows[0] || null;
  }
}

describe("preview do template no Inbox", () => {
  it("usa o corpo do template no preview, não o rótulo genérico", () => {
    assert.equal(
      previewFromContent({
        type: "template",
        templateName: "tocantins_sem_bt_v1_1",
        text: "Olá Maria, seu atendimento Tocantins já está em andamento.",
      }),
      "Olá Maria, seu atendimento Tocantins já está em andamento.",
    );
    assert.equal(isGenericInboxPreview("Mensagem enviada"), true);
    assert.equal(isGenericInboxPreview("Template: tocantins_sem_bt_v1_1"), true);
    assert.equal(isGenericInboxPreview("Olá Maria, seu atendimento Tocantins já está em andamento."), false);
  });

  it("interpola variáveis do corpo", () => {
    const body = extractTemplateBodyText([
      { type: "BODY", text: "Olá {{1}}, o protocolo {{2}} foi aberto." },
    ]);
    assert.equal(
      fillTemplatePlaceholders(body, ["Maria", "8821"]),
      "Olá Maria, o protocolo 8821 foi aberto.",
    );
    assert.equal(
      renderTemplateBodyText({
        bodyText: "Olá {{1}}, bem-vindo.",
        inspect: { bodyVariables: [{ index: 1, key: "nome" }] },
        lead: { nome: "Carlos", waId: "5551" },
      }),
      "Olá Carlos, bem-vindo.",
    );
  });

  it("status do disparo grava o texto do template na conversa e na thread", async () => {
    writePhoneIdentity(TENANT, "phone-a", { inboxEnabled: true, channelName: "Relacionamento" });
    const conversations = new FakeConversations();
    const messages = new FakeMessages();
    const inbox = new MetaWhatsappWebhookInboxService(
      conversations as any,
      messages as any,
      () => ({
        campaign: {
          templateId: "tpl-1",
          templateName: "tocantins_sem_bt_v1_1",
          language: "pt_BR",
          connectionId: "conn-a",
        },
        lead: { waId: "555184035014", nome: "Maria", wamid: "wamid.TPL" },
      }),
      async () => "Olá {{1}}, seu atendimento Tocantins já está em andamento.",
    );
    await inbox.applyStatus({
      connection: connection(),
      event: {
        eventType: "statuses",
        messageId: "wamid.TPL",
        status: "sent",
        timestamp: "1758462833",
        recipientId: "555184035014",
        phoneNumberId: "phone-a",
      } as any,
    });
    assert.equal(
      conversations.rows[0]?.lastMessagePreview,
      "Olá Maria, seu atendimento Tocantins já está em andamento.",
    );
    assert.equal(messages.rows.length, 1);
    assert.equal(messages.rows[0]?.textContent, "Olá Maria, seu atendimento Tocantins já está em andamento.");
    assert.equal(messages.rows[0]?.templateName, "tocantins_sem_bt_v1_1");
    purgePhoneIdentities(TENANT);
  });

  it("lista do atendimento devolve contadores e completa preview genérico", async () => {
    writePhoneIdentity(TENANT, "phone-a", { inboxEnabled: true, channelName: "Relacionamento" });
    const conversations = new FakeConversations();
    conversations.rows.push(conv());
    conversations.rows.push(conv({ id: "conv-2", contactWaId: "555184912340", unreadCount: 2, status: "pending" }));
    const messages = new FakeMessages();
    const service = new MetaWhatsappInboxService(
      new FakeConnections() as any,
      conversations as any,
      messages as any,
      { sendFromAuth: async () => ({ messageId: "x" }) } as any,
      () => ({
        campaign: {
          templateId: "tpl-1",
          templateName: "tocantins_sem_bt_v1_1",
          language: "pt_BR",
          connectionId: "conn-a",
        },
        lead: { waId: "555184035014", nome: "Maria", wamid: "wamid.A" },
      }),
      async () => "Olá {{1}}, campanha Tocantins.",
    );
    const listed = await service.listConversations({ email: EMAIL, role: "subscriber" }, {});
    assert.equal(listed.counts.all, 2);
    assert.equal(listed.counts.unread, 1);
    assert.equal(listed.counts.open, 1);
    assert.equal(listed.counts.pending, 1);
    assert.equal(listed.conversations[0]?.lastMessagePreview, "Olá Maria, campanha Tocantins.");
    const thread = await service.listMessages({ email: EMAIL, role: "subscriber" }, "conv-1", {});
    assert.equal(thread.messages.length, 1);
    assert.equal(thread.messages[0]?.text, "Olá Maria, campanha Tocantins.");
    purgePhoneIdentities(TENANT);
  });
});
