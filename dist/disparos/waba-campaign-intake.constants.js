"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WABA_MOZART_FORCED_OPERACIONAL_EMAIL = exports.WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL = exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT_ALTERNATIVA = exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT = exports.WABA_CAMPAIGN_INTAKE_SAFE_PARSER = exports.WABA_CAMPAIGN_INTAKE_API_VERSION = void 0;
exports.campaignMinPlannedSendCountForEmail = campaignMinPlannedSendCountForEmail;
exports.forcedOperacionalEmailForCampaignOwner = forcedOperacionalEmailForCampaignOwner;
/** Versão exposta em GET /health — o frontend valida antes do POST intake. */
exports.WABA_CAMPAIGN_INTAKE_API_VERSION = 8;
/** Indica que json/urlencoded não consomem o body do POST /disparos/campanhas/intake. */
exports.WABA_CAMPAIGN_INTAKE_SAFE_PARSER = true;
/** Mínimo de envios por campanha (wizard API Oficial). */
exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT = 5000;
/** Mínimo de envios por campanha (API Alternativa). */
exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT_ALTERNATIVA = 1000;
/** Só este assinante fica sem o piso de envios da campanha. */
exports.WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL = "mozart.pmo@gmail.com";
/** Fila fixa do Mozart: toda campanha gerada por ele vai para este operacional. */
exports.WABA_MOZART_FORCED_OPERACIONAL_EMAIL = "drax@draxsistemas.com.br";
function normalizeOwnerEmail(email) {
    return String(email || "").trim().toLowerCase();
}
function campaignMinPlannedSendCountForEmail(email, apiKind = "oficial") {
    if (normalizeOwnerEmail(email) === exports.WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL)
        return 1;
    if (apiKind === "alternativa")
        return exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT_ALTERNATIVA;
    return exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT;
}
function forcedOperacionalEmailForCampaignOwner(ownerEmail) {
    if (normalizeOwnerEmail(ownerEmail) === exports.WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL) {
        return exports.WABA_MOZART_FORCED_OPERACIONAL_EMAIL;
    }
    return null;
}
