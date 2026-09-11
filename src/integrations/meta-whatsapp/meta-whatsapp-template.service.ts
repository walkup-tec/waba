import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { decryptMetaToken } from "./meta-token-crypto";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import {
  isMetaGraphRateLimitPayload,
  isMetaGraphWabaWriteDenied,
  publicMetaGraphTemplateMessage,
  safePublicGraphTemplateDetail,
} from "./meta-whatsapp-graph-errors";
import { logMetaTemplate } from "./meta-whatsapp-template-log";
import { rememberTemplateApprovedAt } from "./meta-whatsapp-template-approved-at.store";
import { MetaWhatsappTemplateRepository } from "./meta-whatsapp-template.repository";
import { callMetaGraphJson } from "./meta-whatsapp-graph.client";
import {
  createWabaMessageTemplate,
  deleteWabaMessageTemplate,
  listWabaMessageTemplates,
  type TemplateGraphCaller,
} from "./meta-whatsapp-template-graph.client";
import {
  extraWabaIdsFromConnections,
  listDebugTokenManagedWabaIds,
  listSyncTargetWabaIds,
  listTemplatePickerWabas,
  pickTemplateWriteConnections,
  templatePickerWabaIds,
} from "./meta-whatsapp-template-waba-ids";
import { appendSilentBlockButton } from "./meta-whatsapp-template-silent-block-button";
import { validateTemplateCreate } from "./meta-whatsapp-template-validate";
import {
  pickApprovedUtilityExamples,
  type MetaUtilityApprovedExample,
} from "./meta-whatsapp-template-ai-approved-examples";
import {
  isTemplateApprovedForSend,
  toPublicTemplate,
  type MetaTemplatePublic,
  type MetaTemplateRecord,
} from "./meta-whatsapp-template.types";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { MetaWhatsappTemplateAiRepository } from "./meta-whatsapp-template-ai.repository";
import {
  bindTemplateHeaderPreview,
  headerHandleFromComponents,
  readTemplateHeaderPreviewForSend,
  saveTemplateHeaderPreviewAliases,
  templateHeaderPreviewKeys,
} from "./meta-whatsapp-template-header-preview.store";
import { inspectMetaBroadcastTemplate } from "./meta-whatsapp-broadcast-template";
import {
  isKnownClientWabaId,
  knownClientWabaIdsForBusiness,
  knownOwnedWabaIdsForBusiness,
  knownWabaNameForId,
} from "./meta-whatsapp-known-owned-wabas";
import { pickReusableHeaderHandle } from "./meta-whatsapp-header-handle-cache";
import {
  isMetaGraphUploadCooldown,
  metaGraphUploadCooldownMessage,
} from "./meta-whatsapp-graph-cooldown";

/** Traefik/EasyPanel devolve 502 HTML se o POST de sync passar de ~30s. Devolver JSON antes. */
const META_TEMPLATE_SYNC_BUDGET_MS = 12_000;
const META_TEMPLATE_SYNC_LIST_TIMEOUT_MS = 3_500;
const META_TEMPLATE_SYNC_MAX_PAGES = 8;
/** Último recurso: WABAs do debug_token que o catálogo/card não listou. */
const META_TEMPLATE_SYNC_DEBUG_WABA_CAP = 3;

async function resolveSyncFallbackWabaIds(input: {
  token: string;
  businessId: string;
  alreadyTried: Iterable<string>;
  graph?: TemplateGraphCaller;
  timeoutMs?: number;
}): Promise<string[]> {
  const tried = new Set(
    [...input.alreadyTried].map((id) => String(id || "").trim()).filter(Boolean),
  );
  const debugIds = await listDebugTokenManagedWabaIds({
    token: input.token,
    graph: input.graph,
    timeoutMs: input.timeoutMs,
  });
  const unused = debugIds.filter(
    (id) => id && !tried.has(id) && !isKnownClientWabaId(id) && !knownClientWabaIdsForBusiness(input.businessId).includes(id),
  );
  if (!unused.length) return [];
  const preferred = knownOwnedWabaIdsForBusiness(input.businessId).filter((id) => unused.includes(id));
  const rest = unused.filter((id) => !preferred.includes(id));
  return [...preferred, ...rest].slice(0, META_TEMPLATE_SYNC_DEBUG_WABA_CAP);
}

