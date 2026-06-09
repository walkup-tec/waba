"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatBrazilMobileForAsaas = void 0;
const normalizeDigits = (value) => value.replace(/\D/g, "");
/** DDD + número, só dígitos (ex.: 11999999999). */
const formatBrazilMobileForAsaas = (raw) => {
    let digits = normalizeDigits(raw);
    if (digits.startsWith("55") && digits.length >= 12) {
        digits = digits.slice(2);
    }
    if (digits.length !== 11 || digits.charAt(2) !== "9") {
        throw new Error("Informe um celular válido com DDD (ex.: (11) 99999-9999).");
    }
    return digits;
};
exports.formatBrazilMobileForAsaas = formatBrazilMobileForAsaas;
