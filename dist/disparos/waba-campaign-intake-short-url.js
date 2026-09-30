"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldCreateIntakeTrackedShortUrl = shouldCreateIntakeTrackedShortUrl;
exports.resolveCampaignCardResponseLink = resolveCampaignCardResponseLink;
exports.isWabaShortAliasUrl = isWabaShortAliasUrl;
exports.stripDisparosTrackingNonce = stripDisparosTrackingNonce;
exports.normalizeClientOriginalResponseLink = normalizeClientOriginalResponseLink;
exports.persistClientOriginalResponseLink = persistClientOriginalResponseLink;
exports.resolveStoredClientOriginalResponseLink = resolveStoredClientOriginalResponseLink;
exports.lookupClientOriginalResponseLink = lookupClientOriginalResponseLink;
exports.resolveOperacionalManualReportShowClicks = resolveOperacionalManualReportShowClicks;
exports.resolveOperacionalManualReportClicks = resolveOperacionalManualReportClicks;
exports.resolveIntakeTrackedShortUrlClicks = resolveIntakeTrackedShortUrlClicks;
exports.createCampaignIntakeTrackedShortUrl = createCampaignIntakeTrackedShortUrl;
const waba_shortener_service_1 = require("../shortener/waba-shortener.service");
const waba_shortener_repository_1 = require("../shortener/waba-shortener.repository");
const meta_whatsapp_errors_1 = require("../integrations/meta-whatsapp/meta-whatsapp-errors");
const meta_whatsapp_template_ai_short_url_1 = require("../integrations/meta-whatsapp/meta-whatsapp-template-ai-short-url");
function shouldCreateIntakeTrackedShortUrl(apiKind) {
    return apiKind === "oficial";
}
function resolveCampaignCardResponseLink(intake) {
    return String(intake.responseShortUrl || intake.responseLink || "").trim();
}
function isWabaShortAliasUrl(raw) {
    const value = String(raw || "").trim();
    if (!value)
        return false;
    try {
        return /\/s\/[a-z0-9][a-z0-9-_]{2,39}/i.test(new URL(value).pathname);
    }
    catch {
        return /\/s\/[a-z0-9][a-z0-9-_]{2,39}/i.test(value);
    }
}
function stripDisparosTrackingNonce(raw) {
    const value = String(raw || "").trim();
    if (!value)
        return "";
    try {
        const parsed = new URL(value);
        if (!parsed.searchParams.has("_n8n_link_nonce") && !parsed.searchParams.has("_n8n_test_nonce")) {
            return value;
        }
        parsed.searchParams.delete("_n8n_link_nonce");
        parsed.searchParams.delete("_n8n_test_nonce");
        return parsed.toString();
    }
    catch {
        return value;
    }
}
function normalizeClientOriginalResponseLink(raw) {
    const stripped = stripDisparosTrackingNonce(raw);
    if (!stripped || isWabaShortAliasUrl(stripped))
        return "";
    return stripped.slice(0, 2000);
}
function persistClientOriginalResponseLink(existing, candidate) {
    const kept = normalizeClientOriginalResponseLink(String(existing || ""));
    if (kept)
        return kept;
    return normalizeClientOriginalResponseLink(String(candidate || ""));
}
function resolveStoredClientOriginalResponseLink(intake) {
    return persistClientOriginalResponseLink(intake.responseLinkOriginal, intake.responseLink);
}
async function lookupClientOriginalResponseLink(intake) {
    const stored = resolveStoredClientOriginalResponseLink(intake);
    if (stored)
        return stored;
    const slug = String(intake.responseShortSlug || "").trim() ||
        (0, waba_shortener_repository_1.extractSlugFromPublicShortUrl)(String(intake.responseShortUrl || "")) ||
        "";
    if (slug) {
        const bySlug = await (0, waba_shortener_repository_1.findShortLinkBySlug)(slug);
        const fromSlug = normalizeClientOriginalResponseLink(bySlug?.longUrl || "");
        if (fromSlug)
            return fromSlug;
    }
    const byCampaign = await (0, waba_shortener_repository_1.findShortLinkByCampaignId)(String(intake.id || ""));
    return normalizeClientOriginalResponseLink(byCampaign?.longUrl || "");
}
function resolveOperacionalManualReportShowClicks(input) {
    return Boolean(input.forceShowClicks) || !input.hideClicks;
}
function resolveOperacionalManualReportClicks(input) {
    if (input.overrideClicks != null) {
        return Math.max(0, Math.round(Number(input.overrideClicks) || 0));
    }
    return Math.max(0, Math.round(Number(input.trackedClicks || 0)));
}
async function resolveIntakeTrackedShortUrlClicks(intake) {
    const slug = String(intake.responseShortSlug || "").trim() ||
        (0, waba_shortener_repository_1.extractSlugFromPublicShortUrl)(String(intake.responseShortUrl || "")) ||
        "";
    if (slug) {
        const record = await (0, waba_shortener_repository_1.findShortLinkBySlug)(slug);
        if (record)
            return Math.max(0, Number(record.clicks || 0));
    }
    return (0, waba_shortener_repository_1.getShortLinkClicksByCampaignId)(String(intake.id || ""));
}
async function createCampaignIntakeTrackedShortUrl(input, deps = {}) {
    const campaignId = String(input.campaignId || "").trim();
    const destinationUrl = String(input.destinationUrl || "").trim();
    if (!campaignId || !destinationUrl) {
        throw Object.assign(new Error("Informe um link de resposta válido (http ou https)."), {
            statusCode: 400,
        });
    }
    const createShortUrl = deps.createShortUrl || meta_whatsapp_template_ai_short_url_1.createMetaTemplateButtonShortUrl;
    const attachCampaign = deps.attachCampaign || waba_shortener_service_1.attachCampaignIdToShortLink;
    const extractSlug = deps.extractSlug || waba_shortener_repository_1.extractSlugFromPublicShortUrl;
    try {
        const shortUrl = await createShortUrl({
            destinationUrl,
            tenantId: String(input.ownerEmail || "").trim() || campaignId,
            publicBaseHints: input.publicBaseHints,
        });
        const shortSlug = extractSlug(shortUrl) || "";
        if (shortSlug) {
            await attachCampaign(shortSlug, campaignId);
        }
        return { shortUrl, shortSlug };
    }
    catch (error) {
        if (error instanceof meta_whatsapp_errors_1.MetaWhatsappError && error.code === "template_url_https") {
            throw Object.assign(new Error("Informe um link de resposta válido (http ou https)."), {
                statusCode: 400,
            });
        }
        throw Object.assign(new Error("Não foi possível gerar a URL de resposta da campanha. Tente novamente."), { statusCode: 502 });
    }
}
