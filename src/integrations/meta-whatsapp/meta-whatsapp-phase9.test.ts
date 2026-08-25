import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { MetaConversationRecord, MetaMessageRecord } from "./meta-whatsapp-messaging.types";
import { MetaWhatsappMessagingService } from "./meta-whatsapp-messaging.service";
import { MetaCloudProvider } from "../whatsapp/meta-cloud-provider";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { stripMetaSecrets } from "./meta-whatsapp-connection.service";
import type { MetaGraphMessagesResult } from "./meta-whatsapp-graph-messages.client";
import { MetaWhatsappAutomationEngine } from "./meta-whatsapp-automation-engine";
import { MetaWhatsappAutomationService } from "./meta-whatsapp-automation.service";
import { RulesResponder } from "./meta-whatsapp-automation-responder";
import { exactTextMatches, keywordMatches, normalizeAutomationText } from "./meta-whatsapp-automation-text";
import { evaluateBusinessHours } from "./meta-whatsapp-automation-hours";
import type {
  MetaAutomationFlowRecord,
  MetaAutomationRuleRecord,
  MetaAutomationRunRecord,
  MetaAutomationSettingsRecord,
} from "./meta-whatsapp-automation.types";
import { AUTOMATION_MATCH_POLICY } from "./meta-whatsapp-automation.types";
import { emitMetaInboxEvent, resetMetaInboxListenersForTests } from "./meta-whatsapp-inbox-events";

const EMAIL_A = "phase9-a@example.com";
const EMAIL_B = "phase9-b@example.com";
const TENANT_A = deriveStableMetaTenantId(EMAIL_A);
const TENANT_B = deriveStableMetaTenantId(EMAIL_B);
const TUESDAY_NOON_BRT = new Date("2026-08-25T15:00:00.000Z");
const SATURDAY_NOON_BRT = new Date("2026-08-29T15:00:00.000Z");

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
    lastMessageAt: TUESDAY_NOON_BRT.toISOString(),
    lastInboundAt: TUESDAY_NOON_BRT.toISOString(),
    lastOutboundAt: null,
    unreadCount: 1,
    humanTakeover: false,
    lastMessagePreview: "Oi",
    createdAt: "2026-08-25T11:00:00.000Z",
    updatedAt: TUESDAY_NOON_BRT.toISOString(),
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
    createdAt: TUESDAY_NOON_BRT.toISOString(),
    updatedAt: TUESDAY_NOON_BRT.toISOString(),
    ...overrides,
  };
}