function requireTenant(auth: WabaRequestAuth) {
  try {
    return resolveMetaWhatsappTenant(auth);
  } catch {
    throw new MetaWhatsappError("unauthenticated");
  }
}

function mimeForApprovedHeaderAttach(
  format: "IMAGE" | "VIDEO" | "DOCUMENT",
  mime: string,
  fileName: string,
  bytes: Buffer,
): string {
  const type = String(mime || "").trim().toLowerCase().split(";")[0];
  const name = String(fileName || "").trim().toLowerCase();
  if (format === "IMAGE") {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
    if (type === "image/png" || name.endsWith(".png")) return "image/png";
    if (type === "image/jpeg" || type === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    return "";
  }
  if (format === "VIDEO") {
    if (type === "video/mp4" || name.endsWith(".mp4")) return "video/mp4";
    return "";
  }
  if (type === "application/pdf" || name.endsWith(".pdf") || bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return "";
}

function isGraphTemplateGone(result: { status: number; json?: unknown }): boolean {
  if (result.status === 404) return true;
  const err = (result.json as { error?: { message?: string; error_user_msg?: string } } | null)?.error;
  const text = `${err?.message || ""} ${err?.error_user_msg || ""}`;
  return /does not exist|not found|não exist/i.test(text);
}

function throwFromGraph(result: {
  status: number;
  kind: "permanent" | "transient";
  timeout?: boolean;
  graphCode?: string | null;
  json?: unknown;
}): never {
  const detail = safePublicGraphTemplateDetail(result.json);
  logMetaTemplate("ERROR", {
    status: result.status,
    kind: result.kind,
    timeout: result.timeout === true,
    graphCode: result.graphCode || null,
    graphDetail: detail || null,
  });
  if (result.status === 401) throw new MetaWhatsappError("invalid_token");
  if (isMetaGraphRateLimitPayload(result.json, result.graphCode)) {
    const error = new MetaWhatsappError("graph_rate_limited");
    error.message = publicMetaGraphTemplateMessage(result.kind, result.status, result.json);
    throw error;
  }
  if (result.status === 400) {
    const error = new MetaWhatsappError("template_invalid");
    error.message = publicMetaGraphTemplateMessage(result.kind, result.status, result.json);
    throw error;
  }
  const status = result.timeout || result.status === 429 || result.status >= 500 || result.status === 0 ? 503 : 424;
  const error = new MetaWhatsappError("send_failed", status);
  error.message = publicMetaGraphTemplateMessage(result.kind, result.status, result.json);
  throw error;
}

function warnIgnored(body: Record<string, unknown> | undefined, tenantId: string): void {
  if (
    body?.tenant_id ||
    body?.tenantId ||
    body?.owner_email ||
    body?.waba_id ||
    body?.wabaId ||
    body?.access_token
  ) {
    logMetaTemplate("ERROR", { reason: "ignored_client_claims", tenantId });
  }
}

function publicPortfolioName(connection: MetaWhatsappConnectionRecord): string {
  return String(connection.verifiedName || connection.displayPhoneNumber || "").trim() || "Portfólio";
}

function rememberApprovedTemplate(row: MetaTemplateRecord): void {
  rememberTemplateApprovedAt(
    {
      tenantId: row.tenantId,
      templateId: row.id,
      metaTemplateId: row.metaTemplateId,
      wabaId: row.wabaId,
      name: row.name,
      language: row.language,
      status: row.status,
    },
    row.lastSyncedAt || row.updatedAt,
  );
}

export class MetaWhatsappTemplateService {
  constructor(
    private readonly connections = new MetaWhatsappConnectionRepository(),
    private readonly templates = new MetaWhatsappTemplateRepository(),
    private readonly graph: TemplateGraphCaller | undefined = undefined,
    private readonly decrypt = decryptMetaToken,
    private readonly analyses = new MetaWhatsappTemplateAiRepository(),
  ) {}

  async requireConnectedWaba(
    tenantId: string,
    connectionId?: string,
  ): Promise<MetaWhatsappConnectionRecord> {
    const requested = String(connectionId || "").trim();
    const row = requested
      ? await this.connections.findByIdForTenant(tenantId, requested)
      : await this.connections.findConnectedByTenant(tenantId);
    if (
      !row ||
      (row.status !== "connected" && row.status !== "pending_confirmation") ||
      !row.wabaId
    ) {
      throw new MetaWhatsappError("not_connected");
    }
    if (row.tenantId !== tenantId) throw new MetaWhatsappError("not_connected");
    return row;
  }

  async findByNameForConnection(
    tenantId: string,
    connectionId: string,
    name: string,
    language: string,
  ): Promise<MetaTemplateRecord | null> {
    const row = await this.templates.findForSend(tenantId, connectionId, name, language);
    if (!row || row.tenantId !== tenantId) return null;
    return row;
  }

  async findByWabaNameLanguage(
    tenantId: string,
    wabaId: string,
    name: string,
    language: string,
  ): Promise<MetaTemplateRecord | null> {
    const row = await this.templates.findByWabaNameLanguage(tenantId, wabaId, name, language);
    if (!row || row.tenantId !== tenantId) return null;
    return row;
  }

  async listWabasFromAuth(
    auth: WabaRequestAuth,
    connectionId?: string,
  ): Promise<{ connectionId: string; wabas: Array<{ id: string; name: string }> }> {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnectedWaba(tenant.tenantId, connectionId);
    let token = "";
    try {
      token = this.decrypt(connection.accessTokenEncrypted);
    } catch {
      throw new MetaWhatsappError("invalid_token");
    }
    const graph = this.graph || callMetaGraphJson;
    const wabas = isMetaGraphUploadCooldown()
      ? templatePickerWabaIds(connection).map((id) => ({
          id,
          name: knownWabaNameForId(id) || `WABA ${id}`,
        }))
      : await listTemplatePickerWabas({ token, connection, graph });
    if (!wabas.length && connection.wabaId) {
      wabas.push({
        id: String(connection.wabaId),
        name: publicPortfolioName(connection),
      });
    }
    return { connectionId: connection.id, wabas };
  }

  private async resolveCreateWabaId(
    connection: MetaWhatsappConnectionRecord,
    _token: string,
    requestedRaw: string,
  ): Promise<string> {
    const primary = String(connection.wabaId || "").trim();
    const requested = String(requestedRaw || "").trim();
    if (!requested || requested === primary) return primary;
    if (templatePickerWabaIds(connection).includes(requested)) return requested;
    return primary;
  }

  private async listOpenConnections(tenantId: string): Promise<MetaWhatsappConnectionRecord[]> {
    const repo = this.connections as {
      listOpenByTenant?: (id: string) => Promise<MetaWhatsappConnectionRecord[]>;
    };
    if (typeof repo.listOpenByTenant === "function") {
      return repo.listOpenByTenant(tenantId);
    }
    const one = await this.connections.findConnectedByTenant(tenantId);
    return one ? [one] : [];
  }

  async findReusableHeaderHandleForBytes(
    tenantId: string,
    bytes: Buffer,
  ): Promise<{ resumable: string; any: string }> {
    const id = String(tenantId || "").trim();
    if (!id || !bytes?.length || typeof this.templates.listByTenant !== "function") {
      return { resumable: "", any: "" };
    }
    try {
      const rows = await this.templates.listByTenant(id);
      return pickReusableHeaderHandle({ tenantId: id, bytes, rows });
    } catch {
      return { resumable: "", any: "" };
    }
  }

  async listApprovedUtilityExamples(tenantId: string): Promise<MetaUtilityApprovedExample[]> {
    const id = String(tenantId || "").trim();
    if (!id || typeof this.templates.listByTenant !== "function") return [];
    const rows = await this.templates.listByTenant(id);
    return pickApprovedUtilityExamples(rows);
  }

  async listFromAuth(auth: WabaRequestAuth, connectionId?: string): Promise<MetaTemplatePublic[]> {
    const tenant = requireTenant(auth);
    const requested = String(connectionId || "").trim();
    if (requested) {
      const connection = await this.requireConnectedWaba(tenant.tenantId, requested);
      const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
      logMetaTemplate("LIST", { tenantId: tenant.tenantId, count: rows.length });
      return rows.map((row) => toPublicTemplate(row, publicPortfolioName(connection)));
    }
    const rows = await this.templates.listByTenant(tenant.tenantId);
    const openRows = await this.listOpenConnections(tenant.tenantId);
    const byId = new Map(openRows.map((row) => [row.id, row]));
    logMetaTemplate("LIST", { tenantId: tenant.tenantId, count: rows.length });
    return rows.map((row) => {
      const connection = byId.get(row.connectionId);
      return toPublicTemplate(row, connection ? publicPortfolioName(connection) : "Portfólio");
    });
  }

  async createFromAuth(
    auth: WabaRequestAuth,
    body: Record<string, unknown> | undefined,
  ): Promise<MetaTemplatePublic> {
    const tenant = requireTenant(auth);
    warnIgnored(body, tenant.tenantId);
    const connection = await this.requireConnectedWaba(
      tenant.tenantId,
      String(body?.connectionId || body?.connection_id || ""),
    );
    const validated = validateTemplateCreate(body);
    const components = appendSilentBlockButton(validated.components);
    let token = "";
    try {
      token = this.decrypt(connection.accessTokenEncrypted);
    } catch {
      throw new MetaWhatsappError("invalid_token");
    }
    const graphBody = {
      name: validated.name,
      language: validated.language,
      category: validated.category,
      allow_category_change: true,
      components,
    };
    const wabaId = await this.resolveCreateWabaId(
      connection,
      token,
      String(body?.wabaId || body?.waba_id || ""),
    );
    const writers = pickTemplateWriteConnections(
      await this.listOpenConnections(tenant.tenantId),
      connection,
      wabaId,
    );
    let result: Awaited<ReturnType<typeof createWabaMessageTemplate>> | null = null;
    for (const writer of writers) {
      try {
        token = this.decrypt(writer.accessTokenEncrypted);
      } catch {
        continue;
      }
      if (!token) continue;
      result = await createWabaMessageTemplate({
        token,
        wabaId,
        body: graphBody,
        graph: this.graph,
      });
      if (result.ok) break;
      if (!isMetaGraphWabaWriteDenied(result.json, result.status)) break;
    }
    if (!result || !result.ok) {
      if (result && isMetaGraphWabaWriteDenied(result.json, result.status)) {
        const wabaLabel = knownWabaNameForId(wabaId) || wabaId;
        const error = new MetaWhatsappError("template_invalid");
        error.message =
          `A Meta recusou o cadastro na ${wabaLabel}. O token desta conexão não gerencia essa WABA. ` +
          "Clique em + no portfólio, conecte essa conta e envie de novo só nela. " +
          "Os templates já aceitos nas outras WABAs não precisam ser reenviados.";
        throw error;
      }
      throwFromGraph(result || { status: 424, kind: "permanent", json: null, graphCode: null });
    }
    const now = new Date().toISOString();
    const row = await this.templates.upsertFromGraph({
      tenantId: tenant.tenantId,
      connectionId: connection.id,
      wabaId,
      metaTemplateId: result.json?.id ? String(result.json.id) : null,
      name: validated.name,
      language: validated.language,
      category: result.json?.category ? String(result.json.category) : validated.category,
      status: result.json?.status ? String(result.json.status) : "PENDING",
      components,
      lastSyncedAt: now,
      createdAt: now,
    });
    bindTemplateHeaderPreview({
      tenantId: tenant.tenantId,
      handle: headerHandleFromComponents(components),
      templateId: row.id,
      metaTemplateId: row.metaTemplateId,
      name: row.name,
      language: row.language,
    });
    logMetaTemplate("CREATE", {
      tenantId: tenant.tenantId,
      name: validated.name,
      language: validated.language,
      status: row.status,
    });
    rememberApprovedTemplate(row);
    const analysisId = String(body?.aiAnalysisId || body?.ai_analysis_id || "").trim();
    if (analysisId) {
      try {
        const optionIndexRaw = Number(body?.aiOptionIndex ?? body?.ai_option_index);
        await this.analyses.linkSubmission({
          tenantId: tenant.tenantId,
          connectionId: connection.id,
          analysisId,
          templateId: row.id,
          metaTemplateId: row.metaTemplateId,
          optionIndex: Number.isInteger(optionIndexRaw) ? optionIndexRaw : undefined,
          submittedTemplate: {
            name: validated.name,
            language: validated.language,
            category: validated.category,
            components,
          },
          submittedCategory: validated.category,
          metaStatus: row.status,
          metaCategory: row.category,
        });
      } catch {
        logMetaTemplate("ERROR", { reason: "ai_analysis_link_failed", tenantId: tenant.tenantId });
      }
    }
    return toPublicTemplate(row, publicPortfolioName(connection));
  }

  async syncFromAuth(
    auth: WabaRequestAuth,
    connectionId?: string,
  ): Promise<{ templates: MetaTemplatePublic[]; pages: number; removed: number }> {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnectedWaba(tenant.tenantId, connectionId);
    if (isMetaGraphUploadCooldown()) {
      const limited = new MetaWhatsappError("graph_rate_limited");
      limited.message = metaGraphUploadCooldownMessage();
      throw limited;
    }
    let token = "";
    try {
      token = this.decrypt(connection.accessTokenEncrypted);
    } catch {
      throw new MetaWhatsappError("invalid_token");
    }
    const listedByWaba: Array<{
      wabaId: string;
      items: Array<{
        metaTemplateId: string | null;
        name: string;
        language: string;
        category: string | null;
        status: string | null;
        qualityScore: string | null;
        rejectedReason: string | null;
        components: unknown;
      } | null>;
      pages: number;
      complete: boolean;
    }> = [];
    let pages = 0;
    const startedAt = Date.now();
    const deadlineAt = startedAt + META_TEMPLATE_SYNC_BUDGET_MS;
    const primaryWabaId = String(connection.wabaId || "").trim();
    const remainingMs = () => Math.max(0, deadlineAt - Date.now());
    const wabaIds = await listSyncTargetWabaIds({
      token,
      connection,
      extraWabaIds: extraWabaIdsFromConnections(
        await this.listOpenConnections(tenant.tenantId),
        connection,
      ),
      graph: this.graph,
      timeoutMs: Math.min(4000, Math.max(1500, remainingMs())),
    });
    const targets = [...new Set(wabaIds.filter(Boolean))];
    const tried = new Set<string>();
    const throwSyncTimeout = (): never => {
      const error = new MetaWhatsappError("send_failed", 503);
      error.message = "A Meta demorou demais para listar os templates. Tente de novo em instantes.";
      throw error;
    };
    const listOneWaba = async (wabaId: string): Promise<"ok" | "skip" | "budget"> => {
      if (!wabaId || tried.has(wabaId)) return "skip";
      tried.add(wabaId);
      const elapsed = Date.now() - startedAt;
      if (elapsed >= META_TEMPLATE_SYNC_BUDGET_MS) {
        logMetaTemplate("SYNC", {
          reason: listedByWaba.length ? "skip_sync_budget" : "skip_sync_budget_try_fallback",
          tenantId: tenant.tenantId,
          wabaId,
          elapsedMs: elapsed,
          listed: listedByWaba.length,
        });
        return "budget";
      }
      const listed = await listWabaMessageTemplates({
        token,
        wabaId,
        graph: this.graph,
        maxAttempts: 1,
        timeoutMs: Math.min(
          META_TEMPLATE_SYNC_LIST_TIMEOUT_MS,
          Math.max(1500, remainingMs()),
        ),
        maxPages: META_TEMPLATE_SYNC_MAX_PAGES,
        deadlineAt,
      });
      if (!listed.ok) {
        const denied = isMetaGraphWabaWriteDenied(listed.result.json, listed.result.status);
        const rateLimited = isMetaGraphRateLimitPayload(listed.result.json, listed.result.graphCode);
        if (denied) {
          logMetaTemplate("SYNC", {
            reason: "skip_waba_denied",
            tenantId: tenant.tenantId,
            wabaId,
            status: listed.result.status,
          });
          return "skip";
        }
        if (wabaId === primaryWabaId || rateLimited) {
          throwFromGraph(listed.result);
        }
        logMetaTemplate("SYNC", {
          reason: "skip_extra_waba",
          tenantId: tenant.tenantId,
          wabaId,
          status: listed.result.status,
        });
        return "skip";
      }
      pages += listed.pages;
      listedByWaba.push({
        wabaId,
        items: listed.items,
        pages: listed.pages,
        complete: listed.complete,
      });
      return "ok";
    };
    for (const wabaId of targets) {
      if ((await listOneWaba(wabaId)) === "budget") break;
    }
    if (!listedByWaba.length && remainingMs() >= 2000) {
      const fallbackIds = await resolveSyncFallbackWabaIds({
        token,
        businessId: String(connection.metaBusinessId || ""),
        alreadyTried: tried,
        graph: this.graph,
        timeoutMs: Math.min(3000, remainingMs()),
      });
      if (fallbackIds.length) {
        logMetaTemplate("SYNC", {
          reason: "fallback_debug_token_wabas",
          tenantId: tenant.tenantId,
          wabaCount: fallbackIds.length,
        });
      }
      for (const wabaId of fallbackIds) {
        const outcome = await listOneWaba(wabaId);
        if (listedByWaba.length) break;
        if (outcome === "budget") {
          if (!listedByWaba.length) throwSyncTimeout();
          break;
        }
      }
    }
    if (!listedByWaba.length && Date.now() - startedAt >= META_TEMPLATE_SYNC_BUDGET_MS) {
      throwSyncTimeout();
    }
    if (!listedByWaba.length) {
      const error = new MetaWhatsappError("send_failed", 424);
      error.message =
        "A Meta não deixou listar os templates com o token desta conexão. " +
        "No Laboratório, clique em + no portfólio e conecte a WABA que aparece no Manager (não a conta antiga gravada no card). " +
        "Depois clique de novo em Atualizar da Meta.";
      throw error;
    }
    const now = new Date().toISOString();
    const upserted: MetaTemplateRecord[] = [];
    const keepMetaIds = new Set<string>();
    const keepNameLang = new Set<string>();
    const completedWabas = new Set<string>();
    for (const listed of listedByWaba) {
      if (listed.complete) completedWabas.add(listed.wabaId);
      for (const item of listed.items) {
        if (!item) continue;
        keepMetaIds.add(String(item.metaTemplateId || "").trim());
        keepNameLang.add(`${listed.wabaId}::${item.name}::${item.language}`);
        const previous =
          (item.metaTemplateId
            ? await this.templates.findByMetaId(tenant.tenantId, item.metaTemplateId)
            : null) ||
          (await this.templates.findByWabaNameLanguage(
            tenant.tenantId,
            listed.wabaId,
            item.name,
            item.language,
          ));
        const oldHandle = previous ? headerHandleFromComponents(previous.components) : "";
        const saved = await this.templates.upsertFromGraph({
          tenantId: tenant.tenantId,
          connectionId: connection.id,
          wabaId: listed.wabaId,
          metaTemplateId: item.metaTemplateId,
          name: item.name,
          language: item.language,
          category: item.category,
          status: item.status,
          components: item.components,
          qualityScore: item.qualityScore,
          rejectedReason: item.rejectedReason,
          lastSyncedAt: now,
        });
        const newHandle = headerHandleFromComponents(saved.components);
        bindTemplateHeaderPreview({
          tenantId: tenant.tenantId,
          handle: newHandle,
          previousHandle: oldHandle,
          templateId: saved.id,
          metaTemplateId: saved.metaTemplateId,
          name: saved.name,
          language: saved.language,
        });
        upserted.push(saved);
        rememberApprovedTemplate(saved);
        try {
          await this.analyses.patchMetaOutcome({
            tenantId: tenant.tenantId,
            templateId: saved.id,
            metaTemplateId: saved.metaTemplateId,
            metaStatus: saved.status,
            metaCategory: saved.category,
            rejectedReason: saved.rejectedReason,
          });
        } catch {
          logMetaTemplate("ERROR", { reason: "ai_outcome_sync_failed", tenantId: tenant.tenantId });
        }
      }
    }
    let removed = 0;
    if (completedWabas.size) {
      const locals = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
      for (const row of locals) {
        if (!completedWabas.has(row.wabaId)) continue;
        const keepById = Boolean(row.metaTemplateId && keepMetaIds.has(row.metaTemplateId));
        const keepByName = keepNameLang.has(`${row.wabaId}::${row.name}::${row.language}`);
        if (keepById || keepByName) continue;
        if (await this.templates.deleteForTenant(tenant.tenantId, row.id)) removed += 1;
      }
    } else {
      logMetaTemplate("SYNC", {
        reason: "skip_prune_incomplete_list",
        tenantId: tenant.tenantId,
        pages,
      });
    }
    logMetaTemplate("SYNC", {
      tenantId: tenant.tenantId,
      pages,
      upserted: upserted.length,
      removed,
      wabaCount: listedByWaba.length,
      complete: completedWabas.size === listedByWaba.length,
    });
    const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
    return {
      templates: rows.map((row) => toPublicTemplate(row, publicPortfolioName(connection))),
      pages,
      removed,
    };
  }

  async deleteFromAuth(auth: WabaRequestAuth, templateId: string): Promise<{ deleted: true; metaDeleted: boolean }> {
    const tenant = requireTenant(auth);
    const id = String(templateId || "").trim();
    if (!id) throw new MetaWhatsappError("invalid_payload");
    const row = await this.templates.findByIdForTenant(tenant.tenantId, id);
    if (!row || row.tenantId !== tenant.tenantId) {
      throw new MetaWhatsappError("template_not_found");
    }
    const connection = await this.requireConnectedWaba(tenant.tenantId, row.connectionId);
    let metaDeleted = false;
    if (row.metaTemplateId || row.name) {
      let token = "";
      try {
        token = this.decrypt(connection.accessTokenEncrypted);
      } catch {
        throw new MetaWhatsappError("invalid_token");
      }
      const result = await deleteWabaMessageTemplate({
        token,
        wabaId: String(row.wabaId || connection.wabaId),
        name: row.name,
        metaTemplateId: row.metaTemplateId,
        graph: this.graph,
      });
      const missing = isGraphTemplateGone(result);
      if (!result.ok && !missing) throwFromGraph(result);
      metaDeleted = result.ok || missing;
    }
    const removed = await this.templates.deleteForTenant(tenant.tenantId, row.id);
    if (!removed) throw new MetaWhatsappError("template_not_found");
    logMetaTemplate("DELETE", {
      tenantId: tenant.tenantId,
      connectionId: connection.id,
      metaDeleted,
    });
    return { deleted: true, metaDeleted };
  }

  async assertSendable(input: {
    tenantId: string;
    connectionId: string;
    name: string;
    language: string;
  }): Promise<MetaTemplateRecord> {
    const row = await this.templates.findForSend(
      input.tenantId,
      input.connectionId,
      input.name,
      input.language,
    );
    if (!row || row.tenantId !== input.tenantId) {
      throw new MetaWhatsappError("template_not_found");
    }
    if (!isTemplateApprovedForSend(row.status)) {
      throw new MetaWhatsappError("template_not_ready");
    }
    return row;
  }

  async readHeaderPreviewFromAuth(
    auth: WabaRequestAuth,
    templateId: string,
  ): Promise<{ mime: string; bytes: Buffer } | null> {
    const tenant = requireTenant(auth);
    const id = String(templateId || "").trim();
    if (!id) throw new MetaWhatsappError("invalid_payload");
    const row = await this.templates.findByIdForTenant(tenant.tenantId, id);
    if (!row || row.tenantId !== tenant.tenantId) {
      throw new MetaWhatsappError("template_not_found");
    }
    const handle = headerHandleFromComponents(row.components);
    return readTemplateHeaderPreviewForSend({
      tenantId: tenant.tenantId,
      handle,
      templateId: id,
      metaTemplateId: row.metaTemplateId,
      name: row.name,
      language: row.language,
    });
  }

  async attachHeaderMediaFromAuth(
    auth: WabaRequestAuth,
    templateId: string,
    input: { fileName?: string; mime?: string; bytes?: Buffer },
  ): Promise<{ headerReady: boolean; headerPreviewUrl: string | null }> {
    const tenant = requireTenant(auth);
    const id = String(templateId || "").trim();
    const bytes = input.bytes;
    if (!id || !bytes?.length) throw new MetaWhatsappError("invalid_payload");
    const row = await this.templates.findByIdForTenant(tenant.tenantId, id);
    if (!row || row.tenantId !== tenant.tenantId) {
      throw new MetaWhatsappError("template_not_found");
    }
    const format = inspectMetaBroadcastTemplate(row.components).headerFormat;
    if (format !== "IMAGE" && format !== "VIDEO" && format !== "DOCUMENT") {
      const error = new MetaWhatsappError("invalid_payload");
      error.message = "Este template não tem mídia de cabeçalho.";
      throw error;
    }
    const mime = mimeForApprovedHeaderAttach(format, input.mime || "", input.fileName || "", bytes);
    if (!mime) throw new MetaWhatsappError("template_upload_failed");
    saveTemplateHeaderPreviewAliases({
      tenantId: tenant.tenantId,
      mime,
      fileName: input.fileName,
      bytes,
      aliases: templateHeaderPreviewKeys({
        handle: headerHandleFromComponents(row.components),
        templateId: row.id,
        metaTemplateId: row.metaTemplateId,
        name: row.name,
        language: row.language,
      }),
    });
    const headerPreviewUrl = `/integrations/meta/whatsapp/templates/${encodeURIComponent(row.id)}/header`;
    return { headerReady: true, headerPreviewUrl };
  }
}
