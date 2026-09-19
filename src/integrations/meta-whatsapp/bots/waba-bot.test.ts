import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { deriveStableMetaTenantId } from "../meta-whatsapp-tenant";
import type { MetaConversationRecord, MetaMessageRecord } from "../meta-whatsapp-messaging.types";
import { emitMetaInboxEvent, resetMetaInboxListenersForTests } from "../meta-whatsapp-inbox-events";
import { createBotNodeData } from "./waba-bot-node.registry";
import { createDefaultBotDraft, normalizeBotDraft } from "./waba-bot-flow.normalize";
import {
  advanceBotRun,
  createBotRunState,
  executeBotNode,
  matchMenuOption,
} from "./waba-bot-runtime.engine";
import {
  buildCloudCtaUrlBody,
  buildCloudMediaBody,
  normalizeBotButtonLabel,
  normalizeBotHttpsUrl,
} from "./waba-bot-cloud-payload";
import { resolveCustomerCareWindow } from "../meta-whatsapp-customer-care-window";
import {
  getBotIdForPhone,
  readBotFlow,
  resetWabaBotStoreForTests,
  setBotPhoneLink,
  upsertBotFlow,
  wasBotMessageClaimed,
} from "./waba-bot.store";
import { listBotAssignableChannels, WabaBotService } from "./waba-bot.service";
import { hideBusiness, unhideBusiness } from "../meta-whatsapp-hidden-business.store";
import { MetaWhatsappError } from "../meta-whatsapp-errors";
import { purgePhoneIdentities, writePhoneIdentity } from "../meta-whatsapp-phone-identity.store";
import type { WabaRequestAuth } from "../../../auth/waba-request-auth";
import { startWabaBots, stopWabaBotsForTests } from "./waba-bot.bootstrap";
import { resetWabaBotLocksForTests, WabaBotInboundService } from "./waba-bot-inbound.service";
import type { BotFlowDraft, BotFlowNode } from "./waba-bot.types";

const EMAIL_A = "bots-a@example.com";
const EMAIL_B = "bots-b@example.com";
const TENANT_A = deriveStableMetaTenantId(EMAIL_A);
const TENANT_B = deriveStableMetaTenantId(EMAIL_B);

function node(kind: BotFlowNode["data"]["kind"], id: string, extras: Partial<BotFlowNode> = {}): BotFlowNode {
  return {
    id,
    type: "botStep",
    position: { x: 0, y: 0 },
    data: createBotNodeData(kind),
    ...extras,
  };
}

function welcomeFlow(id = "bot-welcome"): BotFlowDraft {
  const start = node("start", "n-start");
  const message = node("message", "n-msg");
  message.data.config.text = "Olá, bem-vindo.";
  const menu = node("menu", "n-menu");
  menu.data.config.text = "Escolha:";
  menu.data.config.options = [
    { id: "opt-1", label: "1 - Atendimento", value: "1" },
    { id: "opt-2", label: "2 - Financeiro", value: "2" },
  ];
  const wait = node("wait_reply", "n-wait");
  const end = node("end", "n-end");
  return normalizeBotDraft({
    id,
    name: "Boas-vindas",
    nodes: [start, message, menu, wait, end],
    edges: [
      { id: "e1", source: "n-start", target: "n-msg", sourceHandle: "out" },
      { id: "e2", source: "n-msg", target: "n-menu", sourceHandle: "out" },
      { id: "e3", source: "n-menu", target: "n-wait", sourceHandle: "opt-1" },
      { id: "e4", source: "n-menu", target: "n-end", sourceHandle: "opt-2" },
    ],
  });
}