function settingsRow(overrides: Partial<MetaAutomationSettingsRecord> = {}): MetaAutomationSettingsRecord {
  return {
    id: "set-1",
    tenantId: TENANT_A,
    connectionId: "conn-a",
    enabled: true,
    timezone: "America/Sao_Paulo",
    businessDays: [1, 2, 3, 4, 5],
    businessStart: "08:00",
    businessEnd: "18:00",
    rateLimitCount: 10,
    rateLimitWindowSeconds: 300,
    rateLimitTakeover: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

function flowRow(overrides: Partial<MetaAutomationFlowRecord> = {}): MetaAutomationFlowRecord {
  return {
    id: "flow-1",
    tenantId: TENANT_A,
    connectionId: "conn-a",
    name: "Padrão",
    status: "active",
    isDefault: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

function ruleRow(overrides: Partial<MetaAutomationRuleRecord> = {}): MetaAutomationRuleRecord {
  return {
    id: "rule-1",
    flowId: "flow-1",
    tenantId: TENANT_A,
    priority: 100,
    triggerType: "ANY_INBOUND",
    triggerValue: null,
    actionType: "SEND_TEXT",
    actionPayload: { text: "Olá! Recebemos sua mensagem." },
    active: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

class FakeConnections {
  rows: MetaWhatsappConnectionRecord[] = [];
  async findConnectedByTenant(tenantId: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.status === "connected") || null;
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
  async findByTenantConnectionContact(tenantId: string, connectionId: string, contactWaId: string) {
    return (
      this.rows.find(
        (row) => row.tenantId === tenantId && row.connectionId === connectionId && row.contactWaId === contactWaId,
      ) || null
    );
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
    contactWaId: string;
    atIso: string;
    lastMessagePreview?: string | null;
  }) {
    const existing = await this.findByTenantConnectionContact(input.tenantId, input.connectionId, input.contactWaId);
    if (existing) {
      existing.lastMessageAt = input.atIso;
      if (input.lastMessagePreview !== undefined) existing.lastMessagePreview = input.lastMessagePreview || null;
      return { created: false, record: existing };
    }
    const record = conv({
      id: `conv-${this.rows.length + 1}`,
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      contactWaId: input.contactWaId,
      lastMessagePreview: input.lastMessagePreview || null,
      lastMessageAt: input.atIso,
    });
    this.rows.push(record);
    return { created: true, record };
  }
}

class FakeMessages {
  rows: MetaMessageRecord[] = [];
  async findByIdForTenant(tenantId: string, id: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) || null;
  }
  async countInboundByConversation(tenantId: string, conversationId: string) {
    return this.rows.filter(
      (row) => row.tenantId === tenantId && row.conversationId === conversationId && row.direction === "inbound",
    ).length;
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

class FakeSettings {
  rows: MetaAutomationSettingsRecord[] = [];
  async findByTenantConnection(tenantId: string, connectionId: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.connectionId === connectionId) || null;
  }
  async upsert(input: Partial<MetaAutomationSettingsRecord> & { tenantId: string; connectionId: string }) {
    const existing = await this.findByTenantConnection(input.tenantId, input.connectionId);
    if (existing) {
      Object.assign(existing, input);
      return existing;
    }
    const row = settingsRow({ id: `set-${this.rows.length + 1}`, ...input });
    this.rows.push(row);
    return row;
  }
  async setEnabled(tenantId: string, connectionId: string, enabled: boolean) {
    const row = await this.findByTenantConnection(tenantId, connectionId);
    if (!row) return null;
    row.enabled = enabled;
    return row;
  }
}

class FakeFlows {
  rows: MetaAutomationFlowRecord[] = [];
  async findByIdForTenant(tenantId: string, id: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) || null;
  }
  async findDefault(tenantId: string, connectionId: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.connectionId === connectionId && row.isDefault) || null;
  }
  async insert(input: Partial<MetaAutomationFlowRecord> & { tenantId: string; connectionId: string; name: string }) {
    const row = flowRow({ id: `flow-${this.rows.length + 1}`, ...input });
    this.rows.push(row);
    return row;
  }
  async update(tenantId: string, id: string, patch: Partial<MetaAutomationFlowRecord>) {
    const row = await this.findByIdForTenant(tenantId, id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
}

class FakeRules {
  rows: MetaAutomationRuleRecord[] = [];
  async findByIdForTenant(tenantId: string, id: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) || null;
  }
  async listByFlow(tenantId: string, flowId: string) {
    return this.rows
      .filter((row) => row.tenantId === tenantId && row.flowId === flowId)
      .sort((a, b) => a.priority - b.priority);
  }
  async insert(input: Partial<MetaAutomationRuleRecord> & { tenantId: string; flowId: string }) {
    const row = ruleRow({ id: `rule-${this.rows.length + 1}`, ...input });
    this.rows.push(row);
    return row;
  }
  async update(tenantId: string, id: string, patch: Partial<MetaAutomationRuleRecord>) {
    const row = await this.findByIdForTenant(tenantId, id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async delete(tenantId: string, id: string) {
    const index = this.rows.findIndex((row) => row.tenantId === tenantId && row.id === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }
}

class FakeRuns {
  rows: MetaAutomationRunRecord[] = [];
  async tryClaim(input: {
    tenantId: string;
    connectionId: string;
    conversationId: string;
    messageId: string;
  }) {
    const existing = this.rows.find((row) => row.tenantId === input.tenantId && row.messageId === input.messageId);
    if (existing) return { record: existing, duplicate: true };
    const record: MetaAutomationRunRecord = {
      id: `run-${this.rows.length + 1}`,
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      flowId: null,
      ruleId: null,
      status: "received",
      actionType: null,
      error: null,
      createdAt: TUESDAY_NOON_BRT.toISOString(),
      processedAt: null,
    };
    this.rows.push(record);
    return { record, duplicate: false };
  }
  async update(tenantId: string, id: string, patch: Partial<MetaAutomationRunRecord>) {
    const row = this.rows.find((item) => item.tenantId === tenantId && item.id === id);
    if (!row) return null;
    Object.assign(row, patch, { processedAt: TUESDAY_NOON_BRT.toISOString() });
    return row;
  }
  async countRecentSends(tenantId: string, conversationId: string, sinceIso: string) {
    return this.rows.filter(
      (row) =>
        row.tenantId === tenantId &&
        row.conversationId === conversationId &&
        row.status === "sent" &&
        (row.actionType === "SEND_TEXT" || row.actionType === "SEND_TEMPLATE") &&
        String(row.createdAt) >= sinceIso,
    ).length;
  }
  async listRecent(tenantId: string, connectionId: string, limit: number) {
    return this.rows
      .filter((row) => row.tenantId === tenantId && row.connectionId === connectionId)
      .slice(0, limit);
  }
}

class FakeTemplates {
  rows: Array<{ tenantId: string; connectionId: string; name: string; language: string; status: string }> = [];
  async assertSendable(input: { tenantId: string; connectionId: string; name: string; language: string }) {
    const row = this.rows.find(
      (item) =>
        item.tenantId === input.tenantId &&
        item.connectionId === input.connectionId &&
        item.name === input.name &&
        item.language === input.language,
    );
    if (!row) throw new MetaWhatsappError("template_not_found");
    if (row.status !== "APPROVED") throw new MetaWhatsappError("template_not_ready");
    return row;
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

function graphFail(): MetaGraphMessagesResult {
  return {
    ok: false,
    status: 500,
    json: { error: { message: "fail" } },
    body: "{}",
    timeout: false,
    kind: "transient",
    graphCode: null,
    wamid: null,
    attempts: 1,
  };
}

type Harness = {
  connections: FakeConnections;
  conversations: FakeConversations;
  messages: FakeMessages;
  settings: FakeSettings;
  flows: FakeFlows;
  rules: FakeRules;
  runs: FakeRuns;
  templates: FakeTemplates;
  engine: MetaWhatsappAutomationEngine;
  service: MetaWhatsappAutomationService;
  graphCalls: number;
};

function harness(options: { clock?: () => Date; graph?: () => Promise<MetaGraphMessagesResult> } = {}): Harness {
  const connections = new FakeConnections();
  connections.rows.push(connectedRow());
  const conversations = new FakeConversations();
  conversations.rows.push(conv());
  const messages = new FakeMessages();
  messages.rows.push(msg());
  const settings = new FakeSettings();
  settings.rows.push(settingsRow());
  const flows = new FakeFlows();
  flows.rows.push(flowRow());
  const rules = new FakeRules();
  const runs = new FakeRuns();
  const templates = new FakeTemplates();
  templates.rows.push({
    tenantId: TENANT_A,
    connectionId: "conn-a",
    name: "hello",
    language: "pt_BR",
    status: "APPROVED",
  });
  let graphCalls = 0;
  const graph = async () => {
    graphCalls += 1;
    return options.graph ? options.graph() : graphOk();
  };
  const messaging = new MetaWhatsappMessagingService(
    new MetaCloudProvider(connections as any, graph, () => "token"),
    conversations as any,
    messages as any,
    templates as any,
  );
  const engine = new MetaWhatsappAutomationEngine(
    messages as any,
    conversations as any,
    settings as any,
    flows as any,
    rules as any,
    runs as any,
    messaging,
    templates as any,
    new RulesResponder(),
    options.clock || (() => TUESDAY_NOON_BRT),
    async () => undefined,
  );
  const service = new MetaWhatsappAutomationService(
    connections as any,
    settings as any,
    flows as any,
    rules as any,
    runs as any,
  );
  return {
    connections,
    conversations,
    messages,
    settings,
    flows,
    rules,
    runs,
    templates,
    engine,
    service,
    get graphCalls() {
      return graphCalls;
    },
  } as Harness;
}

function inboundEvent(overrides: Record<string, string> = {}) {
  return {
    name: "inbound_message" as const,
    tenantId: TENANT_A,
    conversationId: "conv-1",
    messageId: "msg-1",
    connectionId: "conn-a",
    occurredAt: TUESDAY_NOON_BRT.toISOString(),
    ...overrides,
  };
}

describe("fase 9 texto e horário", () => {
  it("normaliza acento e case para keyword/exact", () => {
    assert.equal(normalizeAutomationText("  Preço  "), "preco");
    assert.equal(keywordMatches("Qual o PREÇO?", "preco,valor"), true);
    assert.equal(exactTextMatches(" 1 ", "1"), true);
    assert.equal(exactTextMatches("1.", "1"), false);
  });

  it("detecta dentro e fora do horário comercial em America/Sao_Paulo", () => {
    const cfg = { timezone: "America/Sao_Paulo", businessDays: [1, 2, 3, 4, 5], businessStart: "08:00", businessEnd: "18:00" };
    assert.equal(evaluateBusinessHours(cfg, TUESDAY_NOON_BRT).inside, true);
    assert.equal(evaluateBusinessHours(cfg, SATURDAY_NOON_BRT).inside, false);
  });
});

describe("fase 9 skip e takeover", () => {
  it("automation disabled não envia", async () => {
    const h = harness();
    h.settings.rows[0].enabled = false;
    h.rules.rows.push(ruleRow());
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].status, "skipped");
    assert.equal(h.runs.rows[0].error, "automation_disabled");
    assert.equal(h.graphCalls, 0);
  });

  it("human_takeover ignora automação", async () => {
    const h = harness();
    h.conversations.rows[0].humanTakeover = true;
    h.rules.rows.push(ruleRow());
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].error, "human_takeover");
    assert.equal(h.graphCalls, 0);
  });
});

describe("fase 9 triggers e prioridade", () => {
  it("ANY_INBOUND envia texto", async () => {
    const h = harness();
    h.rules.rows.push(ruleRow());
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].status, "sent");
    assert.equal(h.runs.rows[0].actionType, "SEND_TEXT");
    assert.equal(h.graphCalls, 1);
    assert.equal(h.messages.rows.some((row) => row.direction === "outbound"), true);
  });

  it("FIRST_INBOUND só na primeira inbound", async () => {
    const h = harness();
    h.rules.rows.push(ruleRow({ triggerType: "FIRST_INBOUND", actionPayload: { text: "bem vindo" } }));
    h.messages.rows.push(msg({ id: "msg-0", textContent: "antes" }));
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].status, "skipped");
    assert.equal(h.runs.rows[0].error, "no_match");
    h.messages.rows = [msg()];
    h.runs.rows = [];
    await h.engine.handleInbound(inboundEvent({ messageId: "msg-1" }));
    assert.equal(h.runs.rows[0].status, "sent");
  });

  it("KEYWORD e EXACT_TEXT", async () => {
    const h = harness();
    h.rules.rows.push(ruleRow({ id: "r-kw", triggerType: "KEYWORD", triggerValue: "preco", priority: 2, actionPayload: { text: "tabela" } }));
    h.messages.rows[0].textContent = "Qual o preço?";
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].ruleId, "r-kw");
    const h2 = harness();
    h2.rules.rows.push(ruleRow({ id: "r-ex", triggerType: "EXACT_TEXT", triggerValue: "1", priority: 1, actionPayload: { text: "comercial" } }));
    h2.messages.rows[0].textContent = "1";
    await h2.engine.handleInbound(inboundEvent());
    assert.equal(h2.runs.rows[0].ruleId, "r-ex");
  });

  it("inside e outside business hours", async () => {
    const inside = harness({ clock: () => TUESDAY_NOON_BRT });
    inside.rules.rows.push(ruleRow({ triggerType: "INSIDE_BUSINESS_HOURS", actionPayload: { text: "horario" } }));
    await inside.engine.handleInbound(inboundEvent());
    assert.equal(inside.runs.rows[0].status, "sent");
    const outside = harness({ clock: () => SATURDAY_NOON_BRT });
    outside.conversations.rows[0].lastInboundAt = SATURDAY_NOON_BRT.toISOString();
    outside.rules.rows.push(ruleRow({ triggerType: "OUTSIDE_BUSINESS_HOURS", actionPayload: { text: "fora" } }));
    await outside.engine.handleInbound(inboundEvent());
    assert.equal(outside.runs.rows[0].status, "sent");
  });

  it("first matching rule wins e fallback ANY_INBOUND", async () => {
    assert.equal(AUTOMATION_MATCH_POLICY, "first_matching_rule_wins");
    const h = harness();
    h.rules.rows.push(ruleRow({ id: "exact", triggerType: "EXACT_TEXT", triggerValue: "1", priority: 1, actionPayload: { text: "comercial" } }));
    h.rules.rows.push(ruleRow({ id: "any", triggerType: "ANY_INBOUND", priority: 50, actionPayload: { text: "nao entendi" } }));
    h.messages.rows[0].textContent = "1";
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].ruleId, "exact");
    assert.equal(h.graphCalls, 1);
    const fb = harness();
    fb.rules.rows.push(ruleRow({ id: "exact", triggerType: "EXACT_TEXT", triggerValue: "1", priority: 1, actionPayload: { text: "comercial" } }));
    fb.rules.rows.push(ruleRow({ id: "any", triggerType: "ANY_INBOUND", priority: 50, actionPayload: { text: "nao entendi" } }));
    fb.messages.rows[0].textContent = "xyz";
    await fb.engine.handleInbound(inboundEvent());
    assert.equal(fb.runs.rows[0].ruleId, "any");
  });
});

