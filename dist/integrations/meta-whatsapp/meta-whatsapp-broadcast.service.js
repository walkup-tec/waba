"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappBroadcastService = void 0;
exports.isCloudBroadcastSendLoopAlive = isCloudBroadcastSendLoopAlive;
exports.getCloudBroadcastProtectSnapshot = getCloudBroadcastProtectSnapshot;
exports.ensureResumeOrphanedCloudBroadcasts = ensureResumeOrphanedCloudBroadcasts;
const node_crypto_1 = require("node:crypto");
const meta_token_crypto_1 = require("./meta-token-crypto");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_connection_service_1 = require("./meta-whatsapp-connection.service");
const meta_whatsapp_template_repository_1 = require("./meta-whatsapp-template.repository");
const meta_whatsapp_template_types_1 = require("./meta-whatsapp-template.types");
const meta_whatsapp_template_graph_client_1 = require("./meta-whatsapp-template-graph.client");
const meta_whatsapp_broadcast_graph_template_1 = require("./meta-whatsapp-broadcast-graph-template");
const meta_whatsapp_broadcast_header_1 = require("./meta-whatsapp-broadcast-header");
const meta_whatsapp_template_header_preview_store_1 = require("./meta-whatsapp-template-header-preview.store");
const meta_cloud_provider_1 = require("../whatsapp/meta-cloud-provider");
const meta_whatsapp_broadcast_template_1 = require("./meta-whatsapp-broadcast-template");
const meta_whatsapp_broadcast_leads_1 = require("./meta-whatsapp-broadcast-leads");
const meta_whatsapp_broadcast_media_1 = require("./meta-whatsapp-broadcast-media");
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
const meta_whatsapp_broadcast_split_1 = require("./meta-whatsapp-broadcast-split");
const meta_whatsapp_broadcast_phones_1 = require("./meta-whatsapp-broadcast-phones");
const meta_whatsapp_broadcast_protect_1 = require("./meta-whatsapp-broadcast-protect");
const meta_whatsapp_broadcast_void_1 = require("./meta-whatsapp-broadcast-void");
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
let resumeWatchdogTimer = null;
function isCloudBroadcastSendLoopAlive(campaignId) {
    return running.has(String(campaignId || "").trim());
}
function getCloudBroadcastProtectSnapshot() {
    return (0, meta_whatsapp_broadcast_protect_1.buildCloudBroadcastProtectSnapshot)({
        campaigns: (0, meta_whatsapp_broadcast_store_1.listActiveCloudBroadcasts)(),
        isLoopAlive: isCloudBroadcastSendLoopAlive,
        watchdogMs: meta_whatsapp_broadcast_protect_1.CLOUD_BROADCAST_RESUME_WATCHDOG_MS,
    });
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
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
        const live = await this.overlayApprovedTemplateFromGraph({ accessTokenEncrypted: connection.accessTokenEncrypted, wabaId: String(connection.wabaId) }, template);
        return { connection, template: live, inspect: (0, meta_whatsapp_broadcast_template_1.inspectMetaBroadcastTemplate)(live.components) };
    }
    /** Laboratório local pode mostrar Aprovado; o POST usa o que a Graph tem nesta WABA. */
    async overlayApprovedTemplateFromGraph(connection, template) {
        let token = "";
        try {
            token = this.decrypt(connection.accessTokenEncrypted);
        }
        catch {
            return template;
        }
        const listed = await (0, meta_whatsapp_template_graph_client_1.findWabaMessageTemplatesByName)({
            token,
            wabaId: connection.wabaId,
            name: template.name,
        });
        if (!listed.ok)
            return template;
        const wantName = String(template.name || "").trim().toLowerCase();
        const named = listed.items.filter((row) => row && String(row.name || "").trim().toLowerCase() === wantName);
        if (!named.length)
            return template;
        const picked = (0, meta_whatsapp_broadcast_graph_template_1.pickApprovedGraphTemplate)(listed.items, template.name, template.language);
        if (!picked) {
            const seen = named.map((row) => `${row.language}:${row.status || "?"}`).slice(0, 6);
            fail("template_not_ready", `A Graph não tem ${template.name} (${template.language}) APPROVED nesta WABA (${seen.join(", ")}).`);
        }
        return {
            ...template,
            language: picked.language,
            status: picked.status || template.status,
            components: picked.components ?? template.components,
            metaTemplateId: picked.metaTemplateId || template.metaTemplateId,
        };
    }
    async inspectFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const loaded = await this.loadApprovedTemplate(tenant.tenantId, String(input.connectionId || "").trim(), String(input.templateId || "").trim());
        const headerKind = headerMediaType(loaded.inspect.headerFormat);
        const preview = headerKind
            ? (0, meta_whatsapp_template_header_preview_store_1.readTemplateHeaderPreviewForSend)({
                tenantId: tenant.tenantId,
                handle: (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(loaded.template.components),
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
            mapping: (0, meta_whatsapp_broadcast_template_1.resolveBroadcastColumnMapping)(loaded.inspect.bodyVariables),
            headerReady: !headerKind || Boolean(preview),
            headerNeedsFile: Boolean(headerKind) && !preview,
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
    async requireActivePhoneBindings(auth, phoneNumberIds) {
        const requested = (0, meta_whatsapp_broadcast_split_1.normalizeBroadcastPhoneNumberIds)(phoneNumberIds);
        if (!requested.length) {
            fail("invalid_payload", "Selecione ao menos um número Ativo e disponível.");
        }
        const assets = await this.portfolios.listPortfolioAssets(auth);
        const catalog = (0, meta_whatsapp_broadcast_phones_1.indexBroadcastPortfolioPhones)(assets.portfolios || []);
        try {
            return {
                bindings: (0, meta_whatsapp_broadcast_phones_1.resolveBroadcastPhoneBindings)(requested, catalog),
                portfolios: assets.portfolios || [],
            };
        }
        catch (error) {
            const reason = error instanceof meta_whatsapp_broadcast_phones_1.BroadcastPhoneSelectionError ? error.reason : "unknown";
            const message = error instanceof Error ? error.message : "Não foi possível validar os números selecionados.";
            if (reason === "inactive")
                fail("phone_not_registered", message);
            fail("invalid_payload", message);
        }
    }
    async assertTemplateOnPhoneBindings(input) {
        const seen = new Set();
        for (const binding of input.bindings) {
            const connectionId = String(binding.connectionId || "").trim();
            if (!connectionId || seen.has(connectionId))
                continue;
            seen.add(connectionId);
            if (!(0, meta_whatsapp_broadcast_phones_1.connectionNeedsLocalTemplate)({
                connectionId,
                wabaId: binding.wabaId,
                templateConnectionId: input.templateConnectionId,
                templateWabaId: input.templateWabaId,
            })) {
                continue;
            }
            const other = await this.templates.findForSend(input.tenantId, connectionId, input.templateName, input.templateLanguage);
            if (!other || !(0, meta_whatsapp_template_types_1.isTemplateApprovedForSend)(other.status)) {
                fail("invalid_payload", (0, meta_whatsapp_broadcast_phones_1.templateMissingOnPortfolioMessage)({
                    templateName: input.templateName,
                    portfolioName: binding.portfolioName,
                }));
            }
        }
    }
    async resolveHeaderMedia(input) {
        const kind = headerMediaType(input.inspect.headerFormat);
        if (!kind)
            return null;
        const handle = (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(input.components);
        const preview = (0, meta_whatsapp_template_header_preview_store_1.readTemplateHeaderPreviewForSend)({
            tenantId: input.tenantId,
            handle,
            templateId: input.templateId,
            metaTemplateId: input.metaTemplateId,
            name: input.templateName,
            language: input.language,
        });
        const plan = (0, meta_whatsapp_broadcast_header_1.classifyBroadcastHeaderMedia)({
            hasLocalPreview: Boolean(preview),
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
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast_header_missing_file", {
            templateId: input.templateId,
        });
        fail("template_media_required", meta_whatsapp_broadcast_header_1.BROADCAST_HEADER_MISSING_FILE_ERROR);
    }
    async resolveHeaderMediaForBindings(input) {
        const out = {};
        const tokenByConnection = new Map();
        for (const binding of input.bindings) {
            const connectionId = String(binding.connectionId || "").trim();
            const phoneNumberId = String(binding.phoneNumberId || "").trim();
            if (!connectionId || !phoneNumberId)
                continue;
            let token = tokenByConnection.get(connectionId);
            if (!token) {
                const connection = await this.connections.findByIdForTenant(input.tenantId, connectionId);
                if (!connection)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
                try {
                    token = this.decrypt(connection.accessTokenEncrypted);
                }
                catch {
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
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
        const { bindings: phoneBindings, portfolios: selectedPortfolios } = await this.requireActivePhoneBindings(auth, (0, meta_whatsapp_broadcast_split_1.normalizeBroadcastPhoneNumberIds)(input.phoneNumberIds?.length ? input.phoneNumberIds : [String(input.phoneNumberId || "")]));
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
            fail("invalid_recipient", "Nenhum número válido após a normatização Meta (E.164 com DDI). Confira a coluna de telefone.");
        }
        let phoneQuotas;
        let assignedLeads;
        try {
            phoneQuotas = (0, meta_whatsapp_broadcast_split_1.resolveBroadcastLeadQuotas)(phoneNumberIds, preview.parsed.leads.length, input.phoneQuotas);
            (0, meta_whatsapp_broadcast_split_1.assertBroadcastQuotasWithinPortfolioDailyCaps)(phoneQuotas, phoneBindings, selectedPortfolios);
            assignedLeads = (0, meta_whatsapp_broadcast_phones_1.attachBroadcastLeadPhoneBindings)((0, meta_whatsapp_broadcast_split_1.assignBroadcastLeadsToPhones)(preview.parsed.leads, phoneNumberIds, meta_whatsapp_broadcast_split_1.META_BROADCAST_MAX_SENDS_PER_NUMBER, input.phoneQuotas), phoneBindings);
        }
        catch (error) {
            fail("invalid_payload", error instanceof Error
                ? error.message
                : `Não foi possível fracionar os envios (máx. ${meta_whatsapp_broadcast_split_1.META_BROADCAST_MAX_SENDS_PER_NUMBER} por número).`);
        }
        const sendingPhoneIds = new Set(phoneQuotas.map((row) => row.phoneNumberId));
        const sendingBindings = phoneBindings.filter((row) => sendingPhoneIds.has(row.phoneNumberId));
        const sendingPhoneNumberIds = sendingBindings.map((row) => row.phoneNumberId);
        const sendingPhoneNumberId = sendingPhoneNumberIds[0] || phoneNumberId;
        const campaignId = (0, node_crypto_1.randomUUID)();
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
        (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(campaign);
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-queued", {
            tenantId: tenant.tenantId,
            total: campaign.total,
            skippedInvalid: campaign.skipped,
            duplicatesRemoved: preview.parsed.duplicatesRemoved,
        });
        void this.runCampaign(campaign.id, tenant.tenantId, {
            connectionId: loaded.connection.id,
            connectionByPhone: (0, meta_whatsapp_broadcast_phones_1.connectionIdByPhoneNumber)(sendingBindings),
            templateName: loaded.template.name,
            language: loaded.template.language,
            phoneNumberId: sendingPhoneNumberId,
            phoneNumberIds: sendingPhoneNumberIds,
            inspect: loaded.inspect,
            headerByPhone,
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
        let consecutiveTemplateMissing = 0;
        try {
            for (let index = 0; index < row.leads.length; index += 1) {
                const live = (0, meta_whatsapp_broadcast_store_1.findBroadcastCampaign)(tenantId, campaignId);
                if (!live) {
                    row.status = "failed";
                    row.sendFinishedAt = new Date().toISOString();
                    (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(row);
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-aborted", {
                        tenantId,
                        campaignId,
                        sent: row.sent,
                        reason: "missing",
                    });
                    return;
                }
                if ((0, meta_whatsapp_broadcast_void_1.isBroadcastVoided)(live)) {
                    row.status = "failed";
                    row.voidedAt = live.voidedAt;
                    row.sendFinishedAt = new Date().toISOString();
                    (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(row);
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-aborted", {
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
                    (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(row);
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-aborted", {
                        tenantId,
                        campaignId,
                        sent: row.sent,
                        reason: "paused_or_failed",
                    });
                    return;
                }
                const lead = row.leads[index];
                if (lead.status === "sent" || lead.status === "failed" || lead.status === "skipped")
                    continue;
                try {
                    const leadPhoneNumberId = String(lead.phoneNumberId || ctx.phoneNumberId || "").trim();
                    const leadConnectionId = String(lead.connectionId ||
                        (leadPhoneNumberId && ctx.connectionByPhone
                            ? ctx.connectionByPhone[leadPhoneNumberId]
                            : "") ||
                        ctx.connectionId ||
                        "").trim();
                    const header = (leadPhoneNumberId && ctx.headerByPhone
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
                    if (graphCode === meta_whatsapp_broadcast_graph_template_1.GRAPH_TEMPLATE_MISSING_CODE) {
                        consecutiveTemplateMissing += 1;
                    }
                    else {
                        consecutiveTemplateMissing = 0;
                    }
                    if ((0, meta_whatsapp_broadcast_graph_template_1.shouldAbortBroadcastOnRepeatedTemplateMissing)(graphCode, consecutiveTemplateMissing)) {
                        row.status = "failed";
                        row.sendFinishedAt = new Date().toISOString();
                        (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(row);
                        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-aborted", {
                            tenantId,
                            campaignId,
                            sent: row.sent,
                            reason: "template_missing_132001",
                        });
                        return;
                    }
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
            if (existing && existing.status !== "failed" && !(0, meta_whatsapp_broadcast_void_1.isCloudBroadcastInactiveForRetry)(existing)) {
                return false;
            }
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
    /**
     * Após Redeploy/restart: retoma disparos `running`/`queued` com leads pendentes.
     * Não usa checagem de ocupação do número — o próprio lote é quem ocupa o telefone.
     */
    async resumeOrphanedCampaign(row) {
        const campaignId = String(row.id || "").trim();
        const tenantId = String(row.tenantId || "").trim();
        if (!campaignId || !tenantId)
            return false;
        if (running.has(campaignId))
            return false;
        if ((0, meta_whatsapp_broadcast_void_1.isBroadcastVoided)(row))
            return false;
        try {
            const loaded = await this.loadApprovedTemplate(tenantId, row.connectionId, row.templateId);
            const phoneNumberIds = (0, meta_whatsapp_broadcast_split_1.normalizeBroadcastPhoneNumberIds)(row.phoneNumberIds?.length ? row.phoneNumberIds : [row.phoneNumberId]);
            const phoneBindings = (0, meta_whatsapp_broadcast_phones_1.bindingsFromCampaignPhones)({
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
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-resume", {
                campaignId,
                tenantId,
                pending: (row.leads || []).filter((lead) => !lead.status || lead.status === "queued").length,
                sent: row.sent,
                total: row.total,
                phoneCount: phoneNumberIds.length,
            });
            void this.runCampaign(campaignId, tenantId, {
                connectionId: loaded.connection.id,
                connectionByPhone: (0, meta_whatsapp_broadcast_phones_1.connectionIdByPhoneNumber)(phoneBindings),
                templateName: loaded.template.name,
                language: loaded.template.language,
                phoneNumberId: phoneNumberIds[0] || row.phoneNumberId,
                phoneNumberIds,
                inspect: loaded.inspect,
                headerByPhone,
                buttonSlug: loaded.inspect.urlButton?.hasVariable ? row.shortSlug : undefined,
            });
            return true;
        }
        catch (error) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-resume-failed", {
                campaignId,
                reason: error instanceof Error ? error.message.slice(0, 120) : "resume_failed",
            });
            return false;
        }
    }
    async resumeOrphanedCloudBroadcastsOnBoot() {
        const reopened = (0, meta_whatsapp_broadcast_store_1.reopenOptInPtxBroadcastToContinue)();
        if (reopened) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-reopen-opt-in-ptx", {
                campaignId: reopened.id,
                status: reopened.status,
                sent: reopened.sent,
                failed: reopened.failed,
                pending: (reopened.leads || []).filter((lead) => !lead.status || lead.status === "queued").length,
                total: reopened.total,
            });
        }
        let closed = 0;
        for (const stale of (0, meta_whatsapp_broadcast_store_1.listStaleRunningBroadcastsWithoutPending)()) {
            const done = (0, meta_whatsapp_broadcast_store_1.finalizeStaleRunningBroadcast)(stale.id);
            if (done) {
                closed += 1;
                if (done.intakeCampaignId)
                    (0, meta_whatsapp_broadcast_report_1.scheduleLabReportFinalize)(done.intakeCampaignId);
            }
        }
        let resumed = 0;
        for (const row of (0, meta_whatsapp_broadcast_store_1.listResumableOrphanedBroadcasts)()) {
            if (await this.resumeOrphanedCampaign(row))
                resumed += 1;
        }
        if (closed || resumed) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-boot-resume", { closed, resumed });
        }
        return resumed;
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
        if (existing && existing.status !== "failed" && !(0, meta_whatsapp_broadcast_void_1.isCloudBroadcastInactiveForRetry)(existing)) {
            fail("invalid_payload", "Esta campanha já tem um Disparo Cloud em andamento.");
        }
        if (existing && (0, meta_whatsapp_broadcast_void_1.isCloudBroadcastInactiveForRetry)(existing)) {
            (0, meta_whatsapp_broadcast_store_1.voidBroadcastCampaignForRetry)(existing.id);
        }
        return intake.id;
    }
}
exports.MetaWhatsappBroadcastService = MetaWhatsappBroadcastService;
/** Boot: retoma lotes órfãos após Redeploy + guardião periódico (fire-and-forget). */
function ensureResumeOrphanedCloudBroadcasts() {
    const service = new MetaWhatsappBroadcastService();
    const runResume = (reason) => {
        void service.resumeOrphanedCloudBroadcastsOnBoot().catch((error) => {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-boot-resume-error", {
                reason: error instanceof Error ? error.message.slice(0, 120) : "boot_resume_failed",
                phase: reason,
            });
        });
    };
    runResume("boot");
    // Nova tentativa após o Graph/token aquecerem (Redeploy costuma matar o loop no meio).
    setTimeout(() => runResume("boot+3s"), 3000).unref?.();
    setTimeout(() => runResume("boot+10s"), 10000).unref?.();
    if (resumeWatchdogTimer)
        return;
    resumeWatchdogTimer = setInterval(() => {
        runResume("watchdog");
    }, meta_whatsapp_broadcast_protect_1.CLOUD_BROADCAST_RESUME_WATCHDOG_MS);
    resumeWatchdogTimer.unref?.();
    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-protect-watchdog-started", {
        intervalMs: meta_whatsapp_broadcast_protect_1.CLOUD_BROADCAST_RESUME_WATCHDOG_MS,
    });
}
