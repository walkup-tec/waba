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
import {
  headerHandleFromComponents,
  headerHttpsUrlFromComponents,
  readTemplateHeaderPreview,
} from "./meta-whatsapp-template-header-preview.store";
import { MetaCloudProvider } from "../whatsapp/meta-cloud-provider";
import type { WhatsAppTemplateComponent } from "../whatsapp/whatsapp-provider";
import {
  inspectMetaBroadcastTemplate,
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
  findBroadcastByIntakeCampaignId,
  findBroadcastCampaign,
  listBroadcastCampaigns,
  publicBroadcastCampaign,
  saveBroadcastCampaign,
  type MetaBroadcastCampaign,
  type MetaBroadcastLead,
} from "./meta-whatsapp-broadcast.store";
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

const running = new Set<string>();

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    return { connection, template, inspect: inspectMetaBroadcastTemplate(template.components) };
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
    return {
      inspect: loaded.inspect,
      templateId: loaded.template.id,
      templateName: loaded.template.name,
      language: loaded.template.language,
      connectionId: loaded.connection.id,
      mapping: {
        phone: true,
        nome: loaded.inspect.bodyVariables.some((item) => item.key === "nome"),
        numero: loaded.inspect.bodyVariables.some((item) => item.key === "numero"),
        texto: loaded.inspect.bodyVariables.some((item) => item.key === "texto"),
      },
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
      mapping: {
        phone: true,
        nome: loaded.inspect.bodyVariables.some((item) => item.key === "nome"),
        numero: loaded.inspect.bodyVariables.some((item) => item.key === "numero"),
        texto: loaded.inspect.bodyVariables.some((item) => item.key === "texto"),
      },
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

  private async requireActivePhone(
    auth: WabaRequestAuth,
    connectionId: string,
    phoneNumberId: string,
  ): Promise<string> {
    const requested = String(phoneNumberId || "").trim();
    if (!requested) {
      fail("invalid_payload", "Selecione um número Ativo e disponível do portfólio.");
    }
    const assets = await this.portfolios.listPortfolioAssets(auth, { connectionId });
    const numbers = [
      ...(assets.numbers || []),
      ...((assets.portfolios || []).flatMap((item) => item.numbers || [])),
    ];
    const match = numbers.find((item) => String(item.phoneNumberId || "").trim() === requested);
    if (!match) fail("invalid_payload", "Este número não pertence ao portfólio selecionado.");
    if (String(match.uiStatus || "") !== "ativo") {
      fail("phone_not_registered", "O disparo Cloud só sai de um número Ativo.");
    }
    if (String(match.dispatchStatus || "") === "em_disparo") {
      fail(
        "invalid_payload",
        "Este número está ocupado em outro disparo. Ele volta a ficar disponível depois que a campanha for finalizada e o relatório for gerado.",
      );
    }
    return requested;
  }

  private async resolveHeaderMedia(input: {
    tenantId: string;
    token: string;
    phoneNumberId: string;
    templateId: string;
    components: unknown;
    inspect: MetaBroadcastTemplateInspect;
  }): Promise<{ mediaId?: string; link?: string } | null> {
    const kind = headerMediaType(input.inspect.headerFormat);
    if (!kind) return null;
    const httpsUrl = headerHttpsUrlFromComponents(input.components);
    if (httpsUrl) return { link: httpsUrl };
    const handle = headerHandleFromComponents(input.components);
    const preview = handle ? readTemplateHeaderPreview(input.tenantId, handle) : null;
    if (!preview) {
      fail(
        "template_media_required",
        "Este template exige mídia de cabeçalho no envio. Sincronize o template ou reenvie a mídia.",
      );
    }
    const mediaId = await uploadCloudApiMedia({
      token: input.token,
      phoneNumberId: input.phoneNumberId,
      bytes: preview.bytes,
      mime: mimeFromHeader(input.inspect.headerFormat, preview.mime),
      fileName: `header.${preview.mime.includes("png") ? "png" : preview.mime.includes("mp4") ? "mp4" : preview.mime.includes("pdf") ? "pdf" : "jpg"}`,
    });
    if (!mediaId) {
      fail("template_upload_failed", "A Meta recusou a mídia do cabeçalho para o disparo.");
    }
    return { mediaId };
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
    if (kind && input.header) {
      const media = input.header.mediaId
        ? { id: input.header.mediaId }
        : input.header.link
          ? { link: input.header.link }
          : null;
      if (media) {
        components.push({
          type: "header",
          parameters: [{ type: kind, [kind]: media }],
        });
      }
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
      buffer: Buffer;
      fileName: string;
      mapping: MetaBroadcastLeadMapping;
      intakeCampaignId?: string;
      publicBaseHints?: WabaPublicBaseRequestHints;
    },
  ) {
    const tenant = requireTenant(auth);
    const connectionId = String(input.connectionId || "").trim();
    const loaded = await this.loadApprovedTemplate(tenant.tenantId, connectionId, String(input.templateId || "").trim());
    const phoneNumberId = await this.requireActivePhone(auth, loaded.connection.id, String(input.phoneNumberId || ""));
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
    let token = "";
    try {
      token = this.decrypt(loaded.connection.accessTokenEncrypted);
    } catch {
      throw new MetaWhatsappError("invalid_token");
    }
    const campaignId = randomUUID();
    const intakeCampaignId = this.linkSubscriberCampaign(auth, String(input.intakeCampaignId || "").trim());
    const header = await this.resolveHeaderMedia({
      tenantId: tenant.tenantId,
      token,
      phoneNumberId,
      templateId: loaded.template.id,
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
    const campaign: MetaBroadcastCampaign = {
      id: campaignId,
      tenantId: tenant.tenantId,
      connectionId: loaded.connection.id,
      templateId: loaded.template.id,
      templateName: loaded.template.name,
      language: loaded.template.language,
      phoneNumberId,
      intakeCampaignId,
      shortSlug: short.shortSlug,
      shortUrl: short.shortUrl,
      trackedSlug: short.trackedSlug,
      clicksAtStart: short.clicksAtStart,
      clicks: 0,
      status: "queued",
      total: preview.parsed.leads.length,
      sent: 0,
      failed: 0,
      skipped: preview.parsed.invalid.length,
      createdAt: now,
      updatedAt: now,
      leads: preview.parsed.leads,
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
      templateName: loaded.template.name,
      language: loaded.template.language,
      phoneNumberId,
      inspect: loaded.inspect,
      header,
      buttonSlug: loaded.inspect.urlButton?.hasVariable ? short.shortSlug : undefined,
    });
    return publicBroadcastCampaign(campaign);
  }

  private async runCampaign(
    campaignId: string,
    tenantId: string,
    ctx: {
      connectionId: string;
      templateName: string;
      language: string;
      phoneNumberId: string;
      inspect: MetaBroadcastTemplateInspect;
      header?: { mediaId?: string; link?: string } | null;
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
    saveBroadcastCampaign(row);
    try {
      for (let index = 0; index < row.leads.length; index += 1) {
        const lead = row.leads[index];
        if (lead.status === "sent") continue;
        try {
          const sent = await this.provider.sendTemplate({
            tenantId,
            to: lead.waId,
            templateName: ctx.templateName,
            language: ctx.language,
            connectionId: ctx.connectionId,
            phoneNumberId: ctx.phoneNumberId,
            components: this.buildComponents({
              inspect: ctx.inspect,
              lead,
              header: ctx.header,
              buttonSlug: ctx.buttonSlug,
            }),
          });
          lead.status = "sent";
          lead.metaStatus = "accepted";
          lead.wamid = sent.messageId || lead.wamid;
          row.sent += 1;
        } catch (error) {
          lead.status = "failed";
          lead.metaStatus = "failed";
          lead.error = error instanceof Error ? error.message.slice(0, 180) : "send_failed";
          row.failed += 1;
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
    return listBroadcastCampaigns(tenant.tenantId, 8).map(publicBroadcastCampaign);
  }

  getFromAuth(auth: WabaRequestAuth, id: string) {
    const tenant = requireTenant(auth);
    const row = findBroadcastCampaign(tenant.tenantId, String(id || "").trim());
    if (!row) fail("template_not_found", "Disparo Cloud não encontrado nesta conta.");
    return publicBroadcastCampaign(row);
  }

  /**
   * Campanhas do assinante ainda abertas e atendidas por quem tem Laboratório.
   * Só essas entram no Disparo Cloud e recebem indicadores/cliques automáticos.
   */
  listLinkableSubscriberCampaigns(auth: WabaRequestAuth) {
    requireTenant(auth);
    const email = String(auth.email || "").trim().toLowerCase();
    const isMaster = auth.role === "master";
    const intakes = new WabaCampaignIntakeRepository();
    return intakes
      .listAll()
      .filter((intake) => {
        const status = normalizeCampaignIntakeStatus(intake.status);
        if (status !== "generated" && status !== "in_progress") return false;
        if (!campaignAttendedByLaboratorioStaff(intake)) return false;
        const existing = findBroadcastByIntakeCampaignId(intake.id);
        if (existing && existing.status !== "failed") return false;
        if (!isMaster) {
          const assigned = String(intake.assignedOperacionalEmail || "").trim().toLowerCase();
          if (assigned && assigned !== email) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 40)
      .map((intake) => ({
        id: intake.id,
        campaignName: intake.campaignName,
        ownerEmail: intake.ownerEmail,
        status: normalizeCampaignIntakeStatus(intake.status),
        plannedSendCount: Math.max(0, Math.round(Number(intake.plannedSendCount || 0))),
        assignedOperacionalEmail: String(intake.assignedOperacionalEmail || "").trim().toLowerCase(),
      }));
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
    const existing = findBroadcastByIntakeCampaignId(intake.id);
    if (existing && existing.status !== "failed") {
      fail("invalid_payload", "Esta campanha já tem um Disparo Cloud em andamento.");
    }
    if (status === "generated") {
      const now = new Date().toISOString();
      intakes.updateById(intake.id, {
        status: "in_progress",
        startedAt: now,
        startedByEmail: String(auth.email || "").trim().toLowerCase(),
        updatedAt: now,
      });
    }
    return intake.id;
  }
}
