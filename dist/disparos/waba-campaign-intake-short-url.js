"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldCreateIntakeTrackedShortUrl = shouldCreateIntakeTrackedShortUrl;
exports.resolveCampaignCardResponseLink = resolveCampaignCardResponseLink;
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
