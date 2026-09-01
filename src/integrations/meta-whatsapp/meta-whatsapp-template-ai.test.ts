import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { MetaWhatsappTemplateAiService } from "./meta-whatsapp-template-ai.service";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { MetaTemplateAiModelOutput } from "./meta-whatsapp-template-ai.types";
import { callOpenAiStructured } from "../openai/waba-openai-responses.client";
import {
  META_TEMPLATE_AI_OUTPUT_SCHEMA,
  META_TEMPLATE_AI_SCHEMA_NAME,
} from "./meta-whatsapp-template-ai.schema";

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
    utilityCompatibility: 92,
    riskLevel: "LOW",
    eligibleForUtility: true,
    reason: "Atualização diretamente relacionada à solicitação existente.",
    issues: [],
    suggestions: ["Manter o texto operacional."],
    options: [1, 2, 3].map((number) => ({
      name: `atualizacao_proposta_${number}`,
      body: `Sua proposta solicitada teve uma atualização. Consulte os detalhes no atendimento. Versão ${number}.`,
      variableExamples: [],
      rationale: "Versão objetiva e vinculada à solicitação.",
    })),
    disclaimer: "Avaliação interna por IA. A análise final é realizada pela Meta.",
  };
}

function serviceFor(email: string, output: unknown) {
  const row = connection(email);
  const stored: Array<Record<string, unknown>> = [];
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
          return "analysis-1";
        },
      } as any,
      async () => ({
        value: output,
        model: "gpt-test",
        responseId: "resp-1",
        latencyMs: 12,
      }),
    ),
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

  it("não gera Utility disfarçada quando a finalidade é Marketing", async () => {
    const email = "ai-marketing@example.com";
    const output: MetaTemplateAiModelOutput = {
      ...utilityOutput(),
      recommendedCategory: "MARKETING",
      utilityCompatibility: 10,
      riskLevel: "HIGH",
      eligibleForUtility: false,
      reason: "O texto promove uma nova oferta.",
      options: [],
    };
    const { service } = serviceFor(email, output);
    const result = await service.generateFromAuth(
      { email, role: "subscriber" },
      { connectionId: "conn-utility", baseText: "Nova oferta de empréstimo. Contrate agora." },
    );
    assert.equal(result.eligibleForUtility, false);
    assert.equal(result.options.length, 0);
  });

  it("rejeita resposta inconsistente ou com menos de três opções", async () => {
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