describe("fase 9 ações, janela e limites", () => {
  it("SEND_TEMPLATE usa template do mesmo tenant/conexão", async () => {
    const h = harness();
    h.rules.rows.push(ruleRow({
      actionType: "SEND_TEMPLATE",
      actionPayload: { name: "hello", language: "pt_BR" },
    }));
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].status, "sent");
    assert.equal(h.runs.rows[0].actionType, "SEND_TEMPLATE");
  });

  it("não usa template de outro tenant", async () => {
    const h = harness();
    h.templates.rows = [{ tenantId: TENANT_B, connectionId: "conn-b", name: "hello", language: "pt_BR", status: "APPROVED" }];
    h.rules.rows.push(ruleRow({
      actionType: "SEND_TEMPLATE",
      actionPayload: { name: "hello", language: "pt_BR" },
    }));
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].status, "error");
    assert.equal(h.graphCalls, 0);
  });

  it("janela fechada bloqueia SEND_TEXT", async () => {
    const h = harness();
    h.conversations.rows[0].lastInboundAt = "2026-08-24T10:00:00.000Z";
    h.rules.rows.push(ruleRow());
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].status, "blocked");
    assert.equal(h.runs.rows[0].error, "automation_blocked_customer_care_window");
    assert.equal(h.graphCalls, 0);
  });

  it("ENABLE_HUMAN_TAKEOVER marca conversa e não seleciona atendente", async () => {
    const h = harness();
    h.rules.rows.push(ruleRow({
      actionType: "ENABLE_HUMAN_TAKEOVER",
      actionPayload: { text: "Aguarde, vou encaminhar seu atendimento." },
    }));
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.conversations.rows[0].humanTakeover, true);
    assert.equal(h.conversations.rows[0].status, "open");
    assert.equal(h.conversations.rows[0].assignedTo, null);
    assert.equal(h.runs.rows[0].status, "matched");
  });

  it("rate limit para automação e opcionalmente takeover", async () => {
    const h = harness();
    h.settings.rows[0].rateLimitCount = 2;
    for (let i = 0; i < 2; i += 1) {
      h.runs.rows.push({
        id: `prev-${i}`,
        tenantId: TENANT_A,
        connectionId: "conn-a",
        conversationId: "conv-1",
        messageId: `old-${i}`,
        flowId: "flow-1",
        ruleId: "rule-1",
        status: "sent",
        actionType: "SEND_TEXT",
        error: null,
        createdAt: TUESDAY_NOON_BRT.toISOString(),
        processedAt: TUESDAY_NOON_BRT.toISOString(),
      });
    }
    h.rules.rows.push(ruleRow());
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows.find((row) => row.messageId === "msg-1")?.error, "rate_limit");
    assert.equal(h.conversations.rows[0].humanTakeover, true);
    assert.equal(h.graphCalls, 0);
  });

  it("erro do provider registra ERROR sem derrubar", async () => {
    const h = harness({ graph: async () => graphFail() });
    h.rules.rows.push(ruleRow());
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].status, "error");
    assert.equal(h.runs.rows[0].error, "provider_error");
  });
});

