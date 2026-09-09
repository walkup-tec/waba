import { randomUUID } from "node:crypto";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import type { WabaPublicBaseRequestHints } from "../../lib/waba-public-base-url";
import { decryptMetaToken } from "./meta-token-crypto";
import { logMetaWhatsappSafe, MetaWhatsappError, type MetaWhatsappErrorCode } from "./meta-whatsapp-errors";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { MetaWhatsappConnectionService } from "./meta-whatsapp-connection.service";
import { MetaWhatsappTemplateRepository } from "./meta-whatsapp-template.repository";
import { isTemplateApprovedForSend } from "./meta-whatsapp-template.types";
import type { MetaTemplateRecord } from "./meta-whatsapp-template.types";
import {
  findWabaMessageTemplatesByName,
} from "./meta-whatsapp-template-graph.client";
import {
  GRAPH_TEMPLATE_MISSING_CODE,
  pickApprovedGraphTemplate,
  shouldAbortBroadcastOnRepeatedTemplateMissing,
} from "./meta-whatsapp-broadcast-graph-template";
import {
  BROADCAST_HEADER_MISSING_FILE_ERROR,
  classifyBroadcastHeaderMedia,
  headerUploadFileName,
} from "./meta-whatsapp-broadcast-header";
import {
  headerHandleFromComponents,
  readTemplateHeaderPreviewForSend,
} from "./meta-whatsapp-template-header-preview.store";
import { MetaCloudProvider } from "../whatsapp/meta-cloud-provider";
import type { WhatsAppTemplateComponent } from "../whatsapp/whatsapp-provider";
import {
  inspectMetaBroadcastTemplate,
  resolveBroadcastColumnMapping,
  type MetaBroadcastTemplateInspect,
} from "./meta-whatsapp-broadcast-template";
import {
  guessMetaBroadcastNomeColumn,
  guessMetaBroadcastNumeroColumn,
  guessMetaBroadcastPhoneColumn,
  parseMetaBroadcastLeads,
  readMetaBroadcastSheet,
  type MetaBroadcastLeadMapping,
} from "./meta-whatsapp-broadcast-leads";
import { uploadCloudApiMedia } from "./meta-whatsapp-broadcast-media";
import {
  appendBroadcastLeadStatusLog,
  findBroadcastByIntakeCampaignId,
  findBroadcastCampaign,
  finalizeStaleRunningBroadcast,
  listActiveCloudBroadcasts,
  listBroadcastCampaigns,
  listResumableOrphanedBroadcasts,
  listStaleRunningBroadcastsWithoutPending,
  publicBroadcastCampaign,
  reopenOptInPtxBroadcastToContinue,
  saveBroadcastCampaign,
  voidBroadcastCampaignForRetry,
  type MetaBroadcastCampaign,
  type MetaBroadcastLead,
} from "./meta-whatsapp-broadcast.store";
import {
  META_BROADCAST_MAX_SENDS_PER_NUMBER,
  assignBroadcastLeadsToPhones,
  normalizeBroadcastPhoneNumberIds,
  resolveBroadcastLeadQuotas,
} from "./meta-whatsapp-broadcast-split";
import {
  attachBroadcastLeadPhoneBindings,
  bindingsFromCampaignPhones,
  BroadcastPhoneSelectionError,
  connectionIdByPhoneNumber,
  connectionNeedsLocalTemplate,
  indexBroadcastPortfolioPhones,
  resolveBroadcastPhoneBindings,
  templateMissingOnPortfolioMessage,
  type MetaBroadcastPhoneBinding,
} from "./meta-whatsapp-broadcast-phones";
import {
  buildCloudBroadcastProtectSnapshot,
  CLOUD_BROADCAST_RESUME_WATCHDOG_MS,
  type CloudBroadcastProtectSnapshot,
} from "./meta-whatsapp-broadcast-protect";
import { isBroadcastVoided, isCloudBroadcastInactiveForRetry } from "./meta-whatsapp-broadcast-void";
import { scheduleLabReportFinalize } from "./meta-whatsapp-broadcast-report";
import { attachCampaignIdToShortLink } from "../../shortener/waba-shortener.service";
import {
  extractSlugFromPublicShortUrl,
  findShortLinkBySlug,
} from "../../shortener/waba-shortener.repository";
import { createMetaTemplateButtonShortUrl } from "./meta-whatsapp-template-ai-short-url";
import { WabaCampaignIntakeRepository } from "../../disparos/waba-campaign-intake.repository";
import { normalizeCampaignIntakeStatus } from "../../disparos/waba-campaign-intake-status";
import { campaignAttendedByLaboratorioStaff } from "../../disparos/waba-campaign-laboratorio-attended";
import { WabaSubscriberRepository } from "../../subscribers/waba-subscriber.repository";
import {
  formatCloudLinkableCampaignLabel,
  isLinkableLabCampaignStatus,
} from "./meta-whatsapp-broadcast-linkable";
import { toCloudBroadcastHistoryItem } from "./meta-whatsapp-broadcast-history";
import { lookupTemplateApprovedAt } from "./meta-whatsapp-template-approved-at.store";

const running = new Set<string>();
let resumeWatchdogTimer: ReturnType<typeof setInterval> | null = null;

export function isCloudBroadcastSendLoopAlive(campaignId: string): boolean {
  return running.has(String(campaignId || "").trim());
}

