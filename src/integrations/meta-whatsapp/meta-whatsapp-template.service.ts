import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { decryptMetaToken } from "./meta-token-crypto";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { publicMetaGraphTemplateMessage, safePublicGraphTemplateDetail } from "./meta-whatsapp-graph-errors";
import { logMetaTemplate } from "./meta-whatsapp-template-log";
import { MetaWhatsappTemplateRepository } from "./meta-whatsapp-template.repository";
import {
  createWabaMessageTemplate,
  listWabaMessageTemplates,
  type TemplateGraphCaller,
} from "./meta-whatsapp-template-graph.client";
import { validateTemplateCreate } from "./meta-whatsapp-template-validate";
import {
  isTemplateApprovedForSend,
  toPublicTemplate,
  type MetaTemplatePublic,
  type MetaTemplateRecord,
} from "./meta-whatsapp-template.types";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { MetaWhatsappTemplateAiRepository } from "./meta-whatsapp-template-ai.repository";

function requireTenant(auth: WabaRequestAuth) {
  try {
    return resolveMetaWhatsappTenant(auth);
  } catch {
    throw new MetaWhatsappError("unauthenticated");
  }
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

  async listFromAuth(auth: WabaRequestAuth, connectionId?: string): Promise<MetaTemplatePublic[]> {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnectedWaba(tenant.tenantId, connectionId);
    const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
    logMetaTemplate("LIST", { tenantId: tenant.tenantId, count: rows.length });
    return rows.map(toPublicTemplate);
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
      components: validated.components,
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
      components: validated.components,
      lastSyncedAt: now,
    });
    logMetaTemplate("CREATE", {
      tenantId: tenant.tenantId,
      name: validated.name,
      language: validated.language,
      status: row.status,
    });
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
            components: validated.components,
          },
          submittedCategory: validated.category,
          metaStatus: row.status,
          metaCategory: row.category,
        });
      } catch {
        logMetaTemplate("ERROR", { reason: "ai_analysis_link_failed", tenantId: tenant.tenantId });
      }
    }
    return toPublicTemplate(row);
  }

  async syncFromAuth(
    auth: WabaRequestAuth,
    connectionId?: string,
  ): Promise<{ templates: MetaTemplatePublic[]; pages: number }> {
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
      upserted.push(saved);
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
    logMetaTemplate("SYNC", {
      tenantId: tenant.tenantId,
      pages: listed.pages,
      upserted: upserted.length,
    });
    const rows = await this.templates.listByTenantConnection(tenant.tenantId, connection.id);
    return { templates: rows.map(toPublicTemplate), pages: listed.pages };
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
}
