"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappBroadcastService = void 0;
const node_crypto_1 = require("node:crypto");
const meta_token_crypto_1 = require("./meta-token-crypto");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_connection_service_1 = require("./meta-whatsapp-connection.service");
const meta_whatsapp_template_repository_1 = require("./meta-whatsapp-template.repository");
const meta_whatsapp_template_types_1 = require("./meta-whatsapp-template.types");
const meta_whatsapp_broadcast_header_1 = require("./meta-whatsapp-broadcast-header");
const meta_whatsapp_template_header_preview_store_1 = require("./meta-whatsapp-template-header-preview.store");
const meta_cloud_provider_1 = require("../whatsapp/meta-cloud-provider");
const meta_whatsapp_broadcast_template_1 = require("./meta-whatsapp-broadcast-template");
const meta_whatsapp_broadcast_leads_1 = require("./meta-whatsapp-broadcast-leads");
const meta_whatsapp_broadcast_media_1 = require("./meta-whatsapp-broadcast-media");
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
const meta_whatsapp_broadcast_report_1 = require("./meta-whatsapp-broadcast-report");
const waba_shortener_service_1 = require("../../shortener/waba-shortener.service");
const waba_shortener_repository_1 = require("../../shortener/waba-shortener.repository");
const meta_whatsapp_template_ai_short_url_1 = require("./meta-whatsapp-template-ai-short-url");
const waba_campaign_intake_repository_1 = require("../../disparos/waba-campaign-intake.repository");
const waba_campaign_intake_status_1 = require("../../disparos/waba-campaign-intake-status");
const waba_campaign_laboratorio_attended_1 = require("../../disparos/waba-campaign-laboratorio-attended");
const waba_subscriber_repository_1 = require("../../subscribers/waba-subscriber.repository");
const meta_whatsapp_broadcast_linkable_1 = require("./meta-whatsapp-broadcast-linkable");
const meta_whatsapp_broadcast_history_1 = require("./meta-whatsapp-broadcast-history");
const meta_whatsapp_template_approved_at_store_1 = require("./meta-whatsapp-template-approved-at.store");
const running = new Set();
function requireTenant(auth) {
    try {
        return (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("unauthenticated");
    }
}
function fail(code, message) {
    const error = new meta_whatsapp_errors_1.MetaWhatsappError(code);
    if (message)
        error.message = message;
    throw error;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function headerMediaType(format) {
    if (format === "IMAGE")
        return "image";
    if (format === "VIDEO")
        return "video";
    if (format === "DOCUMENT")
        return "document";
    return null;
}
function mimeFromHeader(format, stored) {
    const current = String(stored || "").trim().toLowerCase();
    if (current)
        return current;
    if (format === "VIDEO")
        return "video/mp4";
    if (format === "DOCUMENT")
        return "application/pdf";
    return "image/jpeg";
}
class MetaWhatsappBroadcastService {
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), templates = new meta_whatsapp_template_repository_1.MetaWhatsappTemplateRepository(), portfolios = new meta_whatsapp_connection_service_1.MetaWhatsappConnectionService(), provider = new meta_cloud_provider_1.MetaCloudProvider(), decrypt = meta_token_crypto_1.decryptMetaToken, delayMs = 800) {
        this.connections = connections;
        this.templates = templates;
        this.portfolios = portfolios;
        this.provider = provider;
        this.decrypt = decrypt;
        this.delayMs = delayMs;
    }
    async loadApprovedTemplate(tenantId, connectionId, templateId) {
        const connId = String(connectionId || "").trim();
        const tplId = String(templateId || "").trim();
        if (!connId || !tplId) {
            fail("invalid_payload", "Selecione o portfólio e um template aprovado.");
        }
        const connection = await this.connections.findByIdForTenant(tenantId, connId);
        if (!connection ||
            connection.tenantId !== tenantId ||
            (connection.status !== "connected" && connection.status !== "pending_confirmation") ||
            !connection.wabaId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        const template = await this.templates.findByIdForTenant(tenantId, tplId);
        if (!template || template.tenantId !== tenantId || template.connectionId !== connection.id) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_not_found");
        }
        if (!(0, meta_whatsapp_template_types_1.isTemplateApprovedForSend)(template.status)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_not_ready");
        }
        return { connection, template, inspect: (0, meta_whatsapp_broadcast_template_1.inspectMetaBroadcastTemplate)(template.components) };
    }
    async inspectFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const loaded = await this.loadApprovedTemplate(tenant.tenantId, String(input.connectionId || "").trim(), String(input.templateId || "").trim());
        return {
            inspect: loaded.inspect,
            templateId: loaded.template.id,
            templateName: loaded.template.name,
            language: loaded.template.language,
            connectionId: loaded.connection.id,
            mapping: (0, meta_whatsapp_broadcast_template_1.resolveBroadcastColumnMapping)(loaded.inspect.bodyVariables),
        };
    }
    previewFromBuffer(input) {
        const sheet = (0, meta_whatsapp_broadcast_leads_1.readMetaBroadcastSheet)(input.buffer, input.fileName);
        const phoneColumn = String(input.mapping.phoneColumn || (0, meta_whatsapp_broadcast_leads_1.guessMetaBroadcastPhoneColumn)(sheet.columns)).trim();
        const parsed = (0, meta_whatsapp_broadcast_leads_1.parseMetaBroadcastLeads)({
            sheet,
            mapping: {
                phoneColumn,
                nomeColumn: input.mapping.nomeColumn || (0, meta_whatsapp_broadcast_leads_1.guessMetaBroadcastNomeColumn)(sheet.columns),
                numeroColumn: input.mapping.numeroColumn || (0, meta_whatsapp_broadcast_leads_1.guessMetaBroadcastNumeroColumn)(sheet.columns, phoneColumn),
                textoColumn: input.mapping.textoColumn,
            },
            bodyVariables: input.inspect?.bodyVariables,
        });
        return {
            columns: sheet.columns,
            phoneColumn,
            nomeColumn: String(input.mapping.nomeColumn || (0, meta_whatsapp_broadcast_leads_1.guessMetaBroadcastNomeColumn)(sheet.columns) || "").trim(),
            numeroColumn: String(input.mapping.numeroColumn || (0, meta_whatsapp_broadcast_leads_1.guessMetaBroadcastNumeroColumn)(sheet.columns, phoneColumn) || "").trim(),
            valid: parsed.leads.length,
            invalid: parsed.invalid.length,
            duplicatesRemoved: parsed.duplicatesRemoved,
            truncated: parsed.truncated,
            samples: parsed.samples,
            parsed,
        };
    }
    async previewFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const loaded = await this.loadApprovedTemplate(tenant.tenantId, String(input.connectionId || "").trim(), String(input.templateId || "").trim());
        const preview = this.previewFromBuffer({
            buffer: input.buffer,
            fileName: input.fileName,
            mapping: input.mapping,
            inspect: loaded.inspect,
        });
        return {
            inspect: loaded.inspect,
            mapping: (0, meta_whatsapp_broadcast_template_1.resolveBroadcastColumnMapping)(loaded.inspect.bodyVariables),
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
    async requireActivePhone(auth, connectionId, phoneNumberId) {
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
        if (!match)
            fail("invalid_payload", "Este número não pertence ao portfólio selecionado.");
        if (String(match.uiStatus || "") !== "ativo") {
            fail("phone_not_registered", "O disparo Cloud só sai de um número Ativo.");
        }
        if (String(match.dispatchStatus || "") === "em_disparo") {
            fail("invalid_payload", "Este número está ocupado em outro disparo. Ele volta a ficar disponível depois que a campanha for finalizada e o relatório for gerado.");
        }
        return requested;
    }
    async resolveHeaderMedia(input) {
        const kind = headerMediaType(input.inspect.headerFormat);
        if (!kind)
            return null;
        const handle = (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(input.components);
        const httpsUrl = (0, meta_whatsapp_template_header_preview_store_1.headerHttpsUrlFromComponents)(input.components);
        const preview = (0, meta_whatsapp_template_header_preview_store_1.readTemplateHeaderPreviewForSend)({
            tenantId: input.tenantId,
            handle,
            templateId: input.templateId,
        });
        const plan = (0, meta_whatsapp_broadcast_header_1.classifyBroadcastHeaderMedia)({
            hasLocalPreview: Boolean(preview),
            httpsUrl,
        });
        if (plan === "upload" && preview) {
            const mime = mimeFromHeader(input.inspect.headerFormat, preview.mime);
            const mediaId = await (0, meta_whatsapp_broadcast_media_1.uploadCloudApiMedia)({
                token: input.token,
                phoneNumberId: input.phoneNumberId,
                bytes: preview.bytes,
                mime,
                fileName: (0, meta_whatsapp_broadcast_header_1.headerUploadFileName)(mime),
            });
            if (!mediaId) {
                fail("template_upload_failed", "A Meta recusou a mídia do cabeçalho para o disparo.");
            }
            return { mediaId };
        }
        if (plan === "weblink" && httpsUrl) {
            return { link: httpsUrl };
        }
        if (plan === "refuse-weblink") {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast_header_refuse_weblink", {
                templateId: input.templateId,
            });
            fail("template_media_required", meta_whatsapp_broadcast_header_1.BROADCAST_HEADER_WEBLINK_ERROR);
        }
        fail("template_media_required", "Este template exige mídia de cabeçalho no envio. Sincronize o template ou reenvie a mídia.");
    }
    async createCampaignShortLink(input) {
        const button = input.inspect.urlButton;
        const existingSlug = button?.slug || "";
        const existing = existingSlug ? await (0, waba_shortener_repository_1.findShortLinkBySlug)(existingSlug) : null;
        const destination = existing?.longUrl ||
            (button?.url && /^https?:\/\//i.test(button.url.replace(/\{\{\d+\}\}/g, "x"))
                ? button.url.replace(/\{\{\d+\}\}/g, input.campaignId.slice(0, 8))
                : "https://wabadisparos.com.br/");
        const shortUrl = await (0, meta_whatsapp_template_ai_short_url_1.createMetaTemplateButtonShortUrl)({
            destinationUrl: destination,
            tenantId: input.tenantId,
            publicBaseHints: input.publicBaseHints,
        });
        const shortSlug = (0, waba_shortener_repository_1.extractSlugFromPublicShortUrl)(shortUrl) || "";
        if (shortSlug) {
            await (0, waba_shortener_service_1.attachCampaignIdToShortLink)(shortSlug, input.campaignId);
        }
        let trackedSlug = shortSlug;
        let clicksAtStart = 0;
        if (existingSlug && !button?.hasVariable) {
            await (0, waba_shortener_service_1.attachCampaignIdToShortLink)(existingSlug, input.campaignId);
            trackedSlug = existingSlug;
            clicksAtStart = Math.max(0, Number(existing?.clicks || 0));
        }
        return { shortUrl, shortSlug, trackedSlug, clicksAtStart };
    }
    buildComponents(input) {
        const components = [];
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
                    text: item.key === "nome"
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
    async startFromAuth(auth, input) {
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
            fail("invalid_recipient", "Nenhum número válido após a normatização Meta (E.164 com DDI). Confira a coluna de telefone.");
        }
        let token = "";
        try {
            token = this.decrypt(loaded.connection.accessTokenEncrypted);
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        const campaignId = (0, node_crypto_1.randomUUID)();
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
        const templateApprovedAt = (0, meta_whatsapp_template_approved_at_store_1.lookupTemplateApprovedAt)({
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
        const campaign = {
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
            ...(templateApprovedAt ? { templateApprovedAt } : {}),
            leads: preview.parsed.leads,
        };
        (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(campaign);
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-queued", {
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
        return (0, meta_whatsapp_broadcast_store_1.publicBroadcastCampaign)(campaign);
    }
    async runCampaign(campaignId, tenantId, ctx) {
        if (running.has(campaignId))
            return;
        running.add(campaignId);
        const row = (0, meta_whatsapp_broadcast_store_1.findBroadcastCampaign)(tenantId, campaignId);
        if (!row) {
            running.delete(campaignId);
            return;
        }
        row.status = "running";
        if (!row.sendStartedAt)
            row.sendStartedAt = new Date().toISOString();
        (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(row);
        try {
            for (let index = 0; index < row.leads.length; index += 1) {
                const lead = row.leads[index];
                if (lead.status === "sent")
                    continue;
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
                    (0, meta_whatsapp_broadcast_store_1.appendBroadcastLeadStatusLog)(lead, {
                        status: "accepted",
                        at: new Date().toISOString(),
                    });
                    row.sent += 1;
                }
                catch (error) {
                    const graphCode = String(error?.graphCode || "").trim();
                    lead.status = "failed";
                    lead.metaStatus = "failed";
                    if (graphCode)
                        lead.errorCode = graphCode;
                    lead.error = error instanceof Error ? error.message.slice(0, 180) : "send_failed";
                    (0, meta_whatsapp_broadcast_store_1.appendBroadcastLeadStatusLog)(lead, {
                        status: "failed",
                        at: new Date().toISOString(),
                        ...(graphCode ? { errorCode: graphCode } : {}),
                    });
                    row.failed += 1;
                }
                (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(row);
                if (index < row.leads.length - 1 && this.delayMs > 0) {
                    const jitter = Math.floor(Math.random() * 200);
                    await sleep(this.delayMs + jitter);
                }
            }
            row.status = row.failed === row.total ? "failed" : "done";
            row.sendFinishedAt = new Date().toISOString();
            (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(row);
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-done", {
                tenantId,
                sent: row.sent,
                failed: row.failed,
                total: row.total,
            });
            if (row.intakeCampaignId)
                (0, meta_whatsapp_broadcast_report_1.scheduleLabReportFinalize)(row.intakeCampaignId);
        }
        catch {
            row.status = "failed";
            row.sendFinishedAt = new Date().toISOString();
            (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(row);
            if (row.intakeCampaignId)
                (0, meta_whatsapp_broadcast_report_1.scheduleLabReportFinalize)(row.intakeCampaignId);
        }
        finally {
            running.delete(campaignId);
        }
    }
    listFromAuth(auth) {
        const tenant = requireTenant(auth);
        const intakes = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
        const subscribers = new waba_subscriber_repository_1.WabaSubscriberRepository();
        return (0, meta_whatsapp_broadcast_store_1.listBroadcastCampaigns)(tenant.tenantId, 40).map((row) => {
            const intake = row.intakeCampaignId ? intakes.getById(row.intakeCampaignId) : null;
            const ownerEmail = String(intake?.ownerEmail || "").trim().toLowerCase();
            const clientName = String(subscribers.getByEmail(ownerEmail)?.fullName || ownerEmail).trim();
            return (0, meta_whatsapp_broadcast_history_1.toCloudBroadcastHistoryItem)({
                campaign: row,
                campaignName: intake?.campaignName,
                clientName,
                plannedSendCount: intake?.plannedSendCount ?? row.total,
                intakeStatus: intake?.status,
            });
        });
    }
    getFromAuth(auth, id) {
        const tenant = requireTenant(auth);
        const row = (0, meta_whatsapp_broadcast_store_1.findBroadcastCampaign)(tenant.tenantId, String(id || "").trim());
        if (!row)
            fail("template_not_found", "Disparo Cloud não encontrado nesta conta.");
        return (0, meta_whatsapp_broadcast_store_1.publicBroadcastCampaign)(row);
    }
    /**
     * Campanhas do assinante Em andamento e atendidas por quem tem Laboratório.
     * Só essas entram no Disparo Cloud e recebem indicadores/cliques automáticos.
     */
    listLinkableSubscriberCampaigns(auth) {
        requireTenant(auth);
        const email = String(auth.email || "").trim().toLowerCase();
        const isMaster = auth.role === "master";
        const intakes = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
        const subscribers = new waba_subscriber_repository_1.WabaSubscriberRepository();
        return intakes
            .listAll()
            .filter((intake) => {
            if (!(0, meta_whatsapp_broadcast_linkable_1.isLinkableLabCampaignStatus)(intake.status))
                return false;
            if (!(0, waba_campaign_laboratorio_attended_1.campaignAttendedByLaboratorioStaff)(intake))
                return false;
            const existing = (0, meta_whatsapp_broadcast_store_1.findBroadcastByIntakeCampaignId)(intake.id);
            if (existing && existing.status !== "failed")
                return false;
            if (!isMaster) {
                const assigned = String(intake.assignedOperacionalEmail || "").trim().toLowerCase();
                if (assigned && assigned !== email)
                    return false;
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
                status: (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(intake.status),
                plannedSendCount,
                assignedOperacionalEmail: String(intake.assignedOperacionalEmail || "").trim().toLowerCase(),
                label: (0, meta_whatsapp_broadcast_linkable_1.formatCloudLinkableCampaignLabel)({
                    subscriberName,
                    ownerEmail,
                    campaignName: intake.campaignName,
                    plannedSendCount,
                }),
            };
        });
    }
    linkSubscriberCampaign(auth, intakeId) {
        const id = String(intakeId || "").trim();
        if (!id)
            return undefined;
        const intakes = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
        const intake = intakes.getById(id);
        if (!intake) {
            fail("invalid_payload", "Campanha do assinante não encontrada.");
        }
        if (!(0, waba_campaign_laboratorio_attended_1.campaignAttendedByLaboratorioStaff)(intake)) {
            fail("invalid_payload", "Só é possível vincular campanhas atendidas por quem tem acesso ao Laboratório.");
        }
        const status = (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(intake.status);
        if (status === "completed" || status === "error_reported" || status === "cancelled") {
            fail("invalid_payload", "Esta campanha do assinante já foi encerrada.");
        }
        if (!(0, meta_whatsapp_broadcast_linkable_1.isLinkableLabCampaignStatus)(status)) {
            fail("invalid_payload", "Só é possível vincular campanhas Em andamento.");
        }
        const existing = (0, meta_whatsapp_broadcast_store_1.findBroadcastByIntakeCampaignId)(intake.id);
        if (existing && existing.status !== "failed") {
            fail("invalid_payload", "Esta campanha já tem um Disparo Cloud em andamento.");
        }
        return intake.id;
    }
}
exports.MetaWhatsappBroadcastService = MetaWhatsappBroadcastService;
