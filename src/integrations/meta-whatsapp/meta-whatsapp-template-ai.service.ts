import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import {
  callOpenAiStructured,
  type OpenAiStructuredResult,
} from "../openai/waba-openai-responses.client";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { MetaWhatsappError, wrapMetaHeaderUploadError } from "./meta-whatsapp-errors";
import { validateTemplateCreate } from "./meta-whatsapp-template-validate";
import {
  buildMetaTemplateAiInstructions,
  META_TEMPLATE_AI_POLICY_VERSION,
  META_TEMPLATE_AI_PROMPT_VERSION,
} from "./meta-whatsapp-template-ai.prompt";
import { MetaWhatsappTemplateAiRepository } from "./meta-whatsapp-template-ai.repository";
import { saveTemplateHeaderPreview } from "./meta-whatsapp-template-header-preview.store";
import { headerFileSha256, readCachedHeaderHandle, writeCachedHeaderHandle } from "./meta-whatsapp-header-handle-cache";
import {
  META_TEMPLATE_AI_OUTPUT_SCHEMA,
  META_TEMPLATE_AI_SCHEMA_NAME,
  validateMetaTemplateAiOutput,
} from "./meta-whatsapp-template-ai.schema";
import {
  componentsFromAiOptionAndShell,
  parseMetaTemplateAiShell,
  parseTemplateAiConnectionIds,
  parseTemplateAiWabaIds,
  parseTemplateAiWabaTargets,
  parseTemplateAiHeaderHandles,
  templateNameForOption,
} from "./meta-whatsapp-template-ai-shell";
import { shapeMetaUtilityAiOutput } from "./meta-whatsapp-template-ai-utility-shape";
import {
  assertEditedMetaTemplateAiOptionBody,
  parseMetaTemplateAiOptionBodyOverrides,
} from "./meta-whatsapp-template-ai-option-edit";
import type { MetaTemplateAiModelOutput, MetaTemplateAiOption, MetaTemplateAiPublicResult } from "./meta-whatsapp-template-ai.types";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { logMetaTemplate } from "./meta-whatsapp-template-log";
import { MetaWhatsappTemplateService } from "./meta-whatsapp-template.service";
import { decryptMetaToken } from "./meta-token-crypto";
import { readMetaAppId } from "./meta-config";
import { uploadMetaResumableImage } from "./meta-whatsapp-resumable-upload";
import {
  assertMetaReadyButtonShortUrl,
  createMetaTemplateButtonShortUrl,
  type MetaTemplateButtonShortUrlInput,
} from "./meta-whatsapp-template-ai-short-url";
import type { WabaPublicBaseRequestHints } from "../../lib/waba-public-base-url";

const MEDIA_MIME: Record<string, Set<string>> = {
  IMAGE: new Set(["image/jpeg", "image/png"]),
  VIDEO: new Set(["video/mp4"]),
  DOCUMENT: new Set(["application/pdf"]),
};

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
};

export function normalizeHeaderMediaMime(mime: string): string {
  return String(mime || "")
    .trim()
    .toLowerCase()
    .split(";")[0]
    .trim();
}

export function sniffMetaHeaderMediaMime(bytes: Buffer | undefined): string | null {
  if (!bytes || bytes.length < 8) return null;
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 && bytes.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  return null;
}

export function sanitizeGraphUploadFileName(fileName: string, mime: string): string {
  const type = normalizeHeaderMediaMime(mime);
  const ext =
    type === "image/png" ? "png" : type === "video/mp4" ? "mp4" : type === "application/pdf" ? "pdf" : "jpg";
  return `header.${ext}`;
}

