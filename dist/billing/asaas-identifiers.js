"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASAAS_EXTERNAL_REFERENCE_MAX = exports.WABA_ASAAS_ORDER_PREFIX = exports.WABA_ASAAS_PRODUCT = void 0;
exports.buildWabaAsaasExternalReference = buildWabaAsaasExternalReference;
exports.buildSplitLineAsaasExternalReference = buildSplitLineAsaasExternalReference;
exports.buildLegacySplitLineAsaasExternalReference = buildLegacySplitLineAsaasExternalReference;
exports.baseSplitLineExternalReference = baseSplitLineExternalReference;
exports.splitLineExternalReferencesMatch = splitLineExternalReferencesMatch;
exports.parseWabaOrderIdFromExternalReference = parseWabaOrderIdFromExternalReference;
exports.isWabaAsaasExternalReference = isWabaAsaasExternalReference;
exports.buildWabaPaymentDescription = buildWabaPaymentDescription;
exports.buildAlternativaNumbersPaymentDescription = buildAlternativaNumbersPaymentDescription;
/** Prefixo fixo para distinguir cobranças WABA na conta Asaas compartilhada. */
exports.WABA_ASAAS_PRODUCT = "waba";
/** Usado em externalReference (cliente, pagamento, webhook). */
exports.WABA_ASAAS_ORDER_PREFIX = "waba:";
/** Limite Asaas para externalReference em transferências PIX. */
exports.ASAAS_EXTERNAL_REFERENCE_MAX = 100;
function buildWabaAsaasExternalReference(orderId) {
    const id = String(orderId ?? "").trim();
    return `${exports.WABA_ASAAS_ORDER_PREFIX}${id}`;
}
const compactToken = (value) => String(value ?? "")
    .replace(/-/g, "")
    .trim()
    .slice(0, 16);
/** Referência compacta para split PIX (sempre ≤ 100 chars, inclusive retries). */
function buildSplitLineAsaasExternalReference(input) {
    const order = compactToken(input.orderId);
    const participant = compactToken(input.participantId);
    const kind = String(input.lineKind ?? "p")
        .trim()
        .slice(0, 1);
    const base = `${exports.WABA_ASAAS_ORDER_PREFIX}sp:${order}:${kind}:${participant}`;
    const attempt = Math.max(0, Math.round(Number(input.retryAttempt ?? 0)));
    if (attempt <= 0)
        return base.slice(0, exports.ASAAS_EXTERNAL_REFERENCE_MAX);
    const suffix = `:r${attempt}`;
    return `${base}${suffix}`.slice(0, exports.ASAAS_EXTERNAL_REFERENCE_MAX);
}
/** Formato legado (longo) — leitura/reconciliação de transferências antigas. */
function buildLegacySplitLineAsaasExternalReference(input) {
    return buildWabaAsaasExternalReference(`split:${input.orderId}:${input.lineKind}:${input.participantId}`);
}
/** Remove sufixos de retry (`:retry:…` legado ou `:rN` compacto). */
function baseSplitLineExternalReference(externalReference) {
    const ref = String(externalReference ?? "").trim();
    if (!ref)
        return "";
    const legacyIdx = ref.indexOf(":retry:");
    if (legacyIdx >= 0)
        return ref.slice(0, legacyIdx);
    return ref.replace(/:r\d+$/, "");
}
function splitLineExternalReferencesMatch(stored, incoming) {
    const a = String(stored ?? "").trim();
    const b = String(incoming ?? "").trim();
    if (!a || !b)
        return false;
    if (a === b)
        return true;
    const baseA = baseSplitLineExternalReference(a);
    const baseB = baseSplitLineExternalReference(b);
    return baseA === baseB;
}
function parseWabaOrderIdFromExternalReference(externalReference) {
    const normalized = String(externalReference ?? "").trim();
    if (!normalized.startsWith(exports.WABA_ASAAS_ORDER_PREFIX))
        return null;
    const orderId = normalized.slice(exports.WABA_ASAAS_ORDER_PREFIX.length).trim();
    return orderId || null;
}
function isWabaAsaasExternalReference(externalReference) {
    return parseWabaOrderIdFromExternalReference(externalReference) !== null;
}
function buildWabaPaymentDescription(apiKind) {
    const label = apiKind === "oficial" ? "API Oficial" : "API Alternativa";
    return `WABA Disparos · ${label} · créditos`;
}
function buildAlternativaNumbersPaymentDescription(quantity) {
    return `WABA API Alternativa · ${quantity.toLocaleString("pt-BR")} número(s) WhatsApp`;
}
