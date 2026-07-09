"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WABA_CAMPAIGN_INTAKE_SAFE_PARSER = exports.WABA_CAMPAIGN_INTAKE_API_VERSION = void 0;
/** Versão exposta em GET /health — o frontend valida antes do POST intake. */
exports.WABA_CAMPAIGN_INTAKE_API_VERSION = 3;
/** Indica que json/urlencoded não consomem o body do POST /disparos/campanhas/intake. */
exports.WABA_CAMPAIGN_INTAKE_SAFE_PARSER = true;
