"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatBrazilMobileForAsaas = exports.formatBrazilPhoneDigits = void 0;
const normalizeDigits = (value) => value.replace(/\D/g, "");
/** DDD + número fixo ou celular, só dígitos (10 ou 11). */
const formatBrazilPhoneDigits = (raw) => {
    let digits = normalizeDigits(raw);
    if (digits.startsWith("55") && digits.length >= 12) {
        digits = digits.slice(2);
    }
    if (digits.length < 10 || digits.length > 11) {
        throw new Error("Informe um telefone válido com DDD (ex.: (11) 3333-4444 ou (11) 99999-9999).");
    }
    return digits;
};
exports.formatBrazilPhoneDigits = formatBrazilPhoneDigits;
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
