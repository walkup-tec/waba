"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappTemplateAiRepository = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const TABLE = "meta_whatsapp_template_ai_analyses";
const SUBMISSIONS_TABLE = "meta_whatsapp_template_ai_submissions";
function getClient() {
    const url = String(process.env.SUPABASE_URL || "").trim();
    const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!url || !key) {
        throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    }
    return (0, supabase_js_1.createClient)(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
class MetaWhatsappTemplateAiRepository {
    constructor(clientFactory = getClient) {
        this.clientFactory = clientFactory;
    }
    client() {
        return this.clientFactory();
    }
    async create(input) {
        const { data, error } = await this.client()
            .from(TABLE)
            .insert({
            tenant_id: input.tenantId,
            connection_id: input.connectionId,
            waba_id: input.wabaId,
            created_by: input.createdBy,
            base_text: input.baseText,
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
        if (error)
            throw new Error(error.message);
        return String(data?.id || "");
    }
    async linkSubmission(input) {
        const { data: analysis, error: analysisError } = await this.client()
            .from(TABLE)
            .select("id, result_json")
            .eq("id", input.analysisId)
            .eq("tenant_id", input.tenantId)
            .eq("connection_id", input.connectionId)
            .maybeSingle();
        if (analysisError)
            throw new Error(analysisError.message);
        if (!analysis)
            throw new Error("Análise não encontrada para este portfólio.");
        const submittedName = String(input.submittedTemplate?.name || "");
        const options = Array.isArray(analysis.result_json?.options)
            ? analysis.result_json.options
            : [];
        const optionIndex = options.findIndex((item) => String(item?.name || "") === submittedName);
        const { error } = await this.client()
            .from(SUBMISSIONS_TABLE)
            .upsert({
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
        }, { onConflict: "tenant_id,analysis_id,template_id" });
        if (error)
            throw new Error(error.message);
    }
    async patchMetaOutcome(input) {
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
        if (error)
            throw new Error(error.message);
    }
}
exports.MetaWhatsappTemplateAiRepository = MetaWhatsappTemplateAiRepository;
