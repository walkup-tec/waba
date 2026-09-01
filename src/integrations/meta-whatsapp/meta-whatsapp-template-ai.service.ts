import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import {
  callOpenAiStructured,
  type OpenAiStructuredResult,
} from "../openai/waba-openai-responses.client";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { validateTemplateCreate } from "./meta-whatsapp-template-validate";
import {
  buildMetaTemplateAiInstructions,
  META_TEMPLATE_AI_POLICY_VERSION,
  META_TEMPLATE_AI_PROMPT_VERSION,
} from "./meta-whatsapp-template-ai.prompt";
import { MetaWhatsappTemplateAiRepository } from "./meta-whatsapp-template-ai.repository";
import {
  META_TEMPLATE_AI_OUTPUT_SCHEMA,
  META_TEMPLATE_AI_SCHEMA_NAME,
  validateMetaTemplateAiOutput,
} from "./meta-whatsapp-template-ai.schema";
import type { MetaTemplateAiOption, MetaTemplateAiPublicResult } from "./meta-whatsapp-template-ai.types";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { logMetaTemplate } from "./meta-whatsapp-template-log";
import { MetaWhatsappTemplateService } from "./meta-whatsapp-template.service";

type StructuredCaller = (request: Parameters<typeof callOpenAiStructured>[0]) => Promise<OpenAiStructuredResult>;

const windows = new Map<string, number[]>();
const FORBIDDEN_APPROVAL_PROMISE = /\b(será|vai ser|garantid[ao]|100%)\s+(aprovad[ao]|aceit[ao])/i;

function requireTenant(auth: WabaRequestAuth) {
  try {
    return resolveMetaWhatsappTenant(auth);
  } catch {
    throw new MetaWhatsappError("unauthenticated");
  }
}

function ensureRateLimit(key: string): void {
  const now = Date.now();
  const limit = Math.max(1, Math.min(30, Number(process.env.META_TEMPLATE_AI_RATE_LIMIT_PER_MINUTE || 5)));
  const recent = (windows.get(key) || []).filter((at) => now - at < 60_000);
  if (recent.length >= limit) throw new MetaWhatsappError("template_ai_rate_limited");
  recent.push(now);
  windows.set(key, recent);
}

function isEnabled(): boolean {
  const raw = String(process.env.META_TEMPLATE_AI_ENABLED || "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return Boolean(String(process.env.OPENAI_API_KEY || "").trim());
}

function componentsFromAiOption(option: MetaTemplateAiOption): Record<string, unknown>[] {
  const placeholders = [...new Set(
    [...option.body.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1])),
  )].sort((a, b) => a - b);
  const maxPlaceholder = placeholders.length ? Math.max(...placeholders) : 0;
  if (placeholders.some((value, index) => value !== index + 1)) {
    throw new Error("Variáveis não sequenciais.");
  }
  if (maxPlaceholder !== option.variableExamples.length) {
    throw new Error("Exemplos incompatíveis com variáveis.");
  }
  const buttonText = String(option.buttonText || "").trim();
  if (!buttonText) throw new Error("Botão operacional ausente.");
  return [
    {
      type: "BODY",
      text: option.body,
      ...(maxPlaceholder ? { example: { body_text: [option.variableExamples] } } : {}),
    },
    {
      type: "BUTTONS",
      buttons: [{ type: "QUICK_REPLY", text: buttonText }],
    },
  ];
}

export class MetaWhatsappTemplateAiService {
  constructor(
    private readonly connections = new MetaWhatsappConnectionRepository(),
    private readonly analyses = new MetaWhatsappTemplateAiRepository(),
    private readonly openAi: StructuredCaller = callOpenAiStructured,
    private readonly templates = new MetaWhatsappTemplateService(),
  ) {}

  private async requirePortfolio(
    tenantId: string,
    connectionId: string,
  ): Promise<MetaWhatsappConnectionRecord> {
    const id = String(connectionId || "").trim();
    if (!id) throw new MetaWhatsappError("invalid_payload");
    const row = await this.connections.findByIdForTenant(tenantId, id);
    if (
      !row ||
      row.tenantId !== tenantId ||
      (row.status !== "connected" && row.status !== "pending_confirmation") ||
      row.disconnectedAt ||
      !row.wabaId
    ) {
      throw new MetaWhatsappError("not_connected");
    }
    return row;
  }