function conv(overrides: Partial<MetaConversationRecord> = {}): MetaConversationRecord {
  const now = new Date().toISOString();
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
    lastMessageAt: now,
    lastInboundAt: now,
    lastOutboundAt: null,
    unreadCount: 1,
    humanTakeover: false,
    lastMessagePreview: "Oi",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function msg(overrides: Partial<MetaMessageRecord> = {}): MetaMessageRecord {
  const now = new Date().toISOString();
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

afterEach(() => {
  stopWabaBotsForTests();
  resetMetaInboxListenersForTests();
  resetWabaBotLocksForTests();
  resetWabaBotStoreForTests(TENANT_A);
  resetWabaBotStoreForTests(TENANT_B);
  purgePhoneIdentities(TENANT_A);
  unhideBusiness(TENANT_A, "1041827648719609");
});

describe("WABA bots — motor", () => {
  it("casa menu numerado pelo número digitado", () => {
    const options = [
      { id: "opt-1", label: "1 - Atendimento", value: "1" },
      { id: "opt-2", label: "2 - Financeiro", value: "2" },
    ];
    assert.equal(matchMenuOption("1", options)?.id, "opt-1");
    assert.equal(matchMenuOption("2", options)?.id, "opt-2");
    assert.equal(matchMenuOption("financeiro", options)?.id, undefined);
  });

  it("botões inválidos permanecem aguardando", async () => {
    const buttons = node("buttons", "n-btn");
    buttons.data.config.options = [
      { id: "opt-1", label: "Sim", value: "sim" },
      { id: "opt-2", label: "Não", value: "nao" },
    ];
    const result = await executeBotNode({
      node: buttons,
      variables: {},
      inboundText: "talvez",
    });
    assert.equal(result.waitForReply, true);
    assert.equal(result.status, "waiting");
    assert.equal(result.nextHandle, undefined);
  });
});

describe("WABA bots — inbound 1 a 9", () => {
  function setupInbound(input?: {
    conversation?: MetaConversationRecord;
    message?: MetaMessageRecord;
    sent?: Array<Record<string, unknown>>;
  }) {
    const conversation = input?.conversation || conv();
    const conversations = new Map<string, MetaConversationRecord>([[conversation.id, conversation]]);
    const messages = new Map<string, MetaMessageRecord>();
    if (input?.message) messages.set(input.message.id, input.message);
    const sent = input?.sent || [];
    const service = new WabaBotInboundService({
      messages: {
        findByIdForTenant: async (tenantId, id) => {
          const row = messages.get(id);
          return row && row.tenantId === tenantId ? row : null;
        },
      },
      conversations: {
        findByIdForTenant: async (tenantId, id) => {
          const row = conversations.get(id);
          return row && row.tenantId === tenantId ? row : null;
        },
        assign: async (tenantId, id, assignedTo, humanTakeover) => {
          const row = conversations.get(id);
          if (!row || row.tenantId !== tenantId) return null;
          const next = { ...row, assignedTo, humanTakeover };
          conversations.set(id, next);
          return next;
        },
      },
      messaging: {
        sendForTenant: async (tenantId, body) => {
          sent.push({ tenantId, ...body });
          return {
            provider: "meta-cloud",
            messageId: `wamid.out.${sent.length}`,
            status: "accepted",
            connectionId: conversation.connectionId,
            phoneNumberId: conversation.phoneNumberId || "phone-a",
            conversationId: String(body?.conversationId || conversation.id),
            customerCareWindow: { known: true, withinWindow: true },
          };
        },
      },
    });
    return { service, conversations, messages, sent, conversation };
  }

  it("1) inbound inicia o bot do número associado", async () => {
    const flow = upsertBotFlow(TENANT_A, welcomeFlow());
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    const { service, messages, sent } = setupInbound();
    messages.set("msg-1", msg());
    const handled = await service.handleInbound({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    assert.equal(handled, true);
    assert.ok(sent.length >= 1);
    assert.match(String(sent[0]?.text || ""), /bem-vindo/i);
    assert.equal(getBotIdForPhone(TENANT_A, "phone-a"), flow.id);
  });

  it("2) resposta continua wait_reply sem reiniciar", async () => {
    const start = node("start", "s");
    const ask = node("message", "m");
    ask.data.config.text = "Qual o seu nome?";
    const wait = node("wait_reply", "w");
    const thanks = node("message", "t");
    thanks.data.config.text = "Obrigado, {{ultima_resposta}}";
    const flow = upsertBotFlow(
      TENANT_A,
      normalizeBotDraft({
        id: "bot-wait",
        name: "Espera",
        nodes: [start, ask, wait, thanks],
        edges: [
          { id: "e1", source: "s", target: "m", sourceHandle: "out" },
          { id: "e2", source: "m", target: "w", sourceHandle: "out" },
          { id: "e3", source: "w", target: "t", sourceHandle: "out" },
        ],
      }),
    );
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    const { service, messages, sent } = setupInbound();
    messages.set("msg-1", msg({ id: "msg-1", textContent: "Oi" }));
    await service.handleInbound({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    assert.match(String(sent[0]?.text || ""), /nome/i);
    messages.set("msg-2", msg({ id: "msg-2", wamid: "wamid.2", textContent: "Ana" }));
    await service.handleInbound({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-2",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    assert.ok(sent.some((row) => String(row.text || "").includes("Ana")));
  });

  it("10) inbound envia mídia e CTA URL sem virar texto", async () => {
    const start = node("start", "s");
    const media = node("media", "m");
    media.data.config.mediaKind = "video";
    media.data.config.mediaUrl = "https://files.example.com/demo.mp4";
    const link = node("link", "l");
    link.data.config.buttonLabel = "Site";
    link.data.config.url = "https://draxsistemas.com.br";
    const flow = upsertBotFlow(
      TENANT_A,
      normalizeBotDraft({
        id: "bot-cta",
        name: "CTA",
        nodes: [start, media, link],
        edges: [
          { id: "e1", source: "s", target: "m", sourceHandle: "out" },
          { id: "e2", source: "m", target: "l", sourceHandle: "out" },
        ],
      }),
    );
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    const { service, messages, sent } = setupInbound();
    messages.set("msg-1", msg());
    const handled = await service.handleInbound({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    assert.equal(handled, true);
    assert.equal(sent.some((row) => row.type === "video" && row.mediaUrl === "https://files.example.com/demo.mp4"), true);
    assert.equal(sent.some((row) => row.type === "cta_url" && row.buttonLabel === "Site"), true);
  });

  it("3) opção inválida de botão não avança o fluxo", async () => {
    const start = node("start", "s");
    const buttons = node("buttons", "b");
    buttons.data.config.text = "Confirma?";
    buttons.data.config.options = [
      { id: "opt-1", label: "Sim", value: "sim" },
      { id: "opt-2", label: "Não", value: "nao" },
    ];
    const end = node("end", "e");
    const flow = upsertBotFlow(
      TENANT_A,
      normalizeBotDraft({
        id: "bot-btn",
        name: "Botões",
        nodes: [start, buttons, end],
        edges: [
          { id: "e1", source: "s", target: "b", sourceHandle: "out" },
          { id: "e2", source: "b", target: "e", sourceHandle: "opt-1" },
        ],
      }),
    );
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    const { service, messages, sent } = setupInbound();
    messages.set("msg-1", msg({ id: "msg-1", textContent: "Oi" }));
    await service.handleInbound({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    const firstCount = sent.length;
    messages.set("msg-2", msg({ id: "msg-2", wamid: "wamid.2", textContent: "talvez" }));
    await service.handleInbound({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-2",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    assert.ok(sent.length > firstCount);
    assert.match(String(sent[sent.length - 1]?.text || ""), /Por favor, escolha/i);
  });

  it("4) human_takeover impede o bot de responder", async () => {
    const flow = upsertBotFlow(TENANT_A, welcomeFlow("bot-ht"));
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    const { service, messages, sent } = setupInbound({
      conversation: conv({ humanTakeover: true }),
    });
    messages.set("msg-1", msg());
    const handled = await service.handleInbound({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    assert.equal(handled, false);
    assert.equal(sent.length, 0);
  });

  it("5) fora da janela de 24h não envia texto livre", () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const window = resolveCustomerCareWindow({ lastInboundAt: stale });
    assert.equal(window.known, true);
    assert.equal(window.withinWindow, false);
  });

  it("5b) inbound antigo não dispara envio", async () => {
    const flow = upsertBotFlow(TENANT_A, welcomeFlow("bot-24h"));
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const { service, messages, sent } = setupInbound({
      conversation: conv({ lastInboundAt: stale }),
    });
    messages.set("msg-1", msg());
    const handled = await service.handleInbound({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    assert.equal(handled, true);
    assert.equal(sent.length, 0);
    assert.equal(wasBotMessageClaimed(TENANT_A, "msg-1"), true);
  });

  it("6) o mesmo messageId não dispara o bot duas vezes", async () => {
    const flow = upsertBotFlow(TENANT_A, welcomeFlow("bot-dup"));
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    const { service, messages, sent } = setupInbound();
    messages.set("msg-1", msg());
    const event = {
      name: "inbound_message" as const,
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    };
    await service.handleInbound(event);
    const first = sent.length;
    await service.handleInbound(event);
    assert.equal(sent.length, first);
    assert.equal(wasBotMessageClaimed(TENANT_A, "msg-1"), true);
  });

  it("7) lock serializa dois inbounds da mesma conversa", async () => {
    const start = node("start", "s");
    const wait = node("wait_reply", "w");
    const echo = node("message", "m");
    echo.data.config.text = "Recebi {{ultima_resposta}}";
    const flow = upsertBotFlow(
      TENANT_A,
      normalizeBotDraft({
        id: "bot-lock",
        name: "Lock",
        nodes: [start, wait, echo],
        edges: [
          { id: "e1", source: "s", target: "w", sourceHandle: "out" },
          { id: "e2", source: "w", target: "m", sourceHandle: "out" },
        ],
      }),
    );
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    const { service, messages, sent } = setupInbound();
    messages.set("msg-1", msg({ id: "msg-1", textContent: "Oi" }));
    await service.handleInbound({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    messages.set("msg-2", msg({ id: "msg-2", wamid: "wamid.2", textContent: "Ana" }));
    messages.set("msg-3", msg({ id: "msg-3", wamid: "wamid.3", textContent: "Bruno" }));
    await Promise.all([
      service.handleInbound({
        name: "inbound_message",
        tenantId: TENANT_A,
        conversationId: "conv-1",
        messageId: "msg-2",
        connectionId: "conn-a",
        occurredAt: new Date().toISOString(),
      }),
      service.handleInbound({
        name: "inbound_message",
        tenantId: TENANT_A,
        conversationId: "conv-1",
        messageId: "msg-3",
        connectionId: "conn-a",
        occurredAt: new Date().toISOString(),
      }),
    ]);
    const echoes = sent.filter((row) => String(row.text || "").startsWith("Recebi "));
    assert.ok(echoes.length >= 1);
    assert.ok(echoes.length <= 2);
  });

  it("8) tenant B não lê o bot do tenant A", () => {
    const flow = upsertBotFlow(TENANT_A, welcomeFlow("bot-iso"));
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    assert.equal(getBotIdForPhone(TENANT_B, "phone-a"), null);
  });

  it("9) bootstrap escuta inbound_message sem quebrar o webhook", async () => {
    const flow = upsertBotFlow(TENANT_A, createDefaultBotDraft("Vazio"));
    setBotPhoneLink({ tenantId: TENANT_A, phoneNumberId: "phone-a", botId: flow.id });
    const { service, messages } = setupInbound();
    messages.set("msg-1", msg());
    startWabaBots(service);
    await emitMetaInboxEvent({
      name: "inbound_message",
      tenantId: TENANT_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      connectionId: "conn-a",
      occurredAt: new Date().toISOString(),
    });
    assert.equal(wasBotMessageClaimed(TENANT_A, "msg-1"), true);
  });
});

describe("WABA bots — números Inbox", () => {
  const authA: WabaRequestAuth = { email: EMAIL_A, role: "subscriber" };

  it("lista só chips com Inbox ligado em Conexão", () => {
    writePhoneIdentity(TENANT_A, "phone-on", {
      inboxEnabled: true,
      channelName: "Atendimento",
      displayPhoneNumber: "+55 11 90000-0001",
    });
    writePhoneIdentity(TENANT_A, "phone-off", {
      inboxEnabled: false,
      channelName: "Sem inbox",
      displayPhoneNumber: "+55 11 90000-0002",
    });
    const rows = listBotAssignableChannels(TENANT_A);
    assert.deepEqual(
      rows.map((row) => row.phoneNumberId),
      ["phone-on"],
    );
    assert.equal(rows[0]?.inboxEnabled, true);
    assert.equal(rows[0]?.inboxEligible, true);
  });

  it("lista Relacionamento do Drax Waba mesmo se a conexão ainda tiver o 5182001279", () => {
    writePhoneIdentity(TENANT_A, "phone-rel", {
      inboxEnabled: true,
      uiStatus: "ativo",
      portfolioHidden: false,
      businessId: "1041827648719609",
      channelName: "Relacionamento e Atendimento",
      displayPhoneNumber: "+55 51 92636-1688",
    });
    writePhoneIdentity(TENANT_A, "phone-drax", {
      inboxEnabled: true,
      uiStatus: "ativo",
      channelName: "Drax Sistema",
      displayPhoneNumber: "+55 51 8200-1279",
    });
    const rows = listBotAssignableChannels(TENANT_A, [
      {
        phoneNumberId: "phone-rel",
        displayPhoneNumber: "+55 51 8200-1279",
        metaBusinessId: "1041827648719609",
        wabaId: "1636793994538054",
      },
    ]);
    assert.deepEqual(
      rows.map((row) => row.phoneNumberId),
      ["phone-rel"],
    );
  });

  it("omite 5182001279 mesmo sem display na identidade, se a conexão estiver restrita", () => {
    writePhoneIdentity(TENANT_A, "phone-drax", {
      inboxEnabled: true,
      uiStatus: "ativo",
      channelName: "Drax Sistema",
    });
    const rows = listBotAssignableChannels(TENANT_A, [
      {
        phoneNumberId: "phone-drax",
        displayPhoneNumber: "+55 51 8200-1279",
        metaBusinessId: "1041827648719609",
      },
    ]);
    assert.deepEqual(
      rows.map((row) => row.phoneNumberId),
      [],
    );
  });

  it("omite 5182001279 mesmo com Inbox ligado", () => {
    writePhoneIdentity(TENANT_A, "phone-drax", {
      inboxEnabled: true,
      uiStatus: "ativo",
      channelName: "Drax Sistema",
      displayPhoneNumber: "+55 51 8200-1279",
    });
    writePhoneIdentity(TENANT_A, "phone-ok", {
      inboxEnabled: true,
      uiStatus: "ativo",
      channelName: "Relacionamento e Atendimento",
      displayPhoneNumber: "+55 51 92636-1688",
    });
    const rows = listBotAssignableChannels(TENANT_A);
    assert.deepEqual(
      rows.map((row) => row.phoneNumberId),
      ["phone-ok"],
    );
  });

  it("omite chip em Restritas e em conta restringida", () => {
    const businessId = "1041827648719609";
    unhideBusiness(TENANT_A, businessId);
    writePhoneIdentity(TENANT_A, "phone-hidden", {
      inboxEnabled: true,
      uiStatus: "ativo",
      portfolioHidden: true,
      channelName: "Portfólio restrito",
      displayPhoneNumber: "+55 11 91111-1111",
    });
    writePhoneIdentity(TENANT_A, "phone-restrito", {
      inboxEnabled: true,
      uiStatus: "restrito",
      channelName: "Chip restrito",
      displayPhoneNumber: "+55 11 92222-2222",
    });
    writePhoneIdentity(TENANT_A, "phone-ok", {
      inboxEnabled: true,
      uiStatus: "ativo",
      channelName: "Relacionamento e Atendimento",
      displayPhoneNumber: "+55 51 92636-1688",
    });
    hideBusiness(TENANT_A, businessId, "BAN Drax Sistemas");
    const rows = listBotAssignableChannels(TENANT_A, [
      {
        phoneNumberId: "phone-hidden",
        displayPhoneNumber: "+55 11 91111-1111",
        metaBusinessId: businessId,
      },
    ]);
    unhideBusiness(TENANT_A, businessId);
    assert.deepEqual(
      rows.map((row) => row.phoneNumberId),
      ["phone-ok"],
    );
  });

  it("recusa associar chip inelegível e aceita o Inbox válido", async () => {
    writePhoneIdentity(TENANT_A, "phone-drax", {
      inboxEnabled: true,
      uiStatus: "ativo",
      channelName: "Drax Sistema",
      displayPhoneNumber: "+55 51 8200-1279",
    });
    writePhoneIdentity(TENANT_A, "phone-ok", {
      inboxEnabled: true,
      uiStatus: "ativo",
      channelName: "Relacionamento e Atendimento",
      displayPhoneNumber: "+55 51 92636-1688",
    });
    const flow = upsertBotFlow(TENANT_A, createDefaultBotDraft("Associação"));
    const service = new WabaBotService({
      listInboxConnections: async () => [],
    });
    await assert.rejects(
      () => service.linkPhone(authA, { phoneNumberId: "phone-drax", botId: flow.id }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "invalid_payload",
    );
    const linked = await service.linkPhone(authA, { phoneNumberId: "phone-ok", botId: flow.id });
    assert.equal(linked.ok, true);
    const listed = await service.list(authA);
    assert.deepEqual(
      listed.channels.map((row) => row.phoneNumberId),
      ["phone-ok"],
    );
    assert.equal(listed.channels[0]?.botId, flow.id);
  });

  it("trocar o bot do chip substitui o anterior e nunca deixa dois no mesmo número", async () => {
    writePhoneIdentity(TENANT_A, "phone-ok", {
      inboxEnabled: true,
      uiStatus: "ativo",
      channelName: "Relacionamento e Atendimento",
      displayPhoneNumber: "+55 51 92636-1688",
    });
    const first = upsertBotFlow(TENANT_A, createDefaultBotDraft("Link campanha A"));
    const second = upsertBotFlow(TENANT_A, createDefaultBotDraft("Link campanha B"));
    const service = new WabaBotService({
      listInboxConnections: async () => [],
    });
    await service.linkPhone(authA, { phoneNumberId: "phone-ok", botId: first.id });
    await service.linkPhone(authA, { phoneNumberId: "phone-ok", botId: second.id });
    const listed = await service.list(authA);
    const linksForPhone = listed.links.filter((row) => row.phoneNumberId === "phone-ok");
    assert.equal(linksForPhone.length, 1);
    assert.equal(linksForPhone[0]?.botId, second.id);
    assert.equal(getBotIdForPhone(TENANT_A, "phone-ok"), second.id);
    assert.notEqual(getBotIdForPhone(TENANT_A, "phone-ok"), first.id);
  });
});

describe("WABA bots — menu FARM BM", () => {
  it("mostra Bots abaixo de Atendimento na seção FARM BM", () => {
    const html = readFileSync(path.join(__dirname, "../../../../index.html"), "utf8");
    assert.match(html, /id="tab-btn-whatsapp-bots"/);
    assert.match(html, /data-menu-key="whatsapp-bots"/);
    assert.match(html, /data-menu-section="farm-bm"/);
    assert.match(html, /<span class="tab-label">Bots<\/span>/);
    assert.match(html, /id="tab-whatsapp-bots"/);
    assert.match(html, /row\.inboxEligible === true/);
    assert.match(html, /data-bot-chip-select/);
    assert.match(html, /data-bot-edit-chip/);
    assert.match(html, /data-bot-switch-open/);
    assert.match(html, /data-bot-create-on-chip/);
    assert.match(html, /Trocar bot/);
    assert.match(html, /Editar bot/);
    assert.match(html, /Criar bot neste chip/);
    assert.match(html, /Um chip só pode ter um bot/);
    assert.match(html, /id="waba-bots-builder"/);
    assert.match(html, /Construtor de bots/);
    assert.match(html, /wabaBotsOpenBuilder/);
    assert.match(html, /data-bot-add-kind/);
    assert.match(html, /wabaBotsNodeFromPoint/);
    assert.doesNotMatch(html, /Adicionar etapa…/);
    assert.doesNotMatch(html, /Associar a este bot/);
    assert.doesNotMatch(html, /id="waba-bots-test-reply"/);
    assert.doesNotMatch(html, /Resposta do contato/);
    assert.doesNotMatch(html, /id="waba-bots-test-continue"/);
    assert.doesNotMatch(html, /wabaBotsUi\.channels \|\| \[\]\)\.filter\(\(row\) => row\.inboxEnabled === true\)/);
    assert.match(html, /waba-bots-node-media-kind/);
    assert.match(html, /waba-bots-node-button-label/);
    assert.match(html, /waba-bots-node-button-url/);
    assert.match(html, /Nota de voz do WhatsApp/);
    assert.match(html, /botão CTA URL/);
    assert.match(html, /function wabaBotsApplyName/);
    assert.match(html, /event\.target\.id === "waba-bots-name"/);
    assert.match(html, /id="waba-bots-phone-search"/);
    assert.match(html, /wabaBotsChipMatchesPhoneQuery/);
    assert.match(html, /Pesquisar número/);
  });
});

describe("WABA bots — nome", () => {
  it("upsert mantém o nome novo do bot", () => {
    const created = upsertBotFlow(TENANT_A, createDefaultBotDraft("Bot Relacionamento e Atendimento"));
    const saved = upsertBotFlow(TENANT_A, { ...created, name: "Bot campanha de hoje" });
    assert.equal(saved.name, "Bot campanha de hoje");
    assert.equal(readBotFlow(TENANT_A, created.id)?.name, "Bot campanha de hoje");
  });
});

describe("WABA bots — mídia e link", () => {
  it("monta o botão oficial CTA URL da Cloud API", () => {
    const body = buildCloudCtaUrlBody({
      to: "5551999887766",
      text: "Abra o comprovante",
      buttonLabel: "Ver detalhes agora mesmo",
      url: "https://waba.draxsistemas.com.br/s/abc",
    });
    assert.equal(body.type, "interactive");
    const interactive = body.interactive as {
      type: string;
      action: { name: string; parameters: { display_text: string; url: string } };
    };
    assert.equal(interactive.type, "cta_url");
    assert.equal(interactive.action.name, "cta_url");
    assert.equal(interactive.action.parameters.display_text, "Ver detalhes agora m");
    assert.equal(interactive.action.parameters.url, "https://waba.draxsistemas.com.br/s/abc");
    assert.equal(normalizeBotHttpsUrl("http://exemplo.com"), "");
    assert.equal(normalizeBotButtonLabel("  Abrir  "), "Abrir");
  });

  it("envia áudio OGG como nota de voz nativa", () => {
    const body = buildCloudMediaBody({
      to: "5551999887766",
      kind: "audio",
      mediaId: "media-1",
      fileName: "nota.ogg",
      mime: "audio/ogg",
      voice: true,
    });
    assert.equal(body.type, "audio");
    assert.deepEqual(body.audio, { id: "media-1", voice: true });
  });

  it("prepara mídia e link no motor e segue o fluxo", async () => {
    const start = node("start", "s");
    const media = node("media", "m");
    media.data.config.mediaKind = "pdf";
    media.data.config.mediaUrl = "https://files.example.com/guia.pdf";
    media.data.config.mediaCaption = "Guia";
    const link = node("link", "l");
    link.data.config.text = "Abra o portal";
    link.data.config.buttonLabel = "Acessar";
    link.data.config.url = "https://drax.example.com/portal";
    const end = node("end", "e");
    const flow = normalizeBotDraft({
      id: "bot-media-link",
      name: "Mídia e link",
      nodes: [start, media, link, end],
      edges: [
        { id: "e1", source: "s", target: "m", sourceHandle: "out" },
        { id: "e2", source: "m", target: "l", sourceHandle: "out" },
        { id: "e3", source: "l", target: "e", sourceHandle: "out" },
      ],
    });
    assert.equal(flow.nodes.some((item) => item.data.kind === "media"), true);
    assert.equal(flow.nodes.some((item) => item.data.kind === "link"), true);
    const advanced = await advanceBotRun({
      flow,
      run: createBotRunState({ flow, testPhone: "5551999000000" }),
    });
    assert.equal(advanced.outbound.some((item) => item.type === "media" && item.media.mediaKind === "pdf"), true);
    assert.equal(
      advanced.outbound.some((item) => item.type === "cta_url" && item.cta.buttonLabel === "Acessar"),
      true,
    );
    assert.equal(advanced.run.phase, "finished");
  });

  it("recusa link sem https e mídia vazia", async () => {
    const emptyMedia = await executeBotNode({ node: node("media", "m"), variables: {} });
    assert.equal(emptyMedia.ok, false);
    const badLink = node("link", "l");
    badLink.data.config.url = "http://inseguro.example.com";
    const emptyLink = await executeBotNode({ node: badLink, variables: {} });
    assert.equal(emptyLink.ok, false);
  });
});

describe("WABA bots — avanço local", () => {
  it("cria rascunho com Início e avança até wait", async () => {
    const flow = welcomeFlow("bot-local");
    let run = createBotRunState({ flow, testPhone: "5551999000000" });
    const first = await advanceBotRun({ flow, run });
    assert.equal(first.run.phase, "waiting_reply");
    assert.ok(first.outboundTexts.some((text) => /Escolha/i.test(text)));
    const second = await advanceBotRun({
      flow,
      run: first.run,
      inboundText: "1",
    });
    assert.ok(second.run.phase === "waiting_reply" || second.run.phase === "finished");
  });
});
