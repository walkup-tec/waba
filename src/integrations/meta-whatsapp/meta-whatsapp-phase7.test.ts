import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import { MetaWhatsappTemplateService } from "./meta-whatsapp-template.service";
import { listWabaMessageTemplates } from "./meta-whatsapp-template-graph.client";
import { validateTemplateCreate } from "./meta-whatsapp-template-validate";
import {
  isTemplateApprovedForSend,
  type MetaTemplateRecord,
} from "./meta-whatsapp-template.types";
import { stripMetaSecrets } from "./meta-whatsapp-connection.service";
import { MetaWhatsappError, toPublicMetaError } from "./meta-whatsapp-errors";
import type { MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import { MetaCloudProvider } from "../whatsapp/meta-cloud-provider";
import { MetaWhatsappMessagingService } from "./meta-whatsapp-messaging.service";
import { MetaWhatsappWebhookService } from "./meta-whatsapp-webhook.service";
import { MetaWhatsappWebhookTemplateService } from "./meta-whatsapp-webhook-template.service";
import { parseMetaWebhookPayload } from "./meta-whatsapp-webhook-parser";
import { computeMetaHubSignatureHex } from "./meta-whatsapp-webhook-signature";
import type { MetaConversationRecord, MetaMessageRecord } from "./meta-whatsapp-messaging.types";
import type { MetaGraphMessagesResult } from "./meta-whatsapp-graph-messages.client";

const EMAIL_A = "phase7-a@example.com";
const EMAIL_B = "phase7-b@example.com";
const TENANT_A = deriveStableMetaTenantId(EMAIL_A);
const TENANT_B = deriveStableMetaTenantId(EMAIL_B);

function auth(email: string, role: WabaRequestAuth["role"] = "subscriber"): WabaRequestAuth {
  return { email, role };
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

function templateRow(overrides: Partial<MetaTemplateRecord> = {}): MetaTemplateRecord {
  return {
    id: "local-1",
    tenantId: TENANT_A,
    connectionId: "conn-a",
    wabaId: "waba-a",
    metaTemplateId: "tpl-1",
    name: "retorno_lead",
    language: "pt_BR",
    category: "MARKETING",
    status: "APPROVED",
    qualityScore: "GREEN",
    components: [{ type: "BODY", text: "Olá" }],
    rejectedReason: null,
    lastSyncedAt: "2026-08-25T12:00:00.000Z",
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
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
  async findConnectedByWabaId(wabaId: string) {
    return this.rows.find((row) => row.wabaId === wabaId && row.status === "connected") || null;
  }
  async touchLastWebhookAt() {}
  async patchConfirmedMetadata() {}
}

class FakeTemplates {
  rows: MetaTemplateRecord[] = [];

  async listByTenantConnection(tenantId: string, connectionId: string) {
    return this.rows.filter((row) => row.tenantId === tenantId && row.connectionId === connectionId);
  }
  async findForSend(tenantId: string, connectionId: string, name: string, language: string) {
    return (
      this.rows.find(
        (row) =>
          row.tenantId === tenantId &&
          row.connectionId === connectionId &&
          row.name === name &&
          row.language === language,
      ) || null
    );
  }
  async findByMetaId(tenantId: string, metaTemplateId: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.metaTemplateId === metaTemplateId) || null;
  }
  async findByWabaNameLanguage(tenantId: string, wabaId: string, name: string, language: string) {
    return (
      this.rows.find(
        (row) =>
          row.tenantId === tenantId && row.wabaId === wabaId && row.name === name && row.language === language,
      ) || null
    );
  }
  async upsertFromGraph(input: {
    tenantId: string;
    connectionId: string;
    wabaId: string;
    metaTemplateId?: string | null;
    name: string;
    language: string;
    category?: string | null;
    status?: string | null;
    components?: unknown;
    qualityScore?: string | null;
    rejectedReason?: string | null;
    lastSyncedAt: string;
  }) {
    const existing =
      (input.metaTemplateId ? await this.findByMetaId(input.tenantId, input.metaTemplateId) : null) ||
      (await this.findByWabaNameLanguage(input.tenantId, input.wabaId, input.name, input.language));
    const row = templateRow({
      ...(existing || {}),
      id: existing?.id || `local-${this.rows.length + 1}`,
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      wabaId: input.wabaId,
      metaTemplateId: input.metaTemplateId || existing?.metaTemplateId || null,
      name: input.name,
      language: input.language,
      category: input.category || null,
      status: input.status || null,
      components: input.components ?? null,
      qualityScore: input.qualityScore || null,
      rejectedReason: input.rejectedReason || null,
      lastSyncedAt: input.lastSyncedAt,
    });
    if (existing) {
      const idx = this.rows.findIndex((item) => item.id === existing.id);
      this.rows[idx] = row;
    } else {
      this.rows.push(row);
    }
    return row;
  }
  async patchStatus(input: {
    tenantId: string;
    wabaId: string;
    metaTemplateId?: string | null;
    name?: string | null;
    language?: string | null;
    status: string;
    rejectedReason?: string | null;
    atIso: string;
  }) {
    let row =
      (input.metaTemplateId ? await this.findByMetaId(input.tenantId, input.metaTemplateId) : null) ||
      (input.name && input.language
        ? await this.findByWabaNameLanguage(input.tenantId, input.wabaId, input.name, input.language)
        : null);
    if (!row) return null;
    row = {
      ...row,
      status: input.status,
      rejectedReason: input.rejectedReason || null,
      lastSyncedAt: input.atIso,
    };
    const idx = this.rows.findIndex((item) => item.id === row!.id);
    this.rows[idx] = row;
    return row;
  }
}

class FakeConversations {
  rows: MetaConversationRecord[] = [];
  async upsertForContact(input: { tenantId: string; connectionId: string; contactWaId: string; atIso: string }) {
    const existing = this.rows.find(
      (row) => row.tenantId === input.tenantId && row.contactWaId === input.contactWaId,
    ) || this.rows.find(
      (row) =>
        row.tenantId === input.tenantId &&
        row.connectionId === input.connectionId &&
        row.contactWaId === input.contactWaId,
    );
    if (existing) return { created: false, record: existing };
    const record = {
      id: "conv-1",
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      contactWaId: input.contactWaId,
    } as MetaConversationRecord;
    this.rows.push(record);
    return { created: true, record };
  }
}

class FakeMessages {
  rows: MetaMessageRecord[] = [];
  async insert(input: Partial<MetaMessageRecord>) {
    const record = { id: `msg-${this.rows.length + 1}`, status: "queued", ...input } as MetaMessageRecord;
    this.rows.push(record);
    return { record };
  }
  async updateAfterGraph(_tenantId: string, id: string, patch: Partial<MetaMessageRecord>) {
    const row = this.rows.find((item) => item.id === id);
    if (row) Object.assign(row, patch);
    return { record: row || null };
  }
}

function graphJson(json: unknown, extra: Partial<MetaGraphJsonResult> = {}): MetaGraphJsonResult {
  return {
    ok: true,
    status: 200,
    json,
    body: "{}",
    timeout: false,
    kind: "permanent",
    graphCode: null,
    attempts: 1,
    ...extra,
  };
}

function graphErr(status: number, extra: Partial<MetaGraphJsonResult> = {}): MetaGraphJsonResult {
  return {
    ok: false,
    status,
    json: { error: { code: extra.graphCode || status } },
    body: "{}",
    timeout: extra.timeout === true,
    kind: extra.kind || (status === 429 || status >= 500 || extra.timeout ? "transient" : "permanent"),
    graphCode: extra.graphCode ? String(extra.graphCode) : String(status),
    attempts: extra.attempts || 1,
    ...extra,
  };
}

function graphMsgOk(wamid = "wamid.TPL"): MetaGraphMessagesResult {
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

const VALID_CREATE = {
  name: "retorno_lead",
  language: "pt_BR",
  category: "MARKETING",
  components: [{ type: "BODY", text: "Olá, recebemos sua solicitação." }],
};

function sign(secret: string, raw: Buffer): string {
  return `sha256=${computeMetaHubSignatureHex(secret, raw)}`;
}

describe("fase 7 validação de template", () => {
  it("recusa template sem BODY e sem exemplos das variáveis", () => {
    assert.throws(
      () => validateTemplateCreate({ name: "x", language: "pt_BR", category: "MARKETING", components: [] }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_invalid",
    );
    assert.throws(
      () =>
        validateTemplateCreate({
          name: "retorno_lead",
          language: "pt_BR",
          category: "MARKETING",
          components: [{ type: "BODY", text: "Olá {{1}}" }],
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_invalid",
    );
  });

  it("aceita BODY com exemplo informado pelo cliente", () => {
    const validated = validateTemplateCreate({
      name: "Retorno_Lead",
      language: "pt-BR",
      category: "utility",
      components: [
        {
          type: "BODY",
          text: "Olá {{1}}, recebemos sua solicitação.",
          example: { body_text: [["Ana"]] },
        },
      ],
    });
    assert.equal(validated.name, "retorno_lead");
    assert.equal(validated.language, "pt_BR");
    assert.equal(validated.category, "UTILITY");
  });
});

describe("fase 7 listagem e tenant", () => {
  it("lista apenas templates do tenant connected e DTO sem token", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const templates = new FakeTemplates();
    templates.rows.push(templateRow());
    templates.rows.push(templateRow({ id: "other", tenantId: TENANT_B, connectionId: "conn-b", name: "outro" }));
    const service = new MetaWhatsappTemplateService(connections as any, templates as any, async () => {
      throw new Error("Graph não deve ser chamada na listagem local");
    });
    const listed = await service.listFromAuth(auth(EMAIL_A));
    assert.equal(listed.length, 1);
    assert.equal(listed[0].name, "retorno_lead");
    const serialized = JSON.stringify(stripMetaSecrets(listed));
    assert.equal(/access_token|accessTokenEncrypted|Bearer|v1:enc/i.test(serialized), false);
    assert.equal("tenantId" in listed[0], false);
  });

  it("conexão não connected recusa listagem", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow({ status: "pending_token" }));
    const service = new MetaWhatsappTemplateService(connections as any, new FakeTemplates() as any);
    await assert.rejects(
      () => service.listFromAuth(auth(EMAIL_A)),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "not_connected",
    );
  });

  it("lista templates somente do portfólio escolhido", async () => {
    const connections = new FakeConnections();
    connections.rows.push(
      connectedRow(),
      connectedRow({
        id: "conn-b",
        wabaId: "waba-b",
        phoneNumberId: "phone-b",
        updatedAt: "2026-09-02T00:00:00.000Z",
      }),
    );
    const templates = new FakeTemplates();
    templates.rows.push(
      templateRow(),
      templateRow({ id: "local-b", connectionId: "conn-b", wabaId: "waba-b", name: "template_b" }),
    );
    const service = new MetaWhatsappTemplateService(connections as any, templates as any);
    const listed = await service.listFromAuth(auth(EMAIL_A), "conn-b");
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.name, "template_b");
  });

  it("sessão guest não define tenant pelo body", async () => {
    const service = new MetaWhatsappTemplateService(new FakeConnections() as any, new FakeTemplates() as any);
    await assert.rejects(
      () => service.listFromAuth(auth("", "guest")),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "unauthenticated",
    );
  });
});

describe("fase 7 paginação Graph", () => {
  it("segue cursor after e para loop infinito", async () => {
    const calls: string[] = [];
    const listed = await listWabaMessageTemplates({
      token: "tok",
      wabaId: "waba-a",
      graph: async (input) => {
        calls.push(String(input.query?.after || ""));
        if (calls.length === 1) {
          return graphJson({
            data: [{ id: "1", name: "a", language: "pt_BR", status: "APPROVED" }],
            paging: { cursors: { after: "c1" } },
          });
        }
        if (calls.length === 2) {
          return graphJson({
            data: [{ id: "2", name: "b", language: "pt_BR", status: "PENDING" }],
            paging: { cursors: { after: "c1" } },
          });
        }
        return graphJson({ data: [{ id: "3", name: "c", language: "pt_BR" }], paging: { cursors: { after: "c1" } } });
      },
    });
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.equal(listed.pages, 2);
    assert.equal(listed.items.length, 2);
    assert.equal(calls.length, 2);
  });

  it("não assume que a primeira página contém todos", async () => {
    const listed = await listWabaMessageTemplates({
      token: "tok",
      wabaId: "waba-a",
      graph: async (input) => {
        if (!input.query?.after) {
          return graphJson({
            data: [{ id: "1", name: "p1", language: "pt_BR" }],
            paging: { cursors: { after: "next" } },
          });
        }
        return graphJson({ data: [{ id: "2", name: "p2", language: "en_US" }] });
      },
    });
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.equal(listed.pages, 2);
    assert.equal(listed.items.map((item) => item?.name).join(","), "p1,p2");
  });
});

describe("fase 7 criação e erros Graph", () => {
  function serviceWithGraph(
    graph: (input: { method: string; path: string; body?: Record<string, unknown> }) => Promise<MetaGraphJsonResult>,
    connections = new FakeConnections(),
    templates = new FakeTemplates(),
  ) {
    connections.rows.push(connectedRow());
    return {
      templates,
      service: new MetaWhatsappTemplateService(
        connections as any,
        templates as any,
        async (input) => graph(input),
        () => "plain-token",
      ),
    };
  }

  it("cria somente com DTO validado e persiste status da Meta", async () => {
    const calls: Record<string, unknown>[] = [];
    const { service, templates } = serviceWithGraph(async (input) => {
      calls.push(input.body || {});
      assert.equal(input.path, "waba-a/message_templates");
      assert.equal(input.method, "POST");
      return graphJson({ id: "tpl-meta", status: "PENDING", category: "UTILITY" });
    });
    const created = await service.createFromAuth(auth(EMAIL_A), {
      ...VALID_CREATE,
      access_token: "secret",
      waba_id: "other",
      tenant_id: TENANT_B,
    });
    assert.equal(created.metaTemplateId, "tpl-meta");
    assert.equal(created.status, "PENDING");
    assert.equal(created.category, "UTILITY");
    assert.equal(calls[0].name, "retorno_lead");
    assert.equal(calls[0].allow_category_change, true);
    assert.equal("access_token" in calls[0], false);
    assert.equal(templates.rows[0].tenantId, TENANT_A);
    assert.equal(JSON.stringify(created).includes("plain-token"), false);
  });

  it("template inválido não chama Graph", async () => {
    let called = false;
    const { service } = serviceWithGraph(async () => {
      called = true;
      return graphJson({});
    });
    await assert.rejects(
      () => service.createFromAuth(auth(EMAIL_A), { name: "Bad Name", language: "pt_BR", category: "MARKETING", components: [] }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_invalid",
    );
    assert.equal(called, false);
  });

  it("Graph 400", async () => {
    const { service } = serviceWithGraph(async () => graphErr(400));
    await assert.rejects(
      () => service.createFromAuth(auth(EMAIL_A), VALID_CREATE),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_invalid" && error.status === 400,
    );
  });

  it("Graph 401", async () => {
    const { service } = serviceWithGraph(async () => graphErr(401));
    await assert.rejects(
      () => service.createFromAuth(auth(EMAIL_A), VALID_CREATE),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "invalid_token",
    );
  });

  it("Graph 429", async () => {
    const { service } = serviceWithGraph(async () => graphErr(429));
    await assert.rejects(
      () => service.createFromAuth(auth(EMAIL_A), VALID_CREATE),
      (error: unknown) => {
        if (!(error instanceof MetaWhatsappError) || error.code !== "send_failed") return false;
        const publicError = toPublicMetaError(error);
        return publicError.status === 503 && /temporariamente/i.test(publicError.error);
      },
    );
  });

  it("Graph 5xx", async () => {
    const { service } = serviceWithGraph(async () => graphErr(500));
    await assert.rejects(
      () => service.createFromAuth(auth(EMAIL_A), VALID_CREATE),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "send_failed" && error.status === 503,
    );
  });

  it("timeout", async () => {
    const { service } = serviceWithGraph(async () => graphErr(0, { timeout: true, kind: "transient" }));
    await assert.rejects(
      () => service.createFromAuth(auth(EMAIL_A), VALID_CREATE),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "send_failed" && error.status === 503,
    );
  });
});

describe("fase 7 sync", () => {
  it("faz upsert e não apaga local ausente na página", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const templates = new FakeTemplates();
    templates.rows.push(templateRow({ id: "keep", name: "antigo_local", metaTemplateId: "keep-1" }));
    const service = new MetaWhatsappTemplateService(
      connections as any,
      templates as any,
      async () =>
        graphJson({
          data: [
            {
              id: "tpl-new",
              name: "novo",
              language: "pt_BR",
              category: "MARKETING",
              status: "APPROVED",
              quality_score: { score: "GREEN" },
              rejected_reason: "NONE",
              components: [{ type: "BODY", text: "Oi" }],
            },
          ],
        }),
      () => "tok",
    );
    const result = await service.syncFromAuth(auth(EMAIL_A));
    assert.equal(result.pages, 1);
    assert.equal(templates.rows.some((row) => row.name === "antigo_local"), true);
    assert.equal(templates.rows.some((row) => row.name === "novo" && row.status === "APPROVED"), true);
    assert.equal(result.templates.every((row) => !("accessTokenEncrypted" in row)), true);
  });
});

describe("fase 7 webhook de template", () => {
  const previousSecret = process.env.META_APP_SECRET;

  before(() => {
    process.env.META_APP_SECRET = "test-app-secret";
  });
  after(() => {
    if (previousSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previousSecret;
  });

  it("parseia idioma e motivo de rejeição", () => {
    const events = parseMetaWebhookPayload(
      {
        entry: [
          {
            id: "waba-a",
            changes: [
              {
                field: "message_template_status_update",
                value: {
                  event: "REJECTED",
                  message_template_id: "tpl-1",
                  message_template_name: "retorno_lead",
                  message_template_language: "pt_BR",
                  reason: "INVALID_FORMAT",
                },
              },
            ],
          },
        ],
      },
      "hash",
    );
    assert.equal(events[0].status, "REJECTED");
    assert.equal(events[0].templateLanguage, "pt_BR");
    assert.equal(events[0].rejectedReason, "INVALID_FORMAT");
  });

  async function postTemplateEvent(event: string, reason = "NONE") {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const templates = new FakeTemplates();
    templates.rows.push(templateRow({ status: "PENDING" }));
    const service = new MetaWhatsappWebhookService(
      connections as any,
      {
        insertIfNew: async () => ({ duplicate: false, id: "evt" }),
      } as any,
      { persistInbound: async () => undefined, applyStatus: async () => undefined },
      new MetaWhatsappWebhookTemplateService(templates as any),
    );
    const payload = {
      entry: [
        {
          id: "waba-a",
          changes: [
            {
              field: "message_template_status_update",
              value: {
                event,
                message_template_id: "tpl-1",
                message_template_name: "retorno_lead",
                message_template_language: "pt_BR",
                reason,
              },
            },
          ],
        },
      ],
    };
    const raw = Buffer.from(JSON.stringify(payload), "utf8");
    await service.processPostedEvent({
      rawBody: raw,
      signatureHeader: sign("test-app-secret", raw),
    });
    return templates.rows[0];
  }

  it("webhook approved atualiza status", async () => {
    const row = await postTemplateEvent("APPROVED");
    assert.equal(row.status, "APPROVED");
    assert.equal(row.rejectedReason, null);
  });

  it("webhook rejected atualiza status e motivo", async () => {
    const row = await postTemplateEvent("REJECTED", "SCAM");
    assert.equal(row.status, "REJECTED");
    assert.equal(row.rejectedReason, "SCAM");
  });
});

describe("fase 7 sendTemplate e isolamento", () => {
  it("não envia template de outro tenant", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const templates = new FakeTemplates();
    templates.rows.push(templateRow({ tenantId: TENANT_B, connectionId: "conn-b" }));
    const templateService = new MetaWhatsappTemplateService(connections as any, templates as any);
    await assert.rejects(
      () =>
        templateService.assertSendable({
          tenantId: TENANT_A,
          connectionId: "conn-a",
          name: "retorno_lead",
          language: "pt_BR",
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_not_found",
    );
  });

  it("não envia template que ainda não está APPROVED", async () => {
    const templates = new FakeTemplates();
    templates.rows.push(templateRow({ status: "PENDING" }));
    const service = new MetaWhatsappTemplateService(new FakeConnections() as any, templates as any);
    await assert.rejects(
      () =>
        service.assertSendable({
          tenantId: TENANT_A,
          connectionId: "conn-a",
          name: "retorno_lead",
          language: "pt_BR",
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_not_ready",
    );
    assert.equal(isTemplateApprovedForSend("PAUSED"), false);
  });

  it("sendTemplate da sessão só usa template local aprovado do tenant", async () => {
    const connections = new FakeConnections();
    connections.rows.push(connectedRow());
    const templates = new FakeTemplates();
    templates.rows.push(templateRow());
    const templateService = new MetaWhatsappTemplateService(connections as any, templates as any, undefined, () => "tok");
    let graphCalled = false;
    const provider = new MetaCloudProvider(connections as any, async () => {
      graphCalled = true;
      return graphMsgOk();
    }, () => "tok");
    const messaging = new MetaWhatsappMessagingService(
      provider,
      new FakeConversations() as any,
      new FakeMessages() as any,
      templateService,
    );
    const result = await messaging.sendFromAuth(auth(EMAIL_A), {
      to: "5551999887766",
      type: "template",
      template: { name: "retorno_lead", language: "pt_BR" },
      tenant_id: TENANT_B,
      access_token: "nope",
    });
    assert.equal(graphCalled, true);
    assert.equal(result.messageId, "wamid.TPL");
    assert.equal(JSON.stringify(stripMetaSecrets(result)).includes("nope"), false);
  });
});
