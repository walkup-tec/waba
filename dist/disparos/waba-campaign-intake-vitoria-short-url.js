"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME = exports.VITORIA_DA_CONQUISTA_SUBSCRIBER_ID = void 0;
exports.normalizeIntakeCampaignName = normalizeIntakeCampaignName;
exports.isVitoriaDaConquistaCampaignName = isVitoriaDaConquistaCampaignName;
exports.shouldBackfillVitoriaDaConquistaShortUrl = shouldBackfillVitoriaDaConquistaShortUrl;
exports.ensureVitoriaDaConquistaIntakeShortUrlByCampaignId = ensureVitoriaDaConquistaIntakeShortUrlByCampaignId;
exports.runVitoriaDaConquistaShortUrlOneshot = runVitoriaDaConquistaShortUrlOneshot;
const load_env_1 = require("../load-env");
const waba_campaign_intake_repository_1 = require("./waba-campaign-intake.repository");
const waba_campaign_intake_short_url_1 = require("./waba-campaign-intake-short-url");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
exports.VITORIA_DA_CONQUISTA_SUBSCRIBER_ID = "bd3fdfc3-c7a4-4234-8def-e0726e818937";
exports.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME = "VITORIA DA CONQUISTA";
const intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
const subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository();
function normalizeIntakeCampaignName(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
}
function isVitoriaDaConquistaCampaignName(campaignName) {
    return (normalizeIntakeCampaignName(campaignName) ===
        normalizeIntakeCampaignName(exports.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME));
}
function shouldBackfillVitoriaDaConquistaShortUrl(input) {
    if (String(input.subscriberId || "").trim() !== exports.VITORIA_DA_CONQUISTA_SUBSCRIBER_ID) {
        return false;
    }
    if (!isVitoriaDaConquistaCampaignName(String(input.campaignName || "")))
        return false;
    if (!String(input.responseLink || "").trim())
        return false;
    const existingUrl = String(input.responseShortUrl || "").trim();
    const existingSlug = String(input.responseShortSlug || "").trim();
    return !(existingUrl && existingSlug);
}
async function persistTrackedShortUrl(intake, deps = {}) {
    const destinationUrl = String(intake.responseLink || "").trim();
    if (!destinationUrl)
        return null;
    const existingUrl = String(intake.responseShortUrl || "").trim();
    const existingSlug = String(intake.responseShortSlug || "").trim();
    if (existingUrl && existingSlug) {
        return { shortUrl: existingUrl, shortSlug: existingSlug };
    }
    try {
        const created = await (0, waba_campaign_intake_short_url_1.createCampaignIntakeTrackedShortUrl)({
            destinationUrl,
            campaignId: intake.id,
            ownerEmail: intake.ownerEmail,
        }, deps);
        const updated = intakeRepository.updateById(intake.id, {
            responseShortUrl: created.shortUrl,
            responseShortSlug: created.shortSlug,
            updatedAt: new Date().toISOString(),
        });
        if (!updated)
            return null;
        return created;
    }
    catch (error) {
        console.error(`[campanhas] falha ao gerar URL curta de ${exports.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME}:`, error instanceof Error ? error.message : error);
        return null;
    }
}
async function ensureVitoriaDaConquistaIntakeShortUrlByCampaignId(campaignId, deps = {}) {
    const intake = intakeRepository.getById(String(campaignId || "").trim());
    if (!intake)
        return null;
    const subscriber = subscriberRepository.getByEmail(String(intake.ownerEmail || "").trim());
    if (!shouldBackfillVitoriaDaConquistaShortUrl({
        subscriberId: subscriber?.id,
        campaignName: intake.campaignName,
        responseLink: intake.responseLink,
        responseShortUrl: intake.responseShortUrl,
        responseShortSlug: intake.responseShortSlug,
    })) {
        return null;
    }
    return persistTrackedShortUrl(intake, deps);
}
async function runVitoriaDaConquistaShortUrlOneshot(deps = {}) {
    const env = String(load_env_1.WABA_ENV || process.env.WABA_ENV || "").trim().toLowerCase();
    if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
        return {
            applied: false,
            reason: "local-env",
            message: "oneshot ignorado em ambiente local",
        };
    }
    const subscriber = subscriberRepository.getById(exports.VITORIA_DA_CONQUISTA_SUBSCRIBER_ID);
    if (!subscriber) {
        return {
            applied: false,
            reason: "subscriber-not-found",
            message: `Assinante ${exports.VITORIA_DA_CONQUISTA_SUBSCRIBER_ID} não encontrado`,
        };
    }
    const matches = intakeRepository
        .listByEmail(subscriber.email)
        .filter((item) => isVitoriaDaConquistaCampaignName(item.campaignName));
    if (!matches.length) {
        return {
            applied: false,
            reason: "campaign-not-found",
            message: `Campanha ${exports.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME} não encontrada`,
        };
    }
    const pending = matches.filter((item) => shouldBackfillVitoriaDaConquistaShortUrl({
        subscriberId: subscriber.id,
        campaignName: item.campaignName,
        responseLink: item.responseLink,
        responseShortUrl: item.responseShortUrl,
        responseShortSlug: item.responseShortSlug,
    }));
    if (!pending.length) {
        const first = matches[0];
        return {
            applied: false,
            reason: first.responseShortUrl ? "already-has-short-url" : "missing-destination",
            message: first.responseShortUrl
                ? `URL curta já existia (${first.responseShortUrl})`
                : "Campanha sem link de resposta para incorporar",
            campaignId: first.id,
            shortUrl: first.responseShortUrl,
        };
    }
    const created = [];
    for (const intake of pending) {
        const next = await persistTrackedShortUrl(intake, deps);
        if (next)
            created.push(next);
    }
    if (!created.length) {
        return {
            applied: false,
            reason: "create-failed",
            message: "Não foi possível gerar a URL curta da campanha",
            campaignId: pending[0]?.id,
        };
    }
    return {
        applied: true,
        reason: "created",
        message: `URL curta gerada para ${exports.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME} (${created[0].shortUrl})`,
        campaignId: pending[0]?.id,
        shortUrl: created[0].shortUrl,
        count: created.length,
    };
}
