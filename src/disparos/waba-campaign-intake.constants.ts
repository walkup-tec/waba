/** Versão exposta em GET /health — o frontend valida antes do POST intake. */
export const WABA_CAMPAIGN_INTAKE_API_VERSION = 8;

/** Indica que json/urlencoded não consomem o body do POST /disparos/campanhas/intake. */
export const WABA_CAMPAIGN_INTAKE_SAFE_PARSER = true;

/** Mínimo de envios por campanha (wizard API Oficial). */
export const WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT = 5000;

/** Mínimo de envios por campanha (API Alternativa). */
export const WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT_ALTERNATIVA = 1000;

/** Só este assinante fica sem o piso de envios da campanha. */
export const WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL = "mozart.pmo@gmail.com";

/** Fila fixa do Mozart: toda campanha gerada por ele vai para este operacional. */
export const WABA_MOZART_FORCED_OPERACIONAL_EMAIL = "drax@draxsistemas.com.br";

function normalizeOwnerEmail(email: string | null | undefined): string {
  return String(email || "").trim().toLowerCase();
}

export function campaignMinPlannedSendCountForEmail(
  email: string | null | undefined,
  apiKind: "oficial" | "alternativa" = "oficial",
): number {
  if (normalizeOwnerEmail(email) === WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL) return 1;
  if (apiKind === "alternativa") return WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT_ALTERNATIVA;
  return WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT;
}

export function forcedOperacionalEmailForCampaignOwner(
  ownerEmail: string | null | undefined,
): string | null {
  if (normalizeOwnerEmail(ownerEmail) === WABA_CAMPAIGN_NO_MIN_SEND_COUNT_EMAIL) {
    return WABA_MOZART_FORCED_OPERACIONAL_EMAIL;
  }
  return null;
}
