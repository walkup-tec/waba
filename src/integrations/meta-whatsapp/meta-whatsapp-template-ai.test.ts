import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  MetaWhatsappTemplateAiService,
  resolveMetaHeaderMediaMime,
  sniffMetaHeaderMediaMime,
  sanitizeGraphUploadFileName,
} from "./meta-whatsapp-template-ai.service";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { MetaTemplateAiModelOutput } from "./meta-whatsapp-template-ai.types";
import { callOpenAiStructured } from "../openai/waba-openai-responses.client";
import {
  META_TEMPLATE_AI_OUTPUT_SCHEMA,
  META_TEMPLATE_AI_SCHEMA_NAME,
  validateMetaTemplateAiOutput,
} from "./meta-whatsapp-template-ai.schema";
import { buildMetaTemplateAiInstructions } from "./meta-whatsapp-template-ai.prompt";
import {
  META_TEMPLATE_AI_FIXED_HEADER_TEXT,
  componentsFromAiOptionAndShell,
  parseMetaTemplateAiShell,
  templateNameForOption,
} from "./meta-whatsapp-template-ai-shell";
import { shapeMetaUtilityOptionBody } from "./meta-whatsapp-template-ai-utility-shape";
import { pickApprovedUtilityExamples } from "./meta-whatsapp-template-ai-approved-examples";
import {
  appendDisparosLinkNonce,
  assertMetaReadyButtonShortUrl,
  normalizeMetaTemplateDestinationUrl,
} from "./meta-whatsapp-template-ai-short-url";

const previousKey = process.env.OPENAI_API_KEY;
const previousLimit = process.env.META_TEMPLATE_AI_RATE_LIMIT_PER_MINUTE;

before(() => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.META_TEMPLATE_AI_RATE_LIMIT_PER_MINUTE = "5";
});
after(() => {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  if (previousLimit === undefined) delete process.env.META_TEMPLATE_AI_RATE_LIMIT_PER_MINUTE;
  else process.env.META_TEMPLATE_AI_RATE_LIMIT_PER_MINUTE = previousLimit;
});

function connection(email: string, overrides: Partial<MetaWhatsappConnectionRecord> = {}): MetaWhatsappConnectionRecord {
  return {
    id: "conn-utility",
    tenantId: deriveStableMetaTenantId(email),
    ownerEmail: email,
    metaBusinessId: "business-1",
    wabaId: "waba-1",
    phoneNumberId: "phone-1",
    displayPhoneNumber: "+5551999999999",
    verifiedName: "Drax",
    accessTokenEncrypted: "encrypted",
    tokenType: "bearer",
    tokenExpiresAt: null,
    configId: "config",
    status: "connected",
    qualityRating: "GREEN",
    messagingLimit: null,
    lastTokenValidationAt: null,
    lastWebhookAt: null,
    lastError: null,
    createdBy: email,
    updatedBy: email,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    connectedAt: "2026-09-01T00:00:00.000Z",
    disconnectedAt: null,
    ...overrides,
  };
}

function utilityOutput(): MetaTemplateAiModelOutput {
  return {
    recommendedCategory: "UTILITY",
    utilityCompatibility: 88,
    riskLevel: "MEDIUM",
    eligibleForUtility: true,
    assumedPriorEvent: "O destinatário solicitou previamente uma consulta de margem consignável.",
    reason: "O texto original tinha urgência comercial; as opções foram reescritas como atualização da solicitação existente.",
    issues: [],
    suggestions: ["Manter o texto operacional."],
    options: [
      {
        name: "consulta_margem_atualizacao_1",
        title: "atualização de solicitação",
        body: "Olá, {{1}}.\nInformamos que há uma atualização referente à consulta de margem consignável solicitada anteriormente.\nPara consultar a atualização da sua solicitação, use o link abaixo.",
        buttonText: "Ver Atualizações",
        variableExamples: ["Maria"],
        rationale: "Atualização objetiva da solicitação já aberta.",
      },
      {
        name: "consulta_margem_resultado_2",
        title: "resultado disponível",
        body: "Olá, {{1}}.\nInformamos que o resultado da consulta referente à sua solicitação de margem consignável está disponível.\nPara ver os detalhes do resultado, use o link abaixo.",
        buttonText: "Ver Detalhes",
        variableExamples: ["Maria"],
        rationale: "Informa que o resultado da consulta já solicitada está disponível.",
      },
      {
        name: "consulta_margem_acompanhamento_3",
        title: "acompanhamento",
        body: "Olá, {{1}}.\nInformamos que a sua solicitação de consulta de margem consignável recebeu um acompanhamento.\nPara acompanhar as informações atualizadas, use o link abaixo.",
        buttonText: "Saiba Mais",
        variableExamples: ["Maria"],
        rationale: "Acompanhamento operacional do processo existente.",
      },
    ],
    disclaimer: "Avaliação interna por IA. A análise final é realizada pela Meta.",
  };
}

