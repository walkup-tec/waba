import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MetaTemplateAiModelOutput } from "./meta-whatsapp-template-ai.types";

const TABLE = "meta_whatsapp_template_ai_analyses";
const SUBMISSIONS_TABLE = "meta_whatsapp_template_ai_submissions";

function getClient(): SupabaseClient {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export class MetaWhatsappTemplateAiRepository {
  constructor(private readonly clientFactory: () => SupabaseClient = getClient) {}

  private client(): SupabaseClient {
    return this.clientFactory();
  }

  async create(input: {
    tenantId: string;
    connectionId: string;
    wabaId: string;
    createdBy: string;
    baseText: string;
    language: string;
    result: MetaTemplateAiModelOutput;
    model: string;
    responseId: string | null;
    promptVersion: string;
    policyVersion: string;
  }): Promise<string> {
    const { data, error } = await this.client()
      .from(TABLE)
      .insert({
        tenant_id: input.tenantId,
        connection_id: input.connectionId,
        waba_id: input.wabaId,
        created_by: input.createdBy,
        base_text: input.baseText,
        language: input.language,
        requested_category: "UTILITY",
        recommended_category: input.result.recommendedCategory,
        utility_compatibility: input.result.utilityCompatibility,
        risk_level: input.result.riskLevel,
        eligible_for_utility: input.result.eligibleForUtility,
        reason: input.result.reason,
        result_json: input.result,
        model: input.model,
        openai_response_id: input.responseId,
        prompt_version: input.promptVersion,
        policy_version: input.policyVersion,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return String((data as { id?: unknown } | null)?.id || "");
  }

  async updateResult(
    tenantId: string,
    connectionId: string,
    analysisId: string,
    result: MetaTemplateAiModelOutput,
  ): Promise<void> {
    const { data, error } = await this.client()
      .from(TABLE)
      .update({ result_json: result })
      .eq("id", analysisId)
      .eq("tenant_id", tenantId)
      .eq("connection_id", connectionId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Análise não encontrada para este portfólio.");
  }

  async findForSubmission(
    tenantId: string,
    connectionId: string,
    analysisId: string,
  ): Promise<{
    id: string;
    language: string;
    eligibleForUtility: boolean;
    result: MetaTemplateAiModelOutput;
  } | null> {
    const { data, error } = await this.client()
      .from(TABLE)
      .select("id, language, eligible_for_utility, result_json")
      .eq("id", analysisId)
      .eq("tenant_id", tenantId)
      .eq("connection_id", connectionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: String((data as any).id),
      language: String((data as any).language || "pt_BR"),
      eligibleForUtility: (data as any).eligible_for_utility === true,
      result: (data as any).result_json as MetaTemplateAiModelOutput,
    };
  }

  async linkSubmission(input: {
    tenantId: string;
    connectionId: string;
    analysisId: string;
    templateId: string;
    metaTemplateId: string | null;
    optionIndex?: number;
    submittedTemplate: unknown;
    submittedCategory: string;
    metaStatus: string | null;
    metaCategory: string | null;
  }): Promise<void> {
    const { data: analysis, error: analysisError } = await this.client()
      .from(TABLE)
      .select("id, result_json")
      .eq("id", input.analysisId)
      .eq("tenant_id", input.tenantId)
      .eq("connection_id", input.connectionId)
      .maybeSingle();
    if (analysisError) throw new Error(analysisError.message);
    if (!analysis) throw new Error("Análise não encontrada para este portfólio.");
    const submittedName = String(
      (input.submittedTemplate as { name?: unknown } | null)?.name || "",
    );
    const options = Array.isArray((analysis as any).result_json?.options)
      ? ((analysis as any).result_json.options as Array<{ name?: unknown }>)
      : [];
    const optionIndex = Number.isInteger(input.optionIndex)
      ? Number(input.optionIndex)
      : options.findIndex((item) => String(item?.name || "") === submittedName);
    const { error } = await this.client()
      .from(SUBMISSIONS_TABLE)
      .upsert(
        {
          tenant_id: input.tenantId,
          analysis_id: input.analysisId,
          connection_id: input.connectionId,
          template_id: input.templateId,
          meta_template_id: input.metaTemplateId,
          option_index: optionIndex >= 0 ? optionIndex : null,
          submitted_template_json: input.submittedTemplate,
          submitted_category: input.submittedCategory,
          submitted_at: new Date().toISOString(),
          meta_status: input.metaStatus,
          meta_category: input.metaCategory,
          meta_outcome_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,analysis_id,template_id" },
      );
    if (error) throw new Error(error.message);
  }

  async listSubmittedNames(
    tenantId: string,
    connectionId: string,
    analysisId: string,
  ): Promise<Set<string>> {
    const { data, error } = await this.client()
      .from(SUBMISSIONS_TABLE)
      .select("submitted_template_json")
      .eq("tenant_id", tenantId)
      .eq("connection_id", connectionId)
      .eq("analysis_id", analysisId);
    if (error) throw new Error(error.message);
    return new Set(
      (data || [])
        .map((row: any) => String(row?.submitted_template_json?.name || "").trim())
        .filter(Boolean),
    );
  }

  async patchMetaOutcome(input: {
    tenantId: string;
    templateId: string;
    metaTemplateId: string | null;
    metaStatus: string | null;
    metaCategory: string | null;
    rejectedReason: string | null;
  }): Promise<void> {
    let query = this.client()
      .from(SUBMISSIONS_TABLE)
      .update({
        meta_status: input.metaStatus,
        meta_category: input.metaCategory,
        meta_rejected_reason: input.rejectedReason,
        meta_outcome_at: new Date().toISOString(),
      })
      .eq("tenant_id", input.tenantId);
    query = input.metaTemplateId
      ? query.eq("meta_template_id", input.metaTemplateId)
      : query.eq("template_id", input.templateId);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }
}
