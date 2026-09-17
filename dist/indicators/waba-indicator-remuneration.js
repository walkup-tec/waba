"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveIndicatorCommissionCentsPerSend = exports.hasOwnCommissionInput = exports.DEFAULT_INDICATOR_COMMISSION_CENTS_PER_SEND = void 0;
const waba_money_cents_1 = require("../billing/waba-money-cents");
/** Comissão padrão do indicador, em centavos por envio (R$ 0,02). Editável no cadastro. */
exports.DEFAULT_INDICATOR_COMMISSION_CENTS_PER_SEND = 2;
const hasOwnCommissionInput = (value) => value !== undefined && value !== null && String(value).trim() !== "";
exports.hasOwnCommissionInput = hasOwnCommissionInput;
const resolveIndicatorCommissionCentsPerSend = (value, fallback = exports.DEFAULT_INDICATOR_COMMISSION_CENTS_PER_SEND) => {
    if (!(0, exports.hasOwnCommissionInput)(value))
        return (0, waba_money_cents_1.toNonNegativeCents)(fallback);
    return (0, waba_money_cents_1.toNonNegativeCents)(value);
};
exports.resolveIndicatorCommissionCentsPerSend = resolveIndicatorCommissionCentsPerSend;
