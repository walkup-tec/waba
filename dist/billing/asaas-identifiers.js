"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WABA_ASAAS_ORDER_PREFIX = exports.WABA_ASAAS_PRODUCT = void 0;
exports.buildWabaAsaasExternalReference = buildWabaAsaasExternalReference;
exports.parseWabaOrderIdFromExternalReference = parseWabaOrderIdFromExternalReference;
exports.isWabaAsaasExternalReference = isWabaAsaasExternalReference;
exports.buildWabaPaymentDescription = buildWabaPaymentDescription;
exports.buildAlternativaNumbersPaymentDescription = buildAlternativaNumbersPaymentDescription;
/** Prefixo fixo para distinguir cobranças WABA na conta Asaas compartilhada. */
exports.WABA_ASAAS_PRODUCT = "waba";
/** Usado em externalReference (cliente, pagamento, webhook). */
exports.WABA_ASAAS_ORDER_PREFIX = "waba:";
function buildWabaAsaasExternalReference(orderId) {
    const id = String(orderId ?? "").trim();
    return `${exports.WABA_ASAAS_ORDER_PREFIX}${id}`;
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
