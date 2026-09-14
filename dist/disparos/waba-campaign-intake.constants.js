"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL = exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT = exports.WABA_CAMPAIGN_INTAKE_SAFE_PARSER = exports.WABA_CAMPAIGN_INTAKE_API_VERSION = void 0;
exports.campaignMinPlannedSendCountForEmail = campaignMinPlannedSendCountForEmail;
/** Versão exposta em GET /health — o frontend valida antes do POST intake. */
exports.WABA_CAMPAIGN_INTAKE_API_VERSION = 6;
/** Indica que json/urlencoded não consomem o body do POST /disparos/campanhas/intake. */
exports.WABA_CAMPAIGN_INTAKE_SAFE_PARSER = true;
/** Mínimo de envios por campanha (wizard API Oficial). */
exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT = 1000;
/** Só este assinante fica sem o piso de 1000 envios. */
exports.WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL = "mozart.pmo@gmail.com";
function campaignMinPlannedSendCountForEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (normalized === exports.WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL)
        return 1;
    return exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT;
}