export function resolveMetaHeaderMediaMime(
  mediaFormat: string,
  mime: string,
  fileName: string,
  bytes?: Buffer,
): string {
  const format = String(mediaFormat || "").trim().toUpperCase();
  const sniffed = sniffMetaHeaderMediaMime(bytes);
  if (sniffed && MEDIA_MIME[format]?.has(sniffed)) return sniffed;
  if (format === "VIDEO" && sniffed === "video/mp4") return sniffed;
  if (format === "DOCUMENT" && sniffed === "application/pdf") return sniffed;
  const raw = normalizeHeaderMediaMime(mime);
  const ext = String(fileName || "").toLowerCase().split(".").pop() || "";
  const fromAlias = MIME_ALIASES[raw] || raw;
  if (MEDIA_MIME[format]?.has(fromAlias)) return fromAlias;
  if (format === "IMAGE" && (ext === "png" || ext === "jpg" || ext === "jpeg")) {
    return ext === "png" ? "image/png" : "image/jpeg";
  }
  if (format === "VIDEO" && ext === "mp4") return "video/mp4";
  if (format === "DOCUMENT" && ext === "pdf") return "application/pdf";
  return fromAlias;
}

type HeaderUploader = (input: {
  token: string;
  appId: string;
  fileName: string;
  mime: string;
  bytes: Buffer;
  timeoutMs?: number;
}) => Promise<{ handle: string }>;

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