describe("fase 9 loop e idempotência", () => {
  it("não processa outbound como gatilho", async () => {
    const h = harness();
    h.rules.rows.push(ruleRow());
    h.messages.rows[0].direction = "outbound";
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows.length, 0);
    assert.equal(h.graphCalls, 0);
  });

  it("inbound duplicado não executa duas vezes", async () => {
    const h = harness();
    h.rules.rows.push(ruleRow());
    await h.engine.handleInbound(inboundEvent());
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows.length, 1);
    assert.equal(h.graphCalls, 1);
  });

  it("evento outbound_message não dispara o engine", async () => {
    resetMetaInboxListenersForTests();
    const h = harness();
    h.rules.rows.push(ruleRow());
    await emitMetaInboxEvent({
      name: "outbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: TUESDAY_NOON_BRT.toISOString(),
    });
    assert.equal(h.runs.rows.length, 0);
  });
});

describe("fase 9 multi-tenant IDOR", () => {
  it("tenant A não lê nem edita regra do tenant B", async () => {
    const h = harness();
    h.connections.rows.push(connectedRow({ id: "conn-b", tenantId: TENANT_B, ownerEmail: EMAIL_B, wabaId: "waba-b" }));
    h.flows.rows.push(flowRow({ id: "flow-b", tenantId: TENANT_B, connectionId: "conn-b" }));
    h.rules.rows.push(ruleRow({ id: "rule-b", tenantId: TENANT_B, flowId: "flow-b" }));
    const bundle = await h.service.getBundle(auth(EMAIL_A));
    assert.equal(bundle.rules.some((rule) => rule.id === "rule-b"), false);
    assert.equal("tenantId" in (bundle.settings as object), false);
    await assert.rejects(
      () => h.service.patchRule(auth(EMAIL_A), "rule-b", { active: false }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "automation_not_found",
    );
    await assert.rejects(
      () => h.service.deleteRule(auth(EMAIL_A), "rule-b"),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "automation_not_found",
    );
    assert.equal(/access_token/i.test(JSON.stringify(stripMetaSecrets(bundle))), false);
  });

  it("engine do tenant A não executa regra do tenant B", async () => {
    const h = harness();
    h.rules.rows.push(ruleRow({ id: "rule-b", tenantId: TENANT_B, flowId: "flow-1", actionPayload: { text: "segredo B" } }));
    await h.engine.handleInbound(inboundEvent());
    assert.equal(h.runs.rows[0].error, "no_match");
    assert.equal(h.graphCalls, 0);
  });
});
