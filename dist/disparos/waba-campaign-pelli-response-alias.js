"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PELLI_RESPONSE_SHORT_URL = exports.PELLI_ORIGINAL_RESPONSE_LINK = exports.PELLI_RESPONSE_SHORT_SLUG = void 0;
exports.applyPelliResponseAlias = applyPelliResponseAlias;
exports.runPelliResponseAliasOneshot = runPelliResponseAliasOneshot;
const crypto_1 = __importDefault(require("crypto"));
const load_env_1 = require("../load-env");
const waba_campaign_intake_repository_1 = require("./waba-campaign-intake.repository");
const waba_campaign_pelli_reopen_aifocus_1 = require("./waba-campaign-pelli-reopen-aifocus");
const waba_shortener_repository_1 = require("../shortener/waba-shortener.repository");
const waba_shortener_service_1 = require("../shortener/waba-shortener.service");
exports.PELLI_RESPONSE_SHORT_SLUG = "n6589823";
exports.PELLI_ORIGINAL_RESPONSE_LINK = "https://chat.whatsapp.com/GhcEBOG2gbYBqSLrL5Hl3r";
exports.PELLI_RESPONSE_SHORT_URL = "https://waba.draxsistemas.com.br/s/n6589823";
function findPelliIntake(repository) {
    const named = repository.listAll().filter((row) => (0, waba_campaign_pelli_reopen_aifocus_1.isPelliAgendaPessoalCampaignName)(row.campaignName));
    if (!named.length)
        return null;
    named.sort((a, b) => Date.parse(String(b.updatedAt || b.createdAt || "")) -
        Date.parse(String(a.updatedAt || a.createdAt || "")));
    return named[0] || null;
}
function aliasAlreadyPointsToOriginal(record) {
    if (!record)
        return false;
    return (0, waba_shortener_service_1.destinationUrlForShortRedirect)(record.longUrl) === exports.PELLI_ORIGINAL_RESPONSE_LINK;
}
function intakeAlreadyWired(intake) {
    return (String(intake.responseLinkOriginal || "").trim() === exports.PELLI_ORIGINAL_RESPONSE_LINK &&
        String(intake.responseShortSlug || "").trim() === exports.PELLI_RESPONSE_SHORT_SLUG &&
        String(intake.responseShortUrl || "").trim() === exports.PELLI_RESPONSE_SHORT_URL);
}
async function applyPelliResponseAlias(deps = {}) {
    const repository = deps.intakeRepository || new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    const findBySlug = deps.findBySlug || waba_shortener_repository_1.findShortLinkBySlug;
    const updateLongUrl = deps.updateLongUrl || waba_shortener_repository_1.updateShortLinkLongUrl;
    const createRecord = deps.createRecord || waba_shortener_repository_1.createShortLinkRecord;
    const intake = findPelliIntake(repository);
    if (!intake) {
        return { ok: true, skipped: true, message: "Campanha Pelli não encontrada" };
    }
    const existing = await findBySlug(exports.PELLI_RESPONSE_SHORT_SLUG);
    const intakeReady = intakeAlreadyWired(intake);
    const aliasReady = aliasAlreadyPointsToOriginal(existing);
    if (intakeReady && aliasReady) {
        return {
            ok: true,
            skipped: true,
            campaignId: intake.id,
            shortSlug: exports.PELLI_RESPONSE_SHORT_SLUG,
            message: "Alias da Pelli já apontava para o grupo do WhatsApp",
        };
    }
    if (existing) {
        const updated = await updateLongUrl(exports.PELLI_RESPONSE_SHORT_SLUG, exports.PELLI_ORIGINAL_RESPONSE_LINK, {
            campaignId: intake.id,
            intakeCampaignId: intake.id,
        });
        if (!updated) {
            return { ok: false, campaignId: intake.id, message: "Não foi possível atualizar o alias n6589823" };
        }
    }
    else {
        await createRecord({
            id: crypto_1.default.randomUUID(),
            slug: exports.PELLI_RESPONSE_SHORT_SLUG,
            longUrl: exports.PELLI_ORIGINAL_RESPONSE_LINK,
            tenantId: String(intake.ownerEmail || "").trim() || "pelli",
            campaignId: intake.id,
            intakeCampaignId: intake.id,
        });
    }
    const now = deps.now ? deps.now() : new Date().toISOString();
    const saved = repository.updateById(intake.id, {
        responseLinkOriginal: exports.PELLI_ORIGINAL_RESPONSE_LINK,
        responseShortSlug: exports.PELLI_RESPONSE_SHORT_SLUG,
        responseShortUrl: exports.PELLI_RESPONSE_SHORT_URL,
        updatedAt: now,
    });
    if (!saved) {
        return { ok: false, campaignId: intake.id, message: "Alias atualizado, mas a campanha Pelli não gravou" };
    }
    return {
        ok: true,
        applied: true,
        campaignId: intake.id,
        shortSlug: exports.PELLI_RESPONSE_SHORT_SLUG,
        message: "Alias da Pelli agora abre o grupo do WhatsApp",
    };
}
async function runPelliResponseAliasOneshot(deps = {}) {
    const env = String(process.env.WABA_ENV || load_env_1.WABA_ENV || "").trim().toLowerCase();
    if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
        return { ok: true, skipped: true, message: "oneshot ignorado em ambiente local" };
    }
    try {
        return await applyPelliResponseAlias(deps);
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Falha ao apontar o alias da Pelli",
        };
    }
}
