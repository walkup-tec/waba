/** Versão exposta em GET /health — o frontend valida antes do POST intake. */
export const WABA_CAMPAIGN_INTAKE_API_VERSION = 5;

/** Indica que json/urlencoded não consomem o body do POST /disparos/campanhas/intake. */
export const WABA_CAMPAIGN_INTAKE_SAFE_PARSER = true;

/** Mínimo de envios por campanha (wizard API Oficial). */
export const WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT = 1000;