function safeHost(url: string): string {
  try {
    return new URL(url).hostname || "";
  } catch {
    return "";
  }
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
    private readonly decrypt = decryptMetaToken,
    private readonly uploadHeader = uploadMetaResumableImage as HeaderUploader,
    private readonly createButtonShortUrl: (
      input: MetaTemplateButtonShortUrlInput,
    ) => Promise<string> = createMetaTemplateButtonShortUrl,
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

  private async resolveSubmitPortfolios(
    tenantId: string,
    connectionIds: string[],
  ): Promise<MetaWhatsappConnectionRecord[]> {
    const requested = [...new Set(connectionIds.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!requested.length) throw new MetaWhatsappError("invalid_payload");
    const out: MetaWhatsappConnectionRecord[] = [];
    const seenWaba = new Set<string>();
    for (const id of requested) {
      const row = await this.requirePortfolio(tenantId, id);
      const wabaId = String(row.wabaId || "").trim();
      if (wabaId && seenWaba.has(wabaId)) continue;
      if (wabaId) seenWaba.add(wabaId);
      out.push(row);
    }
    if (!out.length) throw new MetaWhatsappError("not_connected");
    return out;
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
    const variableType = String(input?.variableType || input?.variable_type || "nome").trim().toLowerCase();
    if (!baseText || baseText.length > 4_000 || language.length > 20) {
      throw new MetaWhatsappError("invalid_payload");
    }
    if (variableType !== "nome" && variableType !== "numero" && variableType !== "nenhuma") {
      throw new MetaWhatsappError("invalid_payload");
    }
    const connection = await this.requirePortfolio(tenant.tenantId, connectionId);
    ensureRateLimit(`${tenant.tenantId}:${auth.email}`);

    const catalog = this.templates as {
      listApprovedUtilityExamples?: (id: string) => Promise<unknown>;
    };
    let approvedUtilityExamples: unknown[] = [];
    if (typeof catalog.listApprovedUtilityExamples === "function") {
      try {
        const listed = await catalog.listApprovedUtilityExamples(tenant.tenantId);
        approvedUtilityExamples = Array.isArray(listed) ? listed.slice(0, 8) : [];
      } catch {
        approvedUtilityExamples = [];
      }
    }

    let ai: OpenAiStructuredResult;
    try {
      ai = await this.openAi({
        instructions: buildMetaTemplateAiInstructions(),
        input: JSON.stringify({
          requestedCategory: "UTILITY",
          language,
          variableType,
          baseText,
          approvedUtilityExamples,
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
      result = shapeMetaUtilityAiOutput(validateMetaTemplateAiOutput(ai.value), variableType);
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
      approvedExampleCount: approvedUtilityExamples.length,
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

  private applyOptionBodyEdits(
    result: MetaTemplateAiModelOutput,
    edits: Array<{ index: number; body: string }>,
  ): MetaTemplateAiModelOutput {
    if (!edits.length) return result;
    const options = result.options.map((option) => ({ ...option }));
    for (const edit of edits) {
      if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index > 2 || !options[edit.index]) {
        throw new MetaWhatsappError("invalid_payload");
      }
      options[edit.index] = {
        ...options[edit.index],
        body: assertEditedMetaTemplateAiOptionBody(edit.body),
      };
    }
    return { ...result, options };
  }

  async saveEditedOptionFromAuth(
    auth: WabaRequestAuth,
    input: Record<string, unknown> | undefined,
  ): Promise<{ analysisId: string; index: number; option: MetaTemplateAiOption }> {
    const tenant = requireTenant(auth);
    const connectionId = String(input?.connectionId || input?.connection_id || "").trim();
    const analysisId = String(input?.analysisId || input?.analysis_id || "").trim();
    const index = Math.round(Number(input?.index ?? input?.optionIndex ?? input?.option_index));
    if (!connectionId || !analysisId || !Number.isInteger(index) || index < 0 || index > 2) {
      throw new MetaWhatsappError("invalid_payload");
    }
    await this.requirePortfolio(tenant.tenantId, connectionId);
    const analysis = await this.analyses.findForSubmission(tenant.tenantId, connectionId, analysisId);
    if (!analysis || !Array.isArray(analysis.result.options) || analysis.result.options.length !== 3) {
      throw new MetaWhatsappError("template_ai_invalid_output");
    }
    const result = this.applyOptionBodyEdits(analysis.result, [
      { index, body: String(input?.body ?? input?.text ?? "") },
    ]);
    try {
      await this.analyses.updateResult(tenant.tenantId, connectionId, analysisId, result);
    } catch {
      throw new MetaWhatsappError("persist_failed");
    }
    logMetaTemplate("AI", {
      tenantId: tenant.tenantId,
      connectionId,
      optionEdited: true,
      optionIndex: index,
    });
    return { analysisId, index, option: result.options[index] };
  }

  async submitAllFromAuth(
    auth: WabaRequestAuth,
    input: Record<string, unknown> | undefined,
    publicBaseHints?: WabaPublicBaseRequestHints,
  ): Promise<{
    total: number;
    submitted: number;
    failed: number;
    results: Array<{
      index: number;
      name: string;
      ok: boolean;
      alreadySubmitted: boolean;
      status: string | null;
      templateId: string | null;
      error: string | null;
      connectionId: string;
      portfolioName: string;
      wabaId: string;
    }>;
    portfolioName: string;
    wabaId: string;
    portfolios: Array<{
      connectionId: string;
      portfolioName: string;
      wabaId: string;
      submitted: number;
      failed: number;
    }>;
  }> {
    const tenant = requireTenant(auth);
    const connectionIds = parseTemplateAiConnectionIds(input);
    const requestedWabaIds = parseTemplateAiWabaIds(input);
    const requestedTargets = parseTemplateAiWabaTargets(input);
    const analysisId = String(input?.analysisId || input?.analysis_id || "").trim();
    const portfolioIds = [
      ...new Set([
        ...connectionIds,
        ...requestedTargets.map((item) => item.connectionId).filter(Boolean),
      ]),
    ];
    if (!portfolioIds.length || !analysisId) throw new MetaWhatsappError("invalid_payload");
    const portfolios = await this.resolveSubmitPortfolios(tenant.tenantId, portfolioIds);
    const byConnectionId = new Map(portfolios.map((row) => [row.id, row]));
    const portfolioLabel = (connection: (typeof portfolios)[number]) =>
      String(connection.verifiedName || connection.displayPhoneNumber || "").trim() || "Portfólio";
    const submitTargets = requestedTargets.length
      ? requestedTargets.flatMap((item) => {
          const connection =
            (item.connectionId && byConnectionId.get(item.connectionId)) ||
            portfolios.find((row) => String(row.wabaId || "") === item.wabaId) ||
            (portfolios.length === 1 ? portfolios[0] : null);
          if (!connection) return [];
          return [
            {
              connection,
              wabaId: item.wabaId,
              portfolioName: portfolioLabel(connection),
            },
          ];
        })
      : requestedWabaIds.length
        ? requestedWabaIds.map((wabaId) => ({
            connection:
              portfolios.find((row) => String(row.wabaId || "") === wabaId) || portfolios[0],
            wabaId,
            portfolioName: portfolioLabel(
              portfolios.find((row) => String(row.wabaId || "") === wabaId) || portfolios[0],
            ),
          }))
        : portfolios.map((connection) => ({
            connection,
            wabaId: String(connection.wabaId || ""),
            portfolioName: portfolioLabel(connection),
          }));
    if (!submitTargets.length) throw new MetaWhatsappError("invalid_payload");
    let analysis = await this.analyses.findForSubmission(tenant.tenantId, portfolios[0].id, analysisId);
    if (
      !analysis ||
      !analysis.eligibleForUtility ||
      analysis.result.recommendedCategory !== "UTILITY" ||
      !Array.isArray(analysis.result.options) ||
      analysis.result.options.length !== 3
    ) {
      throw new MetaWhatsappError("template_ai_invalid_output");
    }

    const optionEdits = parseMetaTemplateAiOptionBodyOverrides(input);
    let analysisResult = analysis.result;
    if (optionEdits.length) {
      analysisResult = this.applyOptionBodyEdits(analysis.result, optionEdits);
      try {
        await this.analyses.updateResult(tenant.tenantId, portfolios[0].id, analysisId, analysisResult);
      } catch {
        throw new MetaWhatsappError("persist_failed");
      }
    }

    const headerHandles = parseTemplateAiHeaderHandles(input);
    const fallbackHandle = String(input?.headerHandle || input?.header_handle || "").trim();
    const firstHandle = headerHandles[portfolios[0].id] || fallbackHandle;
    const shell = parseMetaTemplateAiShell({
      ...input,
      headerHandle: firstHandle,
    });

    const results: Array<{
      index: number;
      name: string;
      ok: boolean;
      alreadySubmitted: boolean;
      status: string | null;
      templateId: string | null;
      error: string | null;
      connectionId: string;
      portfolioName: string;
      wabaId: string;
    }> = [];

    const anyPending: number[] = [];
    const localFinder = this.templates as {
      findByWabaNameLanguage?: (
        tenantId: string,
        wabaId: string,
        name: string,
        language: string,
      ) => Promise<{ id: string; status: string | null; wabaId?: string | null } | null>;
      findByNameForConnection?: (
        tenantId: string,
        connectionId: string,
        name: string,
        language: string,
      ) => Promise<{ id: string; status: string | null; wabaId?: string | null } | null>;
    };
    const findLocal = async (wabaId: string, connectionId: string, name: string) => {
      if (typeof localFinder.findByWabaNameLanguage === "function" && wabaId) {
        const byWaba = await localFinder.findByWabaNameLanguage(
          tenant.tenantId,
          wabaId,
          name,
          analysis.language,
        );
        if (byWaba) return byWaba;
      }
      if (typeof localFinder.findByNameForConnection === "function") {
        return localFinder.findByNameForConnection(
          tenant.tenantId,
          connectionId,
          name,
          analysis.language,
        );
      }
      return null;
    };
    const alreadyOnThisWaba = (
      local: { wabaId?: string | null } | null,
      wabaId: string,
    ) => Boolean(local && (!wabaId || String(local.wabaId || "") === wabaId || !local.wabaId));
    for (const target of submitTargets) {
      for (let index = 0; index < analysisResult.options.length; index += 1) {
        const name = templateNameForOption(shell.modelName, index);
        const local = await findLocal(target.wabaId, target.connection.id, name);
        if (!alreadyOnThisWaba(local, target.wabaId)) anyPending.push(index);
      }
    }
    let metaButtonUrl: string | null = null;
    const ensureMetaButtonUrl = async () => {
      if (metaButtonUrl) return metaButtonUrl;
      metaButtonUrl = assertMetaReadyButtonShortUrl(
        await this.createButtonShortUrl({
          destinationUrl: shell.buttonUrl,
          tenantId: tenant.tenantId,
          publicBaseHints,
        }),
      );
      logMetaTemplate("AI", {
        tenantId: tenant.tenantId,
        connectionId: portfolios[0].id,
        buttonShortened: true,
        destinationHost: safeHost(shell.buttonUrl),
        shortHost: safeHost(metaButtonUrl),
      });
      return metaButtonUrl;
    };
    if (anyPending.length) await ensureMetaButtonUrl();

    for (const target of submitTargets) {
      const { connection, wabaId, portfolioName } = target;
      const handle = headerHandles[connection.id] || firstHandle;
      for (let index = 0; index < analysisResult.options.length; index += 1) {
        const option = analysisResult.options[index];
        const name = templateNameForOption(shell.modelName, index);
        const local = await findLocal(wabaId, connection.id, name);
        if (alreadyOnThisWaba(local, wabaId) && local) {
          results.push({
            index,
            name,
            ok: true,
            alreadySubmitted: true,
            status: local.status || "ALREADY_SUBMITTED",
            templateId: local.id,
            error: null,
            connectionId: connection.id,
            portfolioName,
            wabaId,
          });
          continue;
        }
        try {
          const buttonUrl = await ensureMetaButtonUrl();
          const template = await this.templates.createFromAuth(auth, {
            connectionId: connection.id,
            wabaId,
            aiAnalysisId: analysisId,
            aiOptionIndex: index,
            name,
            language: analysis.language,
            category: "UTILITY",
            components: componentsFromAiOptionAndShell(option, {
              ...shell,
              buttonUrl,
              headerHandle: handle || shell.headerHandle,
            }),
          });
          results.push({
            index,
            name,
            ok: true,
            alreadySubmitted: false,
            status: template.status,
            templateId: template.id,
            error: null,
            connectionId: connection.id,
            portfolioName,
            wabaId,
          });
        } catch (error) {
          results.push({
            index,
            name,
            ok: false,
            alreadySubmitted: false,
            status: null,
            templateId: null,
            error: error instanceof MetaWhatsappError
              ? error.message
              : "Não foi possível cadastrar esta opção.",
            connectionId: connection.id,
            portfolioName,
            wabaId,
          });
        }
      }
    }

    results.sort((a, b) => {
      const byPortfolio = a.connectionId.localeCompare(b.connectionId);
      if (byPortfolio) return byPortfolio;
      const byWaba = String(a.wabaId || "").localeCompare(String(b.wabaId || ""));
      if (byWaba) return byWaba;
      return a.index - b.index;
    });
    const submitted = results.filter((item) => item.ok && !item.alreadySubmitted).length;
    const failed = results.filter((item) => !item.ok).length;
    const portfolioSummaries = submitTargets.map((target) => {
      const rows = results.filter(
        (item) => item.connectionId === target.connection.id && item.wabaId === target.wabaId,
      );
      return {
        connectionId: target.connection.id,
        portfolioName: target.portfolioName,
        wabaId: target.wabaId,
        submitted: rows.filter((item) => item.ok && !item.alreadySubmitted).length,
        failed: rows.filter((item) => !item.ok).length,
      };
    });
    logMetaTemplate("AI", {
      tenantId: tenant.tenantId,
      connectionId: portfolios[0].id,
      batchSubmit: true,
      submitted,
      failed,
      portfolios: submitTargets.length,
      skippedLive: results.filter((item) => item.alreadySubmitted).length,
    });
    return {
      total: results.length,
      submitted,
      failed,
      results,
      portfolioName: portfolioSummaries.map((row) => row.portfolioName).join(" · "),
      wabaId: portfolioSummaries.map((row) => row.wabaId).filter(Boolean).join(" · "),
      portfolios: portfolioSummaries,
    };
  }

  async uploadHeaderMediaFromAuth(
    auth: WabaRequestAuth,
    input: {
      connectionId?: string;
      mediaFormat?: string;
      fileName?: string;
      mime?: string;
      bytes?: Buffer;
    },
  ): Promise<{ handle: string; mediaFormat: string }> {
    const tenant = requireTenant(auth);
    const connectionId = String(input.connectionId || "").trim();
    const mediaFormat = String(input.mediaFormat || "").trim().toUpperCase();
    const allowed = MEDIA_MIME[mediaFormat];
    const bytes = input.bytes;
    const originalName = String(input.fileName || "header").trim() || "header";
    const mime = resolveMetaHeaderMediaMime(mediaFormat, input.mime || "", originalName, bytes);
    const fileName = sanitizeGraphUploadFileName(originalName, mime);
    if (!connectionId) throw new MetaWhatsappError("invalid_payload");
    if (!allowed || !bytes?.length || !allowed.has(mime)) {
      const failed = new MetaWhatsappError("template_upload_failed");
      if (mediaFormat === "VIDEO") {
        failed.message =
          "A Meta só aceita vídeo MP4 (H.264, AAC ou sem áudio) no cabeçalho. Confira o arquivo e tente de novo.";
      }
      throw failed;
    }
    if (mediaFormat === "VIDEO" && bytes.length > 16 * 1024 * 1024) {
      const failed = new MetaWhatsappError("template_upload_failed");
      failed.message =
        "A Meta recusou o arquivo por tamanho. Vídeo de cabeçalho até 16 MB. Comprima o MP4 e envie de novo.";
      throw failed;
    }
    const preferred = await this.requirePortfolio(tenant.tenantId, connectionId);
    const appId = readMetaAppId();
    if (!appId) throw new MetaWhatsappError("config_invalid");
    const fileSha = headerFileSha256(bytes);
    const cachedHandle = readCachedHeaderHandle(tenant.tenantId, fileSha);
    if (cachedHandle) {
      saveTemplateHeaderPreview({
        tenantId: tenant.tenantId,
        handle: cachedHandle,
        mime,
        fileName,
        bytes,
      });
      logMetaTemplate("AI", {
        tenantId: tenant.tenantId,
        connectionId,
        headerUpload: mediaFormat,
        headerCache: true,
        bytes: bytes.length,
        mime,
      });
      return { handle: cachedHandle, mediaFormat };
    }

    const repo = this.connections as MetaWhatsappConnectionRepository;
    const openRows =
      typeof repo.listOpenByTenant === "function" ? await repo.listOpenByTenant(tenant.tenantId) : [];
    const candidates: MetaWhatsappConnectionRecord[] = [preferred];
    for (const row of openRows) {
      if (row.id === preferred.id) continue;
      if (row.disconnectedAt) continue;
      if (row.status !== "connected" && row.status !== "pending_confirmation") continue;
      if (!String(row.wabaId || "").trim()) continue;
      candidates.push(row);
    }

    let lastError: unknown = null;
    for (const candidate of candidates) {
      let token = "";
      try {
        token = this.decrypt(candidate.accessTokenEncrypted);
      } catch {
        continue;
      }
      if (!token) continue;
      try {
        const uploaded = await this.uploadHeader({
          token,
          appId,
          fileName,
          mime,
          bytes,
          timeoutMs: mediaFormat === "VIDEO" ? 300_000 : undefined,
        });
        const handle = String(uploaded.handle || "").trim();
        if (!handle) throw new MetaWhatsappError("template_upload_failed");
        writeCachedHeaderHandle(tenant.tenantId, fileSha, handle);
        saveTemplateHeaderPreview({
          tenantId: tenant.tenantId,
          handle,
          mime,
          fileName,
          bytes,
        });
        logMetaTemplate("AI", {
          tenantId: tenant.tenantId,
          connectionId: candidate.id,
          headerUpload: mediaFormat,
          headerFallback: candidate.id !== preferred.id,
          bytes: bytes.length,
          mime,
        });
        return { handle, mediaFormat };
      } catch (error) {
        if (error instanceof MetaWhatsappError && error.code !== "template_upload_failed") throw error;
        lastError = error;
        const msg = String((error as { message?: string })?.message || "").replace(/\s+/g, " ").trim();
        logMetaTemplate("AI", {
          tenantId: tenant.tenantId,
          connectionId: candidate.id,
          headerUploadFailed: mediaFormat,
          mime,
          bytes: bytes.length,
          reason: msg.slice(0, 160),
        });
      }
    }
    if (lastError instanceof MetaWhatsappError) throw lastError;
    throw wrapMetaHeaderUploadError(lastError || new MetaWhatsappError("template_upload_failed"));
  }
}