  async generateFromAuth(
    auth: WabaRequestAuth,
    input: Record<string, unknown> | undefined,
  ): Promise<MetaTemplateAiPublicResult> {
    if (!isEnabled()) throw new MetaWhatsappError("template_ai_unavailable");
    const tenant = requireTenant(auth);
    const connectionId = String(input?.connectionId || input?.connection_id || "").trim();
    const baseText = String(input?.baseText || input?.base_text || "").trim();
    const language = String(input?.language || "pt_BR").trim() || "pt_BR";
    if (!baseText || baseText.length > 4_000 || language.length > 20) {
      throw new MetaWhatsappError("invalid_payload");
    }
    const connection = await this.requirePortfolio(tenant.tenantId, connectionId);
    ensureRateLimit(`${tenant.tenantId}:${auth.email}`);

    let ai: OpenAiStructuredResult;
    try {
      ai = await this.openAi({
        instructions: buildMetaTemplateAiInstructions(),
        input: JSON.stringify({
          requestedCategory: "UTILITY",
          language,
          baseText,
        }),
        schemaName: META_TEMPLATE_AI_SCHEMA_NAME,
        schema: META_TEMPLATE_AI_OUTPUT_SCHEMA,
        maxOutputTokens: 3_200,
        timeoutMs: Number(process.env.META_TEMPLATE_AI_TIMEOUT_MS || 20_000),
        maxAttempts: 3,
      });
    } catch {
      throw new MetaWhatsappError("template_ai_unavailable");
    }

    let result;
    try {
      result = validateMetaTemplateAiOutput(ai.value);
      const serialized = JSON.stringify(result);
      if (FORBIDDEN_APPROVAL_PROMISE.test(serialized)) {
        throw new Error("A IA prometeu aprovação.");
      }
      const names = new Set<string>();
      for (const option of result.options) {
        if (names.has(option.name)) throw new Error("Nomes duplicados.");
        names.add(option.name);
        validateTemplateCreate({
          name: option.name,
          language,
          category: "UTILITY",
          components: componentsFromAiOption(option),
        });
      }
    } catch {
      throw new MetaWhatsappError("template_ai_invalid_output");
    }

    const analyzedAt = new Date().toISOString();
    let analysisId = "";
    try {
      analysisId = await this.analyses.create({
        tenantId: tenant.tenantId,
        connectionId: connection.id,
        wabaId: String(connection.wabaId),
        createdBy: auth.email,
        baseText,
        language,
        result,
        model: ai.model,
        responseId: ai.responseId,
        promptVersion: META_TEMPLATE_AI_PROMPT_VERSION,
        policyVersion: META_TEMPLATE_AI_POLICY_VERSION,
      });
    } catch {
      throw new MetaWhatsappError("persist_failed");
    }
    logMetaTemplate("AI", {
      tenantId: tenant.tenantId,
      connectionId: connection.id,
      model: ai.model,
      latencyMs: ai.latencyMs,
      eligibleForUtility: result.eligibleForUtility,
      riskLevel: result.riskLevel,
    });

    return {
      ...result,
      analysisId,
      connectionId: connection.id,
      wabaId: String(connection.wabaId),
      language,
      model: ai.model,
      policyVersion: META_TEMPLATE_AI_POLICY_VERSION,
      analyzedAt,
    };
  }

  async submitAllFromAuth(
    auth: WabaRequestAuth,
    input: Record<string, unknown> | undefined,
  ): Promise<{
    total: number;
    submitted: number;
    failed: number;
    results: Array<{
      index: number;
      name: string;
      ok: boolean;
      status: string | null;
      templateId: string | null;
      error: string | null;
    }>;
  }> {
    const tenant = requireTenant(auth);
    const connectionId = String(input?.connectionId || input?.connection_id || "").trim();
    const analysisId = String(input?.analysisId || input?.analysis_id || "").trim();
    if (!connectionId || !analysisId) throw new MetaWhatsappError("invalid_payload");
    await this.requirePortfolio(tenant.tenantId, connectionId);
    const analysis = await this.analyses.findForSubmission(
      tenant.tenantId,
      connectionId,
      analysisId,
    );
    if (
      !analysis ||
      !analysis.eligibleForUtility ||
      analysis.result.recommendedCategory !== "UTILITY" ||
      !Array.isArray(analysis.result.options) ||
      analysis.result.options.length !== 3
    ) {
      throw new MetaWhatsappError("template_ai_invalid_output");
    }

    const results: Array<{
      index: number;
      name: string;
      ok: boolean;
      status: string | null;
      templateId: string | null;
      error: string | null;
    }> = [];
    const alreadySubmitted = await this.analyses.listSubmittedNames(
      tenant.tenantId,
      connectionId,
      analysisId,
    );
    for (let index = 0; index < analysis.result.options.length; index += 1) {
      const option = analysis.result.options[index];
      if (alreadySubmitted.has(option.name)) {
        results.push({
          index,
          name: option.name,
          ok: true,
          status: "ALREADY_SUBMITTED",
          templateId: null,
          error: null,
        });
        continue;
      }
      try {
        const template = await this.templates.createFromAuth(auth, {
          connectionId,
          aiAnalysisId: analysisId,
          name: option.name,
          language: analysis.language,
          category: "UTILITY",
          components: componentsFromAiOption(option),
        });
        results.push({
          index,
          name: option.name,
          ok: true,
          status: template.status,
          templateId: template.id,
          error: null,
        });
      } catch (error) {
        results.push({
          index,
          name: option.name,
          ok: false,
          status: null,
          templateId: null,
          error: error instanceof MetaWhatsappError
            ? error.message
            : "Não foi possível cadastrar esta opção.",
        });
      }
    }
    const submitted = results.filter((item) => item.ok).length;
    logMetaTemplate("AI", {
      tenantId: tenant.tenantId,
      connectionId,
      batchSubmit: true,
      submitted,
      failed: results.length - submitted,
    });
    return {
      total: results.length,
      submitted,
      failed: results.length - submitted,
      results,
    };
  }
}