function serviceFor(
  email: string,
  output: unknown,
  templateService?: { createFromAuth(auth: unknown, input: Record<string, unknown>): Promise<any> },
  connectionOverrides: Partial<MetaWhatsappConnectionRecord> = {},
  createButtonShortUrl?: (input: { destinationUrl: string; tenantId: string }) => Promise<string>,
  onOpenAi?: (request: { input: string; instructions: string }) => void,
) {
  const row = connection(email, connectionOverrides);
  const stored: Array<Record<string, unknown>> = [];
  let savedResult: MetaTemplateAiModelOutput | null = null;
  return {
    stored,
    service: new MetaWhatsappTemplateAiService(
      {
        async findByIdForTenant(tenantId: string, id: string) {
          return tenantId === row.tenantId && id === row.id ? row : null;
        },
      } as any,
      {
        async create(input: Record<string, unknown>) {
          stored.push(input);
          savedResult = input.result as MetaTemplateAiModelOutput;
          return "analysis-1";
        },
        async findForSubmission(tenantId: string, connectionId: string, analysisId: string) {
          if (tenantId !== row.tenantId || connectionId !== row.id || analysisId !== "analysis-1" || !savedResult) {
            return null;
          }
          return {
            id: analysisId,
            language: "pt_BR",
            eligibleForUtility: savedResult.eligibleForUtility,
            result: savedResult,
          };
        },
        async listSubmittedNames() {
          return new Set<string>();
        },
      } as any,
      async (request) => {
        onOpenAi?.(request);
        return {
          value: output,
          model: "gpt-test",
          responseId: "resp-1",
          latencyMs: 12,
        };
      },
      (templateService || {
        async findByNameForConnection() {
          return null;
        },
        async createFromAuth(_auth: unknown, input: Record<string, unknown>) {
          return {
            id: `template-${String(input.name)}`,
            status: "PENDING",
          };
        },
      }) as any,
      undefined,
      undefined,
      createButtonShortUrl ||
        (async () => "https://waba.draxsistemas.com.br/s/tpltest1"),
    ),
  };
}

function submitShell(overrides: Record<string, unknown> = {}) {
  return {
    connectionId: "conn-utility",
    analysisId: "analysis-1",
    modelName: "retorno_lead",
    variableType: "nome",
    mediaFormat: "NONE",
    headerText: "Atualização da solicitação",
    buttonText: "Ver Detalhes",
    buttonUrl: "https://waba.draxsistemas.com.br/retorno",
    ...overrides,
  };
}

