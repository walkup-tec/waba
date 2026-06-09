/** Prefixo fixo para distinguir cobranças WABA na conta Asaas compartilhada. */
export const WABA_ASAAS_PRODUCT = "waba";

/** Usado em externalReference (cliente, pagamento, webhook). */
export const WABA_ASAAS_ORDER_PREFIX = "waba:";

export function buildWabaAsaasExternalReference(orderId: string): string {
  const id = String(orderId ?? "").trim();
  return `${WABA_ASAAS_ORDER_PREFIX}${id}`;
}

export function parseWabaOrderIdFromExternalReference(externalReference: string): string | null {
  const normalized = String(externalReference ?? "").trim();
  if (!normalized.startsWith(WABA_ASAAS_ORDER_PREFIX)) return null;
  const orderId = normalized.slice(WABA_ASAAS_ORDER_PREFIX.length).trim();
  return orderId || null;
}

export function isWabaAsaasExternalReference(externalReference: string): boolean {
  return parseWabaOrderIdFromExternalReference(externalReference) !== null;
}

export function buildWabaPaymentDescription(apiKind: "oficial" | "alternativa"): string {
  const label = apiKind === "oficial" ? "API Oficial" : "API Alternativa";
  return `WABA Disparos · ${label} · créditos`;
}
