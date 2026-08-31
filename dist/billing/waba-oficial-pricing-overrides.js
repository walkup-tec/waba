"use strict";
/**
 * Exceção de tarifado API Oficial por e-mail.
 * Somente os e-mails listados recebem o acréscimo; demais assinantes inalterados.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFICIAL_PRICING_SURCHARGE_CENTS_PER_SEND = exports.OFICIAL_PRICING_SURCHARGE_EMAILS = void 0;
exports.isOficialPricingSurchargeEmail = isOficialPricingSurchargeEmail;
exports.applyOficialPerSendSurchargeToPackages = applyOficialPerSendSurchargeToPackages;
exports.runOficialPricingOverridesSelfCheck = runOficialPricingOverridesSelfCheck;
exports.OFICIAL_PRICING_SURCHARGE_EMAILS = ["cleison.fel@gmail.com"];
/** R$ 0,02 por envio em cada faixa da API Oficial. */
exports.OFICIAL_PRICING_SURCHARGE_CENTS_PER_SEND = 2;
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
function isOficialPricingSurchargeEmail(email) {
    const key = normalizeEmail(email);
    if (!key.includes("@"))
        return false;
    return exports.OFICIAL_PRICING_SURCHARGE_EMAILS.includes(key);
}
function applyOficialPerSendSurchargeToPackages(packages, ownerEmail) {
    if (!isOficialPricingSurchargeEmail(ownerEmail))
        return packages;
    return packages.map((pack) => ({
        ...pack,
        valueCents: pack.valueCents + pack.shipments * exports.OFICIAL_PRICING_SURCHARGE_CENTS_PER_SEND,
    }));
}
function runOficialPricingOverridesSelfCheck() {
    const base = [
        { shipments: 1000, valueCents: 32000 },
        { shipments: 3000, valueCents: 93000 },
    ];
    const other = applyOficialPerSendSurchargeToPackages(base, "outro@assinante.com");
    if (other[0]?.valueCents !== 32000 || other[1]?.valueCents !== 93000) {
        throw new Error("tarifado oficial não pode mudar para outros assinantes");
    }
    const cleison = applyOficialPerSendSurchargeToPackages(base, "cleison.fel@gmail.com");
    if (cleison[0]?.valueCents !== 34000) {
        throw new Error("cleison 1000 envios deve ser R$ 340,00");
    }
    if (cleison[1]?.valueCents !== 99000) {
        throw new Error("cleison 3000 envios deve ser R$ 990,00");
    }
    if (!isOficialPricingSurchargeEmail("  Cleison.Fel@gmail.com ")) {
        throw new Error("e-mail do cleison deve ser reconhecido com case/espaço");
    }
    if (isOficialPricingSurchargeEmail("cleison.fel@gmail.com.br")) {
        throw new Error("e-mail parecido não pode receber o acréscimo");
    }
}
