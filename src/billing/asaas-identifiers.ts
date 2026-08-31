/** Prefixo fixo para distinguir cobranças WABA na conta Asaas compartilhada. */
export const WABA_ASAAS_PRODUCT = "waba";

/** Usado em externalReference (cliente, pagamento, webhook). */
export const WABA_ASAAS_ORDER_PREFIX = "waba:";

/** Limite Asaas para externalReference em transferências PIX. */
export const ASAAS_EXTERNAL_REFERENCE_MAX = 100;

export function buildWabaAsaasExternalReference(orderId: string): string {
  const id = String(orderId ?? "").trim();
  return `${WABA_ASAAS_ORDER_PREFIX}${id}`;
}

const compactToken = (value: string): string =>
  String(value ?? "")
    .replace(/-/g, "")
    .trim()
    .slice(0, 16);

/** Referência compacta para split PIX (sempre ≤ 100 chars, inclusive retries). */
export function buildSplitLineAsaasExternalReference(input: {
  orderId: string;
  lineKind: string;
  participantId: string;
  retryAttempt?: number;
}): string {
  const order = compactToken(input.orderId);
  const participant = compactToken(input.participantId);
  const kind = String(input.lineKind ?? "p")
    .trim()
    .slice(0, 1);
  const base = `${WABA_ASAAS_ORDER_PREFIX}sp:${order}:${kind}:${participant}`;
  const attempt = Math.max(0, Math.round(Number(input.retryAttempt ?? 0)));
  if (attempt <= 0) return base.slice(0, ASAAS_EXTERNAL_REFERENCE_MAX);
  const suffix = `:r${attempt}`;
  return `${base}${suffix}`.slice(0, ASAAS_EXTERNAL_REFERENCE_MAX);
}

/** Formato legado (longo) — leitura/reconciliação de transferências antigas. */
export function buildLegacySplitLineAsaasExternalReference(input: {
  orderId: string;
  lineKind: string;
  participantId: string;
}): string {
  return buildWabaAsaasExternalReference(
    `split:${input.orderId}:${input.lineKind}:${input.participantId}`,
  );
}

/** Remove sufixos de retry (`:retry:…` legado ou `:rN` compacto). */
export function baseSplitLineExternalReference(externalReference: string): string {
  const ref = String(externalReference ?? "").trim();
  if (!ref) return "";
  const legacyIdx = ref.indexOf(":retry:");
  if (legacyIdx >= 0) return ref.slice(0, legacyIdx);
  return ref.replace(/:r\d+$/, "");
}

export function splitLineExternalReferencesMatch(stored: string, incoming: string): boolean {
  const a = String(stored ?? "").trim();
  const b = String(incoming ?? "").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const baseA = baseSplitLineExternalReference(a);
  const baseB = baseSplitLineExternalReference(b);
  return baseA === baseB;
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

export function buildAlternativaNumbersPaymentDescription(quantity: number): string {
  return `WABA API Alternativa · ${quantity.toLocaleString("pt-BR")} número(s) WhatsApp`;
}