describe("Assistente IA de templates Utility", () => {
  it("gera exatamente três opções e persiste a análise no portfólio escolhido", async () => {
    const email = "ai-utility@example.com";
    const { service, stored } = serviceFor(email, utilityOutput());
    const result = await service.generateFromAuth(
      { email, role: "subscriber" },
      { connectionId: "conn-utility", baseText: "A proposta solicitada teve atualização." },
    );
    assert.equal(result.options.length, 3);
    assert.equal(result.recommendedCategory, "UTILITY");
    assert.equal(result.analysisId, "analysis-1");
    assert.equal(stored[0]?.connectionId, "conn-utility");
  });

  it("reescreve texto promocional em três opções Utility ancoradas em evento anterior", async () => {
    const email = "ai-marketing-reframe@example.com";
    const output = utilityOutput();
    const { service } = serviceFor(email, output);
    const result = await service.generateFromAuth(
      { email, role: "subscriber" },
      {
        connectionId: "conn-utility",
        baseText:
          "Oi! Vi que sua margem consignável está disponível no Governo do Amazonas — e achei importante te avisar antes que alguém na frente aproveite primeiro.",
      },
    );
    assert.equal(result.eligibleForUtility, true);
    assert.equal(result.options.length, 3);
    assert.match(result.assumedPriorEvent, /solicitou previamente/i);
    assert.match(result.options[0]?.body || "", /solicitada anteriormente/i);
    assert.match(result.options[0]?.body || "", /^Olá, \{\{1\}\}\./);
    assert.match(result.options[0]?.body || "", /Informamos que/i);
    assert.match(result.options[0]?.body || "", /\bPara\b/);
    assert.equal(result.options[0]?.buttonText, "Ver Atualizações");
    assert.equal(result.options[1]?.buttonText, "Ver Detalhes");
    assert.equal(result.options[2]?.buttonText, "Saiba Mais");
  });

  it("rejeita resposta sem as três opções Utility", async () => {
    const email = "ai-invalid@example.com";
    const output = utilityOutput();
    output.options = output.options.slice(0, 2);
    const { service } = serviceFor(email, output);
    await assert.rejects(
      () =>
        service.generateFromAuth(
          { email, role: "subscriber" },
          { connectionId: "conn-utility", baseText: "Atualização de solicitação." },
        ),
      (error: unknown) =>
        error instanceof MetaWhatsappError && error.code === "template_ai_invalid_output",
    );
  });

  it("não aceita portfólio de outro tenant", async () => {
    const email = "ai-tenant@example.com";
    const { service } = serviceFor(email, utilityOutput());
    await assert.rejects(
      () =>
        service.generateFromAuth(
          { email: "outro@example.com", role: "subscriber" },
          { connectionId: "conn-utility", baseText: "Atualização de solicitação." },
        ),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "not_connected",
    );
  });

  it("gera opções para WABA em pending_confirmation com token e WABA definidos", async () => {
    const email = "ai-pending-confirmation@example.com";
    const { service } = serviceFor(email, utilityOutput(), undefined, {
      status: "pending_confirmation",
    });
    const result = await service.generateFromAuth(
      { email, role: "subscriber" },
      { connectionId: "conn-utility", baseText: "Atualização de solicitação existente." },
    );
    assert.equal(result.options.length, 3);
  });

  it("limita chamadas por tenant e usuário", async () => {
    const email = "ai-rate-limit@example.com";
    const { service } = serviceFor(email, utilityOutput());
    process.env.META_TEMPLATE_AI_RATE_LIMIT_PER_MINUTE = "1";
    try {
      await service.generateFromAuth(
        { email, role: "subscriber" },
        { connectionId: "conn-utility", baseText: "Atualização da solicitação." },
      );
      await assert.rejects(
        () =>
          service.generateFromAuth(
            { email, role: "subscriber" },
            { connectionId: "conn-utility", baseText: "Outra atualização da solicitação." },
          ),
        (error: unknown) =>
          error instanceof MetaWhatsappError && error.code === "template_ai_rate_limited",
      );
    } finally {
      process.env.META_TEMPLATE_AI_RATE_LIMIT_PER_MINUTE = "5";
    }
  });

  it("cadastra as três opções com botão URL estático e preserva falha individual", async () => {
    const email = "ai-submit-three@example.com";
    const calls: Array<Record<string, unknown>> = [];
    const { service } = serviceFor(email, utilityOutput(), {
      async createFromAuth(_auth: unknown, input: Record<string, unknown>) {
        calls.push(input);
        const name = String(input.name || "");
        if (name.endsWith("_2")) throw new MetaWhatsappError("template_invalid");
        return { id: `local-${name}`, status: "PENDING" };
      },
    });
    await service.generateFromAuth(
      { email, role: "subscriber" },
      { connectionId: "conn-utility", baseText: "Atualização da proposta solicitada." },
    );
    const result = await service.submitAllFromAuth(
      { email, role: "subscriber" },
      submitShell(),
    );
    assert.equal(calls.length, 3);
    assert.equal(result.total, 3);
    assert.equal(result.submitted, 2);
    assert.equal(result.failed, 1);
    assert.equal(result.results[1]?.ok, false);
    assert.equal(calls[0]?.name, "retorno_lead_1");
    const firstButtons = (calls[0]?.components as Array<Record<string, any>> | undefined)
      ?.find((item) => item.type === "BUTTONS");
    assert.equal(firstButtons?.buttons?.[0]?.type, "URL");
    assert.equal(firstButtons?.buttons?.[0]?.text, "Ver Detalhes");
    assert.equal(firstButtons?.buttons?.[0]?.url, "https://waba.draxsistemas.com.br/s/tpltest1");
    assert.equal("metaButtonUrl" in result, false);
    const header = (calls[0]?.components as Array<Record<string, any>> | undefined)
      ?.find((item) => item.type === "HEADER");
    assert.equal(header?.format, "TEXT");
    assert.equal(header?.text, META_TEMPLATE_AI_FIXED_HEADER_TEXT);
  });

  it("reenvia à Graph se a análise já tinha o nome mas o template local foi apagado", async () => {
    const email = "ai-resubmit-gone@example.com";
    const calls: string[] = [];
    const row = connection(email);
    let savedResult: MetaTemplateAiModelOutput | null = null;
    const service = new MetaWhatsappTemplateAiService(
      {
        async findByIdForTenant(tenantId: string, id: string) {
          return tenantId === row.tenantId && id === row.id ? row : null;
        },
      } as any,
      {
        async create(input: Record<string, unknown>) {
          savedResult = input.result as MetaTemplateAiModelOutput;
          return "analysis-1";
        },
        async findForSubmission(tenantId: string, connectionId: string, analysisId: string) {
          if (tenantId !== row.tenantId || connectionId !== row.id || analysisId !== "analysis-1" || !savedResult) {
            return null;
          }
          return {
            id: analysisId,
            language: "pt_BR",
            eligibleForUtility: savedResult.eligibleForUtility,
            result: savedResult,
          };
        },
        async listSubmittedNames() {
          return new Set(["retorno_lead_1", "retorno_lead_2", "retorno_lead_3"]);
        },
      } as any,
      async () => ({
        value: utilityOutput(),
        model: "gpt-test",
        responseId: "resp-1",
        latencyMs: 12,
      }),
      {
        async findByNameForConnection() {
          return null;
        },
        async createFromAuth(_auth: unknown, input: Record<string, unknown>) {
          calls.push(String(input.name || ""));
          return { id: `local-${String(input.name)}`, status: "PENDING" };
        },
      } as any,
      undefined,
      undefined,
      async () => "https://waba.draxsistemas.com.br/s/tpltest1",
    );
    await service.generateFromAuth(
      { email, role: "subscriber" },
      { connectionId: "conn-utility", baseText: "Atualização da proposta solicitada." },
    );
    const result = await service.submitAllFromAuth({ email, role: "subscriber" }, submitShell());
    assert.equal(calls.length, 3);
    assert.equal(result.submitted, 3);
    assert.equal(result.failed, 0);
    assert.equal(result.results.every((item) => item.alreadySubmitted === false), true);
    assert.equal(result.portfolioName, "Drax");
    assert.equal(result.wabaId, "waba-1");
  });

  it("não chama Graph de novo se o template local ainda existe", async () => {
    const email = "ai-skip-live@example.com";
    const calls: string[] = [];
    const row = connection(email);
    let savedResult: MetaTemplateAiModelOutput | null = null;
    const service = new MetaWhatsappTemplateAiService(
      {
        async findByIdForTenant(tenantId: string, id: string) {
          return tenantId === row.tenantId && id === row.id ? row : null;
        },
      } as any,
      {
        async create(input: Record<string, unknown>) {
          savedResult = input.result as MetaTemplateAiModelOutput;
          return "analysis-1";
        },
        async findForSubmission(tenantId: string, connectionId: string, analysisId: string) {
          if (tenantId !== row.tenantId || connectionId !== row.id || analysisId !== "analysis-1" || !savedResult) {
            return null;
          }
          return {
            id: analysisId,
            language: "pt_BR",
            eligibleForUtility: savedResult.eligibleForUtility,
            result: savedResult,
          };
        },
        async listSubmittedNames() {
          return new Set(["retorno_lead_1", "retorno_lead_2", "retorno_lead_3"]);
        },
      } as any,
      async () => ({
        value: utilityOutput(),
        model: "gpt-test",
        responseId: "resp-1",
        latencyMs: 12,
      }),
      {
        async findByNameForConnection(_tenantId: string, _connectionId: string, name: string) {
          return { id: `keep-${name}`, status: "PENDING" };
        },
        async createFromAuth() {
          calls.push("graph");
          throw new Error("Graph não deve ser chamada");
        },
      } as any,
      undefined,
      undefined,
      async () => {
        throw new Error("encurtador não deve rodar");
      },
    );
    await service.generateFromAuth(
      { email, role: "subscriber" },
      { connectionId: "conn-utility", baseText: "Atualização da proposta solicitada." },
    );
    const result = await service.submitAllFromAuth({ email, role: "subscriber" }, submitShell());
    assert.equal(calls.length, 0);
    assert.equal(result.submitted, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.results.every((item) => item.alreadySubmitted === true), true);
  });
  it("instrui a IA a reescrever o tema central em três Utility, sem recusar o texto base", () => {
    const instructions = buildMetaTemplateAiInstructions();
    assert.match(instructions, /Não recuse a geração/i);
    assert.match(instructions, /evento anterior/i);
    assert.match(instructions, /atualização da solicitação/i);
    assert.match(instructions, /resultado disponível/i);
    assert.match(instructions, /acompanhamento/i);
    assert.match(instructions, /Acessar site/i);
    assert.match(instructions, /variableType/i);
    assert.match(instructions, /nenhuma/i);
    assert.match(instructions, /Informamos que/i);
    assert.match(instructions, /PALAVRAS DE UTILIDADE/i);
    assert.match(instructions, /Confirmação/);
    assert.match(instructions, /Status Confirmado/);
    assert.match(instructions, /Confirmado/);
    assert.match(instructions, /aprovado/);
    assert.match(instructions, /concluído/);
    assert.match(instructions, /atualizado/);
    assert.match(instructions, /liberado/);
    assert.match(instructions, /Ver Detalhes/);
    assert.match(instructions, /Saiba Mais/);
    assert.match(instructions, /Ver Atualizações/);
    assert.match(instructions, /BIBLIOTECA UTILITY DA META/i);
    assert.match(instructions, /TEMA CENTRAL/i);
    assert.match(instructions, /use o link abaixo/i);
    assert.doesNotMatch(instructions, /retorne options=\[\]/);
  });

  it("envia à IA só templates do tenant aprovados como Utility", async () => {
    const email = "ai-memory@example.com";
    let payload = "";
    const { service } = serviceFor(
      email,
      utilityOutput(),
      {
        async createFromAuth() {
          return { id: "local", status: "PENDING" };
        },
        async listApprovedUtilityExamples() {
          return [
            {
              name: "consulta_aprovada",
              language: "pt_BR",
              body: "Olá, {{1}}.\nInformamos que a consulta solicitada foi atualizada.\nPara ver os detalhes, use o link abaixo.",
              buttonText: "Ver Detalhes",
            },
          ];
        },
      } as any,
      {},
      undefined,
      (request) => {
        payload = request.input;
      },
    );
    await service.generateFromAuth(
      { email, role: "subscriber" },
      { connectionId: "conn-utility", baseText: "Atualização da consulta solicitada." },
    );
    const parsed = JSON.parse(payload);
    assert.equal(parsed.approvedUtilityExamples.length, 1);
    assert.equal(parsed.approvedUtilityExamples[0].name, "consulta_aprovada");
    assert.match(buildMetaTemplateAiInstructions(), /approvedUtilityExamples/);
  });

  it("escolhe exemplos Utility aprovados e ignora Marketing ou pendentes", () => {
    const picked = pickApprovedUtilityExamples([
      {
        id: "mkt",
        tenantId: "t",
        connectionId: "c",
        wabaId: "w",
        metaTemplateId: "1",
        name: "promo",
        language: "pt_BR",
        category: "MARKETING",
        status: "APPROVED",
        qualityScore: null,
        components: [{ type: "BODY", text: "Aproveite a oferta." }],
        rejectedReason: null,
        lastSyncedAt: "2026-09-02T02:00:00.000Z",
        createdAt: "2026-09-02T02:00:00.000Z",
        updatedAt: "2026-09-02T02:00:00.000Z",
      },
      {
        id: "pend",
        tenantId: "t",
        connectionId: "c",
        wabaId: "w",
        metaTemplateId: "2",
        name: "ainda_nao",
        language: "pt_BR",
        category: "UTILITY",
        status: "PENDING",
        qualityScore: null,
        components: [{ type: "BODY", text: "Olá. Informamos que está em análise." }],
        rejectedReason: null,
        lastSyncedAt: "2026-09-02T03:00:00.000Z",
        createdAt: "2026-09-02T03:00:00.000Z",
        updatedAt: "2026-09-02T03:00:00.000Z",
      },
      {
        id: "ok",
        tenantId: "t",
        connectionId: "c",
        wabaId: "w",
        metaTemplateId: "3",
        name: "consulta_ok",
        language: "pt_BR",
        category: "UTILITY",
        status: "APPROVED",
        qualityScore: null,
        components: [
          { type: "BODY", text: "Olá.\nInformamos que a solicitação foi atualizada.\nPara consultar, use o link abaixo." },
          { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Bloquear" }, { type: "URL", text: "Ver Detalhes" }] },
        ],
        rejectedReason: null,
        lastSyncedAt: "2026-09-02T01:00:00.000Z",
        createdAt: "2026-09-02T01:00:00.000Z",
        updatedAt: "2026-09-02T01:00:00.000Z",
      },
    ]);
    assert.equal(picked.length, 1);
    assert.equal(picked[0]?.name, "consulta_ok");
    assert.equal(picked[0]?.buttonText, "Ver Detalhes");
  });

  it("completa Olá, Informamos que e Para quando a IA omite o léxico Utility", () => {
    const shaped = shapeMetaUtilityOptionBody(
      "Há uma atualização referente à consulta de margem consignável solicitada anteriormente.",
      "nome",
      0,
    );
    assert.match(shaped, /^Olá, \{\{1\}\}\./);
    assert.match(shaped, /Informamos que há uma atualização/i);
    assert.match(shaped, /Para consultar a atualização/i);
    assert.doesNotMatch(shaped, /aproveite/i);
  });

  it("insere âncora de utilidade quando o BODY não tem confirmação, status ou atualizado", () => {
    const shaped = shapeMetaUtilityOptionBody(
      "Informamos que o protocolo da solicitação está disponível.",
      "nome",
      1,
    );
    assert.match(shaped, /^Olá, \{\{1\}\}\./);
    assert.match(shaped, /Informamos que o protocolo/i);
    assert.match(shaped, /status está confirmado/i);
    assert.match(shaped, /Para ver os detalhes do resultado/i);
  });

  it("rejeita JSON sem as três opções ou com finalidade Marketing", () => {
    assert.throws(() => validateMetaTemplateAiOutput({ ...utilityOutput(), options: [] }));
    assert.throws(() =>
      validateMetaTemplateAiOutput({
        ...utilityOutput(),
        recommendedCategory: "MARKETING",
        eligibleForUtility: false,
        options: [],
      }),
    );
    const valid = validateMetaTemplateAiOutput(utilityOutput());
    assert.equal(valid.options.length, 3);
  });

  it("monta HEADER de mídia e botão URL estático no envelope da Meta", () => {
    const shell = parseMetaTemplateAiShell({
      modelName: "Retorno Lead",
      variableType: "numero",
      mediaFormat: "IMAGE",
      buttonText: "Saiba Mais",
      buttonUrl: "https://waba.draxsistemas.com.br/retorno",
      headerHandle: "4::abc",
    });
    assert.equal(templateNameForOption(shell.modelName, 0), "retorno_lead_1");
    const components = componentsFromAiOptionAndShell(utilityOutput().options[0], shell);
    assert.equal(components[0]?.type, "HEADER");
    assert.equal(components[0]?.format, "IMAGE");
    assert.deepEqual((components[0] as { example?: { header_handle?: string[] } }).example?.header_handle, ["4::abc"]);
    assert.equal(components[2]?.type, "BUTTONS");
  });

  it("não envia placeholders no BODY quando o tipo de variável é Nenhuma", () => {
    const shell = parseMetaTemplateAiShell({
      modelName: "retorno_lead",
      variableType: "nenhuma",
      buttonText: "Ver Detalhes",
      buttonUrl: "https://waba.draxsistemas.com.br/retorno",
    });
    const components = componentsFromAiOptionAndShell(utilityOutput().options[0], shell);
    const body = components.find((item) => item.type === "BODY") as { text?: string; example?: unknown };
    assert.equal(body?.example, undefined);
    assert.equal(String(body?.text || "").includes("{{"), false);
    assert.match(String(body?.text || ""), /^Olá\./);
  });

  it("envia sempre o HEADER de texto fixo e ignora o valor do cliente", () => {
    const shell = parseMetaTemplateAiShell({
      modelName: "dg01",
      variableType: "nenhuma",
      buttonText: "Ver Detalhes",
      buttonUrl: "https://waba.draxsistemas.com.br/retorno",
      headerText: "Texto do HEADER",
    });
    assert.equal(shell.headerText, META_TEMPLATE_AI_FIXED_HEADER_TEXT);
    const components = componentsFromAiOptionAndShell(utilityOutput().options[0], shell);
    const header = components.find((item) => item.type === "HEADER");
    assert.equal(header?.format, "TEXT");
    assert.equal(header?.text, "Informação de utilidade");
  });

  it("aceita wa.me e http como destino; a Meta só recebe o link curto WABA", async () => {
    const destination = parseMetaTemplateAiShell({
      modelName: "retorno_lead",
      buttonText: "Ver Detalhes",
      buttonUrl: "https://wa.me/5511999999999",
    });
    assert.equal(destination.buttonUrl, "https://wa.me/5511999999999");
    const httpDest = parseMetaTemplateAiShell({
      modelName: "retorno_lead",
      buttonText: "Ver Detalhes",
      buttonUrl: "http://example.com/retorno",
    });
    assert.equal(httpDest.buttonUrl, "http://example.com/retorno");

    const email = "ai-short-wa@example.com";
    const seen: string[] = [];
    const calls: Array<Record<string, unknown>> = [];
    const { service } = serviceFor(
      email,
      utilityOutput(),
      {
        async createFromAuth(_auth: unknown, input: Record<string, unknown>) {
          calls.push(input);
          return { id: `local-${String(input.name)}`, status: "PENDING" };
        },
      },
      {},
      async (input) => {
        seen.push(input.destinationUrl);
        return "https://waba.draxsistemas.com.br/s/walkup1";
      },
    );
    await service.generateFromAuth(
      { email, role: "subscriber" },
      { connectionId: "conn-utility", baseText: "Atualização da proposta solicitada." },
    );
    const result = await service.submitAllFromAuth(
      { email, role: "subscriber" },
      submitShell({ buttonUrl: "https://wa.me/5511999999999" }),
    );
    assert.deepEqual(seen, ["https://wa.me/5511999999999"]);
    assert.equal(result.submitted, 3);
    assert.equal("metaButtonUrl" in result, false);
    const firstButtons = (calls[0]?.components as Array<Record<string, any>> | undefined)
      ?.find((item) => item.type === "BUTTONS");
    assert.equal(firstButtons?.buttons?.[0]?.url, "https://waba.draxsistemas.com.br/s/walkup1");
    assert.equal(calls.length, 3);
    assert.equal(
      (calls[2]?.components as Array<Record<string, any>> | undefined)
        ?.find((item) => item.type === "BUTTONS")?.buttons?.[0]?.url,
      "https://waba.draxsistemas.com.br/s/walkup1",
    );
  });

  it("falha o lote se o encurtador WABA não gerar o link curto", async () => {
    const email = "ai-short-fail@example.com";
    const { service } = serviceFor(
      email,
      utilityOutput(),
      undefined,
      {},
      async () => {
        throw new MetaWhatsappError("template_shorten_failed");
      },
    );
    await service.generateFromAuth(
      { email, role: "subscriber" },
      { connectionId: "conn-utility", baseText: "Atualização da proposta solicitada." },
    );
    await assert.rejects(
      () => service.submitAllFromAuth({ email, role: "subscriber" }, submitShell()),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_shorten_failed",
    );
  });

  it("normaliza destino como a campanha e só aceita /s/ https na Meta", () => {
    assert.equal(normalizeMetaTemplateDestinationUrl("seusite.com.br/retorno"), "https://seusite.com.br/retorno");
    assert.match(appendDisparosLinkNonce("https://wa.me/5511999999999", "abc"), /_n8n_link_nonce=abc/);
    assert.equal(
      assertMetaReadyButtonShortUrl("https://waba.draxsistemas.com.br/s/abc1234"),
      "https://waba.draxsistemas.com.br/s/abc1234",
    );
    assert.throws(
      () => assertMetaReadyButtonShortUrl("https://wa.me/5511999999999"),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_url_restricted",
    );
  });

  it("recusa URL inválida ou botão fora do select do Mensageiro", () => {
    assert.throws(
      () =>
        parseMetaTemplateAiShell({
          modelName: "retorno_lead",
          buttonText: "Ver Detalhes",
          buttonUrl: "whatsapp://send?phone=5511999999999",
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_url_https",
    );
    assert.throws(
      () =>
        parseMetaTemplateAiShell({
          modelName: "retorno_lead",
          buttonText: "Consultar solicitação",
          buttonUrl: "https://example.com",
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_invalid",
    );
  });

  it("exige arquivo de mídia e aceita PNG com MIME genérico", () => {
    assert.throws(
      () =>
        parseMetaTemplateAiShell({
          modelName: "dg01",
          buttonText: "Ver Detalhes",
          buttonUrl: "https://waba.draxsistemas.com.br/retorno",
          mediaFormat: "IMAGE",
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "template_media_required",
    );
    assert.equal(
      resolveMetaHeaderMediaMime("IMAGE", "application/octet-stream", "ChatGPT Image.png"),
      "image/png",
    );
    assert.equal(resolveMetaHeaderMediaMime("IMAGE", "image/x-png", "foto.png"), "image/png");
    assert.equal(
      resolveMetaHeaderMediaMime("IMAGE", "image/png; charset=utf-8", "sem-extensao"),
      "image/png",
    );
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);
    assert.equal(sniffMetaHeaderMediaMime(pngBytes), "image/png");
    assert.equal(
      resolveMetaHeaderMediaMime("IMAGE", "application/octet-stream", "arquivo", pngBytes),
      "image/png",
    );
    assert.equal(sanitizeGraphUploadFileName("ChatGPT Image 02-09-2026.png", "image/png"), "header.png");
  });

  it("não recusa cabeçalho de imagem só por passar de 5 MB", async () => {
    const png = Buffer.alloc(5 * 1024 * 1024 + 8, 0);
    png[0] = 0x89;
    png[1] = 0x50;
    png[2] = 0x4e;
    png[3] = 0x47;
    png[4] = 0x0d;
    png[5] = 0x0a;
    png[6] = 0x1a;
    png[7] = 0x0a;
    const service = new MetaWhatsappTemplateAiService();
    try {
      await service.uploadHeaderMediaFromAuth(
        { email: "tpl-media@exemplo.com", role: "subscriber" },
        {
          connectionId: "conn-1",
          mediaFormat: "IMAGE",
          fileName: "ChatGPT Image.png",
          mime: "image/png",
          bytes: png,
        },
      );
    } catch (error) {
      assert.notEqual(
        error instanceof MetaWhatsappError ? error.code : "",
        "template_media_too_large",
      );
      return;
    }
    assert.ok(true);
  });
});
describe("OpenAI Responses com Structured Outputs", () => {
  it("envia JSON Schema estrito usando as mesmas variáveis OpenAI", async () => {
    const originalFetch = globalThis.fetch;
    let requestBody: Record<string, any> = {};
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body || "{}"));
      return new Response(
        JSON.stringify({
          id: "resp-structured",
          model: "gpt-test",
          output_text: JSON.stringify(utilityOutput()),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      const result = await callOpenAiStructured({
        instructions: "Sistema",
        input: "Texto base",
        schemaName: META_TEMPLATE_AI_SCHEMA_NAME,
        schema: META_TEMPLATE_AI_OUTPUT_SCHEMA,
      });
      assert.equal(result.responseId, "resp-structured");
      assert.equal(requestBody.store, false);
      assert.equal(requestBody.text.format.type, "json_schema");
      assert.equal(requestBody.text.format.strict, true);
      assert.equal(JSON.stringify(requestBody).includes("test-openai-key"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
