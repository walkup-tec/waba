"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT = exports.WABA_CAMPAIGN_INTAKE_SAFE_PARSER = exports.WABA_CAMPAIGN_INTAKE_API_VERSION = void 0;
/** Versão exposta em GET /health — o frontend valida antes do POST intake. */
exports.WABA_CAMPAIGN_INTAKE_API_VERSION = 5;
/** Indica que json/urlencoded não consomem o body do POST /disparos/campanhas/intake. */
exports.WABA_CAMPAIGN_INTAKE_SAFE_PARSER = true;
/** Mínimo de envios por campanha (wizard API Oficial). */
exports.WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT = 1000;