export function getCloudBroadcastProtectSnapshot(): CloudBroadcastProtectSnapshot {
  return buildCloudBroadcastProtectSnapshot({
    campaigns: listActiveCloudBroadcasts(),
    isLoopAlive: isCloudBroadcastSendLoopAlive,
    watchdogMs: CLOUD_BROADCAST_RESUME_WATCHDOG_MS,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireTenant(auth: WabaRequestAuth) {
  try {
    return resolveMetaWhatsappTenant(auth);
  } catch {
    throw new MetaWhatsappError("unauthenticated");
  }
}

function fail(code: MetaWhatsappErrorCode, message?: string): never {
  const error = new MetaWhatsappError(code);
  if (message) error.message = message;
  throw error;
}

function headerMediaType(format: MetaBroadcastTemplateInspect["headerFormat"]): "image" | "video" | "document" | null {
  if (format === "IMAGE") return "image";
  if (format === "VIDEO") return "video";
  if (format === "DOCUMENT") return "document";
  return null;
}

function mimeFromHeader(format: MetaBroadcastTemplateInspect["headerFormat"], stored?: string): string {
  const current = String(stored || "").trim().toLowerCase();
  if (current) return current;
  if (format === "VIDEO") return "video/mp4";
  if (format === "DOCUMENT") return "application/pdf";
  return "image/jpeg";
}

export class MetaWhatsappBroadcastService {
  constructor(
    private readonly connections = new MetaWhatsappConnectionRepository(),
    private readonly templates = new MetaWhatsappTemplateRepository(),
    private readonly portfolios = new MetaWhatsappConnectionService(),
    private readonly provider = new MetaCloudProvider(),
    private readonly decrypt = decryptMetaToken,
    private readonly delayMs = 800,
  ) {}

  private async loadApprovedTemplate(tenantId: string, connectionId: string, templateId: string) {
    const connId = String(connectionId || "").trim();
    const tplId = String(templateId || "").trim();
    if (!connId || !tplId) {
      fail("invalid_payload", "Selecione o portfólio e um template aprovado.");
    }
    const connection = await this.connections.findByIdForTenant(tenantId, connId);
    if (
      !connection ||
      connection.tenantId !== tenantId ||
      (connection.status !== "connected" && connection.status !== "pending_confirmation") ||
      !connection.wabaId
    ) {
      throw new MetaWhatsappError("not_connected");
    }
    const template = await this.templates.findByIdForTenant(tenantId, tplId);
    if (!template || template.tenantId !== tenantId || template.connectionId !== connection.id) {
      throw new MetaWhatsappError("template_not_found");
    }
    if (!isTemplateApprovedForSend(template.status)) {
      throw new MetaWhatsappError("template_not_ready");
    }
    const live = await this.overlayApprovedTemplateFromGraph(
      { accessTokenEncrypted: connection.accessTokenEncrypted, wabaId: String(connection.wabaId) },
      template,
    );
    return { connection, template: live, inspect: inspectMetaBroadcastTemplate(live.components) };
  }

  /** Laboratório local pode mostrar Aprovado; o POST usa o que a Graph tem nesta WABA. */
  private async overlayApprovedTemplateFromGraph(
    connection: { accessTokenEncrypted: string; wabaId: string },
    template: MetaTemplateRecord,
  ): Promise<MetaTemplateRecord> {
    let token = "";
    try {
      token = this.decrypt(connection.accessTokenEncrypted);
    } catch {
      return template;
    }
    const listed = await findWabaMessageTemplatesByName({
      token,
      wabaId: connection.wabaId,
      name: template.name,
    });
    if (!listed.ok) return template;
    const wantName = String(template.name || "").trim().toLowerCase();
    const named = listed.items.filter(
      (row) => row && String(row.name || "").trim().toLowerCase() === wantName,
    );
    if (!named.length) return template;
    const picked = pickApprovedGraphTemplate(listed.items, template.name, template.language);
    if (!picked) {
      const seen = named.map((row) => `${row!.language}:${row!.status || "?"}`).slice(0, 6);
      fail(
        "template_not_ready",
        `A Graph não tem ${template.name} (${template.language}) APPROVED nesta WABA (${seen.join(", ")}).`,
      );
    }
    return {
      ...template,
      language: picked.language,
      status: picked.status || template.status,
      components: picked.components ?? template.components,
      metaTemplateId: picked.metaTemplateId || template.metaTemplateId,
    };
  }

  async inspectFromAuth(
    auth: WabaRequestAuth,
    input: { connectionId?: string; templateId?: string },
  ) {
    const tenant = requireTenant(auth);
    const loaded = await this.loadApprovedTemplate(
      tenant.tenantId,
      String(input.connectionId || "").trim(),
      String(input.templateId || "").trim(),
    );
    const headerKind = headerMediaType(loaded.inspect.headerFormat);
    const preview = headerKind
      ? readTemplateHeaderPreviewForSend({
          tenantId: tenant.tenantId,
          handle: headerHandleFromComponents(loaded.template.components),
          templateId: loaded.template.id,
          metaTemplateId: loaded.template.metaTemplateId,
          name: loaded.template.name,
          language: loaded.template.language,
        })
      : null;
    return {
      inspect: loaded.inspect,
      templateId: loaded.template.id,
      templateName: loaded.template.name,
      language: loaded.template.language,
      connectionId: loaded.connection.id,
      mapping: resolveBroadcastColumnMapping(loaded.inspect.bodyVariables),
      headerReady: !headerKind || Boolean(preview),
      headerNeedsFile: Boolean(headerKind) && !preview,
    };
  }

  previewFromBuffer(input: {
    buffer: Buffer;
    fileName: string;
    mapping: MetaBroadcastLeadMapping;
    inspect?: MetaBroadcastTemplateInspect;
  }) {
    const sheet = readMetaBroadcastSheet(input.buffer, input.fileName);
    const phoneColumn = String(input.mapping.phoneColumn || guessMetaBroadcastPhoneColumn(sheet.columns)).trim();
    const parsed = parseMetaBroadcastLeads({
      sheet,
      mapping: {
        phoneColumn,
        nomeColumn: input.mapping.nomeColumn || guessMetaBroadcastNomeColumn(sheet.columns),
        numeroColumn:
          input.mapping.numeroColumn || guessMetaBroadcastNumeroColumn(sheet.columns, phoneColumn),
        textoColumn: input.mapping.textoColumn,
      },
      bodyVariables: input.inspect?.bodyVariables,
    });
    return {
      columns: sheet.columns,
      phoneColumn,
      nomeColumn: String(input.mapping.nomeColumn || guessMetaBroadcastNomeColumn(sheet.columns) || "").trim(),
      numeroColumn: String(
        input.mapping.numeroColumn || guessMetaBroadcastNumeroColumn(sheet.columns, phoneColumn) || "",
      ).trim(),
      valid: parsed.leads.length,
      invalid: parsed.invalid.length,
      duplicatesRemoved: parsed.duplicatesRemoved,
      truncated: parsed.truncated,
      samples: parsed.samples,
      parsed,
    };
  }

  async previewFromAuth(
    auth: WabaRequestAuth,
    input: {
      connectionId?: string;
      templateId?: string;
      buffer: Buffer;
      fileName: string;
      mapping: MetaBroadcastLeadMapping;
    },
  ) {
    const tenant = requireTenant(auth);
    const loaded = await this.loadApprovedTemplate(
      tenant.tenantId,
      String(input.connectionId || "").trim(),
      String(input.templateId || "").trim(),
    );
    const preview = this.previewFromBuffer({
      buffer: input.buffer,
      fileName: input.fileName,
      mapping: input.mapping,
      inspect: loaded.inspect,
    });
    return {
      inspect: loaded.inspect,
      mapping: resolveBroadcastColumnMapping(loaded.inspect.bodyVariables),
      columns: preview.columns,
      phoneColumn: preview.phoneColumn,
      nomeColumn: preview.nomeColumn,
      numeroColumn: preview.numeroColumn,
      valid: preview.valid,
      invalid: preview.invalid,
      duplicatesRemoved: preview.duplicatesRemoved,
      truncated: preview.truncated,
      samples: preview.samples,
    };
  }

  private async requireActivePhoneBindings(
    auth: WabaRequestAuth,
    phoneNumberIds: string[],
  ): Promise<MetaBroadcastPhoneBinding[]> {
    const requested = normalizeBroadcastPhoneNumberIds(phoneNumberIds);
    if (!requested.length) {
      fail("invalid_payload", "Selecione ao menos um número Ativo e disponível.");
    }
    const assets = await this.portfolios.listPortfolioAssets(auth);
    const catalog = indexBroadcastPortfolioPhones(assets.portfolios || []);
    try {
      return resolveBroadcastPhoneBindings(requested, catalog);
    } catch (error) {
      const reason = error instanceof BroadcastPhoneSelectionError ? error.reason : "unknown";
      const message =
        error instanceof Error ? error.message : "Não foi possível validar os números selecionados.";
      if (reason === "inactive") fail("phone_not_registered", message);
      fail("invalid_payload", message);
    }
  }

  private async assertTemplateOnPhoneBindings(input: {
    tenantId: string;
    templateName: string;
    templateLanguage: string;
    templateConnectionId: string;
    templateWabaId?: string | null;
    bindings: MetaBroadcastPhoneBinding[];
  }): Promise<void> {
    const seen = new Set<string>();
    for (const binding of input.bindings) {
      const connectionId = String(binding.connectionId || "").trim();
      if (!connectionId || seen.has(connectionId)) continue;
      seen.add(connectionId);
      if (
        !connectionNeedsLocalTemplate({
          connectionId,
          wabaId: binding.wabaId,
          templateConnectionId: input.templateConnectionId,
          templateWabaId: input.templateWabaId,
        })
      ) {
        continue;
      }
      const other = await this.templates.findForSend(
        input.tenantId,
        connectionId,
        input.templateName,
        input.templateLanguage,
      );
      if (!other || !isTemplateApprovedForSend(other.status)) {
        fail(
          "invalid_payload",
          templateMissingOnPortfolioMessage({
            templateName: input.templateName,
            portfolioName: binding.portfolioName,
          }),
        );
      }
    }
  }

  private async resolveHeaderMedia(input: {
    tenantId: string;
    token: string;
    phoneNumberId: string;
    templateId: string;
    metaTemplateId?: string | null;
    templateName?: string;
    language?: string;
    components: unknown;
    inspect: MetaBroadcastTemplateInspect;
  }): Promise<{ mediaId?: string; link?: string } | null> {
    const kind = headerMediaType(input.inspect.headerFormat);
    if (!kind) return null;
    const handle = headerHandleFromComponents(input.components);
    const preview = readTemplateHeaderPreviewForSend({
      tenantId: input.tenantId,
      handle,
      templateId: input.templateId,
      metaTemplateId: input.metaTemplateId,
      name: input.templateName,
      language: input.language,
    });
    const plan = classifyBroadcastHeaderMedia({
      hasLocalPreview: Boolean(preview),
    });
    if (plan === "upload" && preview) {
      const mime = mimeFromHeader(input.inspect.headerFormat, preview.mime);
      const mediaId = await uploadCloudApiMedia({
        token: input.token,
        phoneNumberId: input.phoneNumberId,
        bytes: preview.bytes,
        mime,
        fileName: headerUploadFileName(mime),
      });
      if (!mediaId) {
        fail("template_upload_failed", "A Meta recusou a mídia do cabeçalho para o disparo.");
      }
      return { mediaId };
    }
    logMetaWhatsappSafe("broadcast_header_missing_file", {
      templateId: input.templateId,
    });
    fail("template_media_required", BROADCAST_HEADER_MISSING_FILE_ERROR);
  }

  private async resolveHeaderMediaForBindings(input: {
    tenantId: string;
    bindings: MetaBroadcastPhoneBinding[];
    templateId: string;
    metaTemplateId?: string | null;
    templateName?: string;
    language?: string;
    components: unknown;
    inspect: MetaBroadcastTemplateInspect;
  }): Promise<Record<string, { mediaId?: string; link?: string } | null>> {
    const out: Record<string, { mediaId?: string; link?: string } | null> = {};
    const tokenByConnection = new Map<string, string>();
    for (const binding of input.bindings) {
      const connectionId = String(binding.connectionId || "").trim();
      const phoneNumberId = String(binding.phoneNumberId || "").trim();
      if (!connectionId || !phoneNumberId) continue;
      let token = tokenByConnection.get(connectionId);
      if (!token) {
        const connection = await this.connections.findByIdForTenant(input.tenantId, connectionId);
        if (!connection) throw new MetaWhatsappError("not_connected");
        try {
          token = this.decrypt(connection.accessTokenEncrypted);
        } catch {
          throw new MetaWhatsappError("invalid_token");
        }
        tokenByConnection.set(connectionId, token);
      }
      out[phoneNumberId] = await this.resolveHeaderMedia({
        tenantId: input.tenantId,
        token,
        phoneNumberId,
        templateId: input.templateId,
        metaTemplateId: input.metaTemplateId,
        templateName: input.templateName,
        language: input.language,
        components: input.components,
        inspect: input.inspect,
      });
    }
    return out;
  }

  private async createCampaignShortLink(input: {
    tenantId: string;
    inspect: MetaBroadcastTemplateInspect;
    campaignId: string;
    publicBaseHints?: WabaPublicBaseRequestHints;
  }): Promise<{ shortUrl: string; shortSlug: string; trackedSlug: string; clicksAtStart: number }> {
    const button = input.inspect.urlButton;
    const existingSlug = button?.slug || "";
    const existing = existingSlug ? await findShortLinkBySlug(existingSlug) : null;
    const destination =
      existing?.longUrl ||
      (button?.url && /^https?:\/\//i.test(button.url.replace(/\{\{\d+\}\}/g, "x"))
        ? button.url.replace(/\{\{\d+\}\}/g, input.campaignId.slice(0, 8))
        : "https://wabadisparos.com.br/");
    const shortUrl = await createMetaTemplateButtonShortUrl({
      destinationUrl: destination,
      tenantId: input.tenantId,
      publicBaseHints: input.publicBaseHints,
    });
    const shortSlug = extractSlugFromPublicShortUrl(shortUrl) || "";
    if (shortSlug) {
      await attachCampaignIdToShortLink(shortSlug, input.campaignId);
    }
    let trackedSlug = shortSlug;
    let clicksAtStart = 0;
    if (existingSlug && !button?.hasVariable) {
      await attachCampaignIdToShortLink(existingSlug, input.campaignId);
      trackedSlug = existingSlug;
      clicksAtStart = Math.max(0, Number(existing?.clicks || 0));
    }
    return { shortUrl, shortSlug, trackedSlug, clicksAtStart };
  }

  private buildComponents(input: {
    inspect: MetaBroadcastTemplateInspect;
    lead: MetaBroadcastLead;
    header?: { mediaId?: string; link?: string } | null;
    buttonSlug?: string;
  }): WhatsAppTemplateComponent[] {
    const components: WhatsAppTemplateComponent[] = [];
    const kind = headerMediaType(input.inspect.headerFormat);
    if (kind && input.header?.mediaId) {
      components.push({
        type: "header",
        parameters: [{ type: kind, [kind]: { id: input.header.mediaId } }],
      });
    }
    if (input.inspect.bodyVariables.length) {
      components.push({
        type: "body",
        parameters: input.inspect.bodyVariables.map((item) => ({
          type: "text",
          text:
            item.key === "nome"
              ? String(input.lead.nome || "Cliente").slice(0, 60)
              : item.key === "numero"
                ? String(input.lead.numero || input.lead.waId).slice(0, 60)
                : String(input.lead.texto || input.lead.nome || input.lead.waId).slice(0, 60),
        })),
      });
    }
    if (input.inspect.urlButton?.hasVariable && input.buttonSlug) {
      components.push({
        type: "button",
        sub_type: "url",
        index: String(input.inspect.urlButton.index),
        parameters: [{ type: "text", text: input.buttonSlug }],
      });
    }
    return components;
  }

  async startFromAuth(
    auth: WabaRequestAuth,
    input: {
      connectionId?: string;
      templateId?: string;
      phoneNumberId?: string;
      phoneNumberIds?: string[];
      buffer: Buffer;
      fileName: string;
      mapping: MetaBroadcastLeadMapping;
      intakeCampaignId?: string;
      publicBaseHints?: WabaPublicBaseRequestHints;
      phoneQuotas?: Array<{ phoneNumberId?: string; planned?: unknown }> | null;
    },
  ) {
    const tenant = requireTenant(auth);
    const connectionId = String(input.connectionId || "").trim();
    const loaded = await this.loadApprovedTemplate(tenant.tenantId, connectionId, String(input.templateId || "").trim());
    const phoneBindings = await this.requireActivePhoneBindings(
      auth,
      normalizeBroadcastPhoneNumberIds(
        input.phoneNumberIds?.length ? input.phoneNumberIds : [String(input.phoneNumberId || "")],
      ),
    );
    await this.assertTemplateOnPhoneBindings({
      tenantId: tenant.tenantId,
      templateName: loaded.template.name,
      templateLanguage: loaded.template.language,
      templateConnectionId: loaded.connection.id,
      templateWabaId: loaded.connection.wabaId,
      bindings: phoneBindings,
    });
    const phoneNumberIds = phoneBindings.map((row) => row.phoneNumberId);
    const phoneNumberId = phoneNumberIds[0];
    const preview = this.previewFromBuffer({
      buffer: input.buffer,
      fileName: input.fileName,
      mapping: input.mapping,
      inspect: loaded.inspect,
    });
    if (!preview.parsed.leads.length) {
      fail(
        "invalid_recipient",
        "Nenhum número válido após a normatização Meta (E.164 com DDI). Confira a coluna de telefone.",
      );
    }
    let phoneQuotas;
    let assignedLeads;
    try {
      phoneQuotas = resolveBroadcastLeadQuotas(
        phoneNumberIds,
        preview.parsed.leads.length,
        input.phoneQuotas,
      );
      assignedLeads = attachBroadcastLeadPhoneBindings(
        assignBroadcastLeadsToPhones(
          preview.parsed.leads,
          phoneNumberIds,
          META_BROADCAST_MAX_SENDS_PER_NUMBER,
          input.phoneQuotas,
        ),
        phoneBindings,
      );
    } catch (error) {
      fail(
        "invalid_payload",
        error instanceof Error
          ? error.message
          : `Não foi possível fracionar os envios (máx. ${META_BROADCAST_MAX_SENDS_PER_NUMBER} por número).`,
      );
    }
    const sendingPhoneIds = new Set(phoneQuotas.map((row) => row.phoneNumberId));
    const sendingBindings = phoneBindings.filter((row) => sendingPhoneIds.has(row.phoneNumberId));
    const sendingPhoneNumberIds = sendingBindings.map((row) => row.phoneNumberId);
    const sendingPhoneNumberId = sendingPhoneNumberIds[0] || phoneNumberId;
    const campaignId = randomUUID();
    const intakeCampaignId = this.linkSubscriberCampaign(auth, String(input.intakeCampaignId || "").trim());
    const headerByPhone = await this.resolveHeaderMediaForBindings({
      tenantId: tenant.tenantId,
      bindings: sendingBindings,
      templateId: loaded.template.id,
      metaTemplateId: loaded.template.metaTemplateId,
      templateName: loaded.template.name,
      language: loaded.template.language,
      components: loaded.template.components,
      inspect: loaded.inspect,
    });
    const short = await this.createCampaignShortLink({
      tenantId: tenant.tenantId,
      inspect: loaded.inspect,
      campaignId,
      publicBaseHints: input.publicBaseHints,
    });
    const now = new Date().toISOString();
    const templateApprovedAt =
      lookupTemplateApprovedAt({
        tenantId: tenant.tenantId,
        templateId: loaded.template.id,
        metaTemplateId: loaded.template.metaTemplateId,
        wabaId: loaded.connection.wabaId,
        name: loaded.template.name,
        language: loaded.template.language,
      }) ||
      loaded.template.lastSyncedAt ||
      loaded.template.updatedAt ||
      undefined;
    const campaign: MetaBroadcastCampaign = {
      id: campaignId,
      tenantId: tenant.tenantId,
      connectionId: loaded.connection.id,
      templateId: loaded.template.id,
      templateName: loaded.template.name,
      language: loaded.template.language,
      phoneNumberId: sendingPhoneNumberId,
      phoneNumberIds: sendingPhoneNumberIds,
      phoneBindings: sendingBindings,
      phoneQuotas: phoneQuotas.map((row) => ({ phoneNumberId: row.phoneNumberId, planned: row.planned })),
      intakeCampaignId,
      shortSlug: short.shortSlug,
      shortUrl: short.shortUrl,
      trackedSlug: short.trackedSlug,
      clicksAtStart: short.clicksAtStart,
      clicks: 0,
      status: "queued",
      total: assignedLeads.length,
      sent: 0,
      failed: 0,
      skipped: preview.parsed.invalid.length,
      createdAt: now,
      updatedAt: now,
      ...(templateApprovedAt ? { templateApprovedAt } : {}),
      leads: assignedLeads,
    };
    saveBroadcastCampaign(campaign);
    logMetaWhatsappSafe("broadcast-queued", {
      tenantId: tenant.tenantId,
      total: campaign.total,
      skippedInvalid: campaign.skipped,
      duplicatesRemoved: preview.parsed.duplicatesRemoved,
    });
    void this.runCampaign(campaign.id, tenant.tenantId, {
      connectionId: loaded.connection.id,
      connectionByPhone: connectionIdByPhoneNumber(sendingBindings),
      templateName: loaded.template.name,
      language: loaded.template.language,
      phoneNumberId: sendingPhoneNumberId,
      phoneNumberIds: sendingPhoneNumberIds,
      inspect: loaded.inspect,
      headerByPhone,
      buttonSlug: loaded.inspect.urlButton?.hasVariable ? short.shortSlug : undefined,
    });
    return publicBroadcastCampaign(campaign);
  }

  private async runCampaign(
    campaignId: string,
    tenantId: string,
    ctx: {
      connectionId: string;
      connectionByPhone?: Record<string, string>;
      templateName: string;
      language: string;
      phoneNumberId: string;
      phoneNumberIds?: string[];
      inspect: MetaBroadcastTemplateInspect;
      header?: { mediaId?: string; link?: string } | null;
      headerByPhone?: Record<string, { mediaId?: string; link?: string } | null>;
      buttonSlug?: string;
    },
  ): Promise<void> {
    if (running.has(campaignId)) return;
    running.add(campaignId);
    const row = findBroadcastCampaign(tenantId, campaignId);
    if (!row) {
      running.delete(campaignId);
      return;
    }
    row.status = "running";
    if (!row.sendStartedAt) row.sendStartedAt = new Date().toISOString();
    saveBroadcastCampaign(row);
    let consecutiveTemplateMissing = 0;
    try {
      for (let index = 0; index < row.leads.length; index += 1) {
        const live = findBroadcastCampaign(tenantId, campaignId);
        if (!live) {
          row.status = "failed";
          row.sendFinishedAt = new Date().toISOString();
          saveBroadcastCampaign(row);
          logMetaWhatsappSafe("broadcast-aborted", {
            tenantId,
            campaignId,
            sent: row.sent,
            reason: "missing",
          });
          return;
        }
        if (isBroadcastVoided(live)) {
          row.status = "failed";
          row.voidedAt = live.voidedAt;
          row.sendFinishedAt = new Date().toISOString();
          saveBroadcastCampaign(row);
          logMetaWhatsappSafe("broadcast-aborted", {
            tenantId,
            campaignId,
            sent: row.sent,
            reason: "header_media_or_void",
          });
          return;
        }
        if (live.status === "failed") {
          row.status = "failed";
          row.sendFinishedAt = new Date().toISOString();
          saveBroadcastCampaign(row);
          logMetaWhatsappSafe("broadcast-aborted", {
            tenantId,
            campaignId,
            sent: row.sent,
            reason: "paused_or_failed",
          });
          return;
        }
        const lead = row.leads[index];
        if (lead.status === "sent" || lead.status === "failed" || lead.status === "skipped") continue;
        try {
          const leadPhoneNumberId = String(lead.phoneNumberId || ctx.phoneNumberId || "").trim();
          const leadConnectionId = String(
            lead.connectionId ||
              (leadPhoneNumberId && ctx.connectionByPhone
                ? ctx.connectionByPhone[leadPhoneNumberId]
                : "") ||
              ctx.connectionId ||
              "",
          ).trim();
          const header =
            (leadPhoneNumberId && ctx.headerByPhone
              ? ctx.headerByPhone[leadPhoneNumberId]
              : undefined) ?? ctx.header ?? null;
          const sent = await this.provider.sendTemplate({
            tenantId,
            to: lead.waId,
            templateName: ctx.templateName,
            language: ctx.language,
            connectionId: leadConnectionId || ctx.connectionId,
            phoneNumberId: leadPhoneNumberId || ctx.phoneNumberId,
            preferConnectionToken: true,
            components: this.buildComponents({
              inspect: ctx.inspect,
              lead,
              header,
              buttonSlug: ctx.buttonSlug,
            }),
          });
          lead.status = "sent";
          lead.metaStatus = "accepted";
          lead.wamid = sent.messageId || lead.wamid;
          appendBroadcastLeadStatusLog(lead, {
            status: "accepted",
            at: new Date().toISOString(),
          });
          row.sent += 1;
        } catch (error) {
          const graphCode = String(
            (error as { graphCode?: string | null })?.graphCode || "",
          ).trim();
          lead.status = "failed";
          lead.metaStatus = "failed";
          if (graphCode) lead.errorCode = graphCode;
          lead.error = error instanceof Error ? error.message.slice(0, 180) : "send_failed";
          appendBroadcastLeadStatusLog(lead, {
            status: "failed",
            at: new Date().toISOString(),
            ...(graphCode ? { errorCode: graphCode } : {}),
          });
          row.failed += 1;
          if (graphCode === GRAPH_TEMPLATE_MISSING_CODE) {
            consecutiveTemplateMissing += 1;
          } else {
            consecutiveTemplateMissing = 0;
          }
          if (shouldAbortBroadcastOnRepeatedTemplateMissing(graphCode, consecutiveTemplateMissing)) {
            row.status = "failed";
            row.sendFinishedAt = new Date().toISOString();
            saveBroadcastCampaign(row);
            logMetaWhatsappSafe("broadcast-aborted", {
              tenantId,
              campaignId,
              sent: row.sent,
              reason: "template_missing_132001",
            });
            return;
          }
        }
        saveBroadcastCampaign(row);
        if (index < row.leads.length - 1 && this.delayMs > 0) {
          const jitter = Math.floor(Math.random() * 200);
          await sleep(this.delayMs + jitter);
        }
      }
      row.status = row.failed === row.total ? "failed" : "done";
      row.sendFinishedAt = new Date().toISOString();
      saveBroadcastCampaign(row);
      logMetaWhatsappSafe("broadcast-done", {
        tenantId,
        sent: row.sent,
        failed: row.failed,
        total: row.total,
      });
      if (row.intakeCampaignId) scheduleLabReportFinalize(row.intakeCampaignId);
    } catch {
      row.status = "failed";
      row.sendFinishedAt = new Date().toISOString();
      saveBroadcastCampaign(row);
      if (row.intakeCampaignId) scheduleLabReportFinalize(row.intakeCampaignId);
    } finally {
      running.delete(campaignId);
    }
  }

  listFromAuth(auth: WabaRequestAuth) {
    const tenant = requireTenant(auth);
    const intakes = new WabaCampaignIntakeRepository();
    const subscribers = new WabaSubscriberRepository();
    return listBroadcastCampaigns(tenant.tenantId, 40).map((row) => {
      const intake = row.intakeCampaignId ? intakes.getById(row.intakeCampaignId) : null;
      const ownerEmail = String(intake?.ownerEmail || "").trim().toLowerCase();
      const clientName = String(subscribers.getByEmail(ownerEmail)?.fullName || ownerEmail).trim();
      return toCloudBroadcastHistoryItem({
        campaign: row,
        campaignName: intake?.campaignName,
        clientName,
        plannedSendCount: intake?.plannedSendCount ?? row.total,
        intakeStatus: intake?.status,
      });
    });
  }

  getFromAuth(auth: WabaRequestAuth, id: string) {
    const tenant = requireTenant(auth);
    const row = findBroadcastCampaign(tenant.tenantId, String(id || "").trim());
    if (!row) fail("template_not_found", "Disparo Cloud não encontrado nesta conta.");
    return publicBroadcastCampaign(row);
  }

  /**
   * Campanhas do assinante Em andamento e atendidas por quem tem Laboratório.
   * Só essas entram no Disparo Cloud e recebem indicadores/cliques automáticos.
   */
  listLinkableSubscriberCampaigns(auth: WabaRequestAuth) {
    requireTenant(auth);
    const email = String(auth.email || "").trim().toLowerCase();
    const isMaster = auth.role === "master";
    const intakes = new WabaCampaignIntakeRepository();
    const subscribers = new WabaSubscriberRepository();
    return intakes
      .listAll()
      .filter((intake) => {
        if (!isLinkableLabCampaignStatus(intake.status)) return false;
        if (!campaignAttendedByLaboratorioStaff(intake)) return false;
        const existing = findBroadcastByIntakeCampaignId(intake.id);
        if (existing && existing.status !== "failed" && !isCloudBroadcastInactiveForRetry(existing)) {
          return false;
        }
        if (!isMaster) {
          const assigned = String(intake.assignedOperacionalEmail || "").trim().toLowerCase();
          if (assigned && assigned !== email) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 40)
      .map((intake) => {
        const ownerEmail = String(intake.ownerEmail || "").trim().toLowerCase();
        const subscriberName = String(subscribers.getByEmail(ownerEmail)?.fullName || "").trim();
        const plannedSendCount = Math.max(0, Math.round(Number(intake.plannedSendCount || 0)));
        return {
          id: intake.id,
          campaignName: intake.campaignName,
          ownerEmail,
          ownerName: subscriberName || ownerEmail,
          status: normalizeCampaignIntakeStatus(intake.status),
          plannedSendCount,
          assignedOperacionalEmail: String(intake.assignedOperacionalEmail || "").trim().toLowerCase(),
          label: formatCloudLinkableCampaignLabel({
            subscriberName,
            ownerEmail,
            campaignName: intake.campaignName,
            plannedSendCount,
          }),
        };
      });
  }

  /**
   * Após Redeploy/restart: retoma disparos `running`/`queued` com leads pendentes.
   * Não usa checagem de ocupação do número — o próprio lote é quem ocupa o telefone.
   */
  async resumeOrphanedCampaign(row: MetaBroadcastCampaign): Promise<boolean> {
    const campaignId = String(row.id || "").trim();
    const tenantId = String(row.tenantId || "").trim();
    if (!campaignId || !tenantId) return false;
    if (running.has(campaignId)) return false;
    if (isBroadcastVoided(row)) return false;
    try {
      const loaded = await this.loadApprovedTemplate(tenantId, row.connectionId, row.templateId);
      const phoneNumberIds = normalizeBroadcastPhoneNumberIds(
        row.phoneNumberIds?.length ? row.phoneNumberIds : [row.phoneNumberId],
      );
      const phoneBindings = bindingsFromCampaignPhones({
        phoneNumberIds,
        fallbackConnectionId: loaded.connection.id,
        stored: row.phoneBindings,
      });
      const headerByPhone = await this.resolveHeaderMediaForBindings({
        tenantId,
        bindings: phoneBindings,
        templateId: loaded.template.id,
        metaTemplateId: loaded.template.metaTemplateId,
        templateName: loaded.template.name,
        language: loaded.template.language,
        components: loaded.template.components,
        inspect: loaded.inspect,
      });
      logMetaWhatsappSafe("broadcast-resume", {
        campaignId,
        tenantId,
        pending: (row.leads || []).filter((lead) => !lead.status || lead.status === "queued").length,
        sent: row.sent,
        total: row.total,
        phoneCount: phoneNumberIds.length,
      });
      void this.runCampaign(campaignId, tenantId, {
        connectionId: loaded.connection.id,
        connectionByPhone: connectionIdByPhoneNumber(phoneBindings),
        templateName: loaded.template.name,
        language: loaded.template.language,
        phoneNumberId: phoneNumberIds[0] || row.phoneNumberId,
        phoneNumberIds,
        inspect: loaded.inspect,
        headerByPhone,
        buttonSlug: loaded.inspect.urlButton?.hasVariable ? row.shortSlug : undefined,
      });
      return true;
    } catch (error) {
      logMetaWhatsappSafe("broadcast-resume-failed", {
        campaignId,
        reason: error instanceof Error ? error.message.slice(0, 120) : "resume_failed",
      });
      return false;
    }
  }

  async resumeOrphanedCloudBroadcastsOnBoot(): Promise<number> {
    const reopened = reopenOptInPtxBroadcastToContinue();
    if (reopened) {
      logMetaWhatsappSafe("broadcast-reopen-opt-in-ptx", {
        campaignId: reopened.id,
        status: reopened.status,
        sent: reopened.sent,
        failed: reopened.failed,
        pending: (reopened.leads || []).filter((lead) => !lead.status || lead.status === "queued").length,
        total: reopened.total,
      });
    }
    let closed = 0;
    for (const stale of listStaleRunningBroadcastsWithoutPending()) {
      const done = finalizeStaleRunningBroadcast(stale.id);
      if (done) {
        closed += 1;
        if (done.intakeCampaignId) scheduleLabReportFinalize(done.intakeCampaignId);
      }
    }
    let resumed = 0;
    for (const row of listResumableOrphanedBroadcasts()) {
      if (await this.resumeOrphanedCampaign(row)) resumed += 1;
    }
    if (closed || resumed) {
      logMetaWhatsappSafe("broadcast-boot-resume", { closed, resumed });
    }
    return resumed;
  }

  private linkSubscriberCampaign(auth: WabaRequestAuth, intakeId: string): string | undefined {
    const id = String(intakeId || "").trim();
    if (!id) return undefined;
    const intakes = new WabaCampaignIntakeRepository();
    const intake = intakes.getById(id);
    if (!intake) {
      fail("invalid_payload", "Campanha do assinante não encontrada.");
    }
    if (!campaignAttendedByLaboratorioStaff(intake)) {
      fail(
        "invalid_payload",
        "Só é possível vincular campanhas atendidas por quem tem acesso ao Laboratório.",
      );
    }
    const status = normalizeCampaignIntakeStatus(intake.status);
    if (status === "completed" || status === "error_reported" || status === "cancelled") {
      fail("invalid_payload", "Esta campanha do assinante já foi encerrada.");
    }
    if (!isLinkableLabCampaignStatus(status)) {
      fail("invalid_payload", "Só é possível vincular campanhas Em andamento.");
    }
    const existing = findBroadcastByIntakeCampaignId(intake.id);
    if (existing && existing.status !== "failed" && !isCloudBroadcastInactiveForRetry(existing)) {
      fail("invalid_payload", "Esta campanha já tem um Disparo Cloud em andamento.");
    }
    if (existing && isCloudBroadcastInactiveForRetry(existing)) {
      voidBroadcastCampaignForRetry(existing.id);
    }
    return intake.id;
  }
}

/** Boot: retoma lotes órfãos após Redeploy + guardião periódico (fire-and-forget). */
export function ensureResumeOrphanedCloudBroadcasts(): void {
  const service = new MetaWhatsappBroadcastService();
  const runResume = (reason: string) => {
    void service.resumeOrphanedCloudBroadcastsOnBoot().catch((error) => {
      logMetaWhatsappSafe("broadcast-boot-resume-error", {
        reason: error instanceof Error ? error.message.slice(0, 120) : "boot_resume_failed",
        phase: reason,
      });
    });
  };
  runResume("boot");
  // Nova tentativa após o Graph/token aquecerem (Redeploy costuma matar o loop no meio).
  setTimeout(() => runResume("boot+3s"), 3_000).unref?.();
  setTimeout(() => runResume("boot+10s"), 10_000).unref?.();
  if (resumeWatchdogTimer) return;
  resumeWatchdogTimer = setInterval(() => {
    runResume("watchdog");
  }, CLOUD_BROADCAST_RESUME_WATCHDOG_MS);
  resumeWatchdogTimer.unref?.();
  logMetaWhatsappSafe("broadcast-protect-watchdog-started", {
    intervalMs: CLOUD_BROADCAST_RESUME_WATCHDOG_MS,
  });
}
