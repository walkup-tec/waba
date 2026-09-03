import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { decryptMetaToken } from "./meta-token-crypto";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { publicMetaGraphTemplateMessage, safePublicGraphTemplateDetail } from "./meta-whatsapp-graph-errors";
import { logMetaTemplate } from "./meta-whatsapp-template-log";
import { rememberTemplateApprovedAt } from "./meta-whatsapp-template-approved-at.store";
import { MetaWhatsappTemplateRepository } from "./meta-whatsapp-template.repository";
import {
  createWabaMessageTemplate,
  deleteWabaMessageTemplate,
  listWabaMessageTemplates,
  type TemplateGraphCaller,
} from "./meta-whatsapp-template-graph.client";
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
    const result = await createWabaMessageTemplate({
      token,
      wabaId: String(connection.wabaId),
      body: graphBody,
      graph: this.graph,
    });
    if (!result.ok) {
      throwFromGraph(result);
    }
    const now = new Date().toISOString();
    const row = await this.templates.upsertFromGraph({
      tenantId: tenant.tenantId,
      connectionId: connection.id,
      wabaId: String(connection.wabaId),
      metaTemplateId: result.json?.id ? String(result.json.id) : null,
      name: validated.name,
      language: validated.language,
      category: result.json?.category ? String(result.json.category) : validated.category,
      status: result.json?.status ? String(result.json.status) : "PENDING",
      components,
      lastSyncedAt: now,
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
    let token = "";
    try {
      token = this.decrypt(connection.accessTokenEncrypted);
    } catch {
      throw new MetaWhatsappError("invalid_token");
    }
    const listed = await listWabaMessageTemplates({
      token,
      wabaId: String(connection.wabaId),
      graph: this.graph,
    });
    if (!listed.ok) {
      throwFromGraph(listed.result);
    }
    const now = new Date().toISOString();
    const upserted: MetaTemplateRecord[] = [];
    for (const item of listed.items) {
      if (!item) continue;
      const previous =
        (item.metaTemplateId
          ? await this.templates.findByMetaId(tenant.tenantId, item.metaTemplateId)
          : null) ||
        (await this.templates.findByWabaNameLanguage(
          tenant.tenantId,
          String(connection.wabaId),
          item.name,
          item.language,
        ));
      const oldHandle = previous ? headerHandleFromComponents(previous.components) : "";
      const saved = await this.templates.upsertFromGraph({
        tenantId: tenant.tenantId,
        connectionId: connection.id,
        wabaId: String(connection.wabaId),
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
    let removed = 0;
    if (listed.complete) {
      const keepMetaIds = new Set(
        listed.items
          .map((item) => String(item?.metaTemplateId || "").trim())
          .filter(Boolean),
      );
      const keepNameLang = new Set(
        listed.items
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((item) => `${item.name}::${item.language}`),
      );
      const locals = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
      for (const row of locals) {
        const keepById = Boolean(row.metaTemplateId && keepMetaIds.has(row.metaTemplateId));
        const keepByName = keepNameLang.has(`${row.name}::${row.language}`);
        if (keepById || keepByName) continue;
        if (await this.templates.deleteForTenant(tenant.tenantId, row.id)) removed += 1;
      }
    } else {
      logMetaTemplate("SYNC", {
        reason: "skip_prune_incomplete_list",
        tenantId: tenant.tenantId,
        pages: listed.pages,
      });
    }
    logMetaTemplate("SYNC", {
      tenantId: tenant.tenantId,
      pages: listed.pages,
      upserted: upserted.length,
      removed,
      complete: listed.complete,
    });
    const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
    return {
      templates: rows.map((row) => toPublicTemplate(row, publicPortfolioName(connection))),
      pages: listed.pages,
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
        wabaId: String(connection.wabaId),
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
