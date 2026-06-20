"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePixKeyForAsaas = exports.resolveAsaasPixKeyType = void 0;
const EVP_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalizePhoneDigits = (digits) => {
    if (digits.length === 13 && digits.startsWith("55"))
        return digits.slice(2);
    if (digits.length === 12 && digits.startsWith("55"))
        return digits.slice(2);
    return digits;
};
const resolveAsaasPixKeyType = (pixKey) => {
    const raw = String(pixKey ?? "").trim();
    if (!raw)
        throw new Error("Chave PIX vazia.");
    if (raw.includes("@"))
        return "EMAIL";
    if (EVP_UUID_RE.test(raw))
        return "EVP";
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 14)
        return "CNPJ";
    if (digits.length === 11 && !raw.includes("@")) {
        if (/^\d{11}$/.test(digits))
            return "CPF";
    }
    if (digits.length === 10 || digits.length === 11)
        return "PHONE";
    if (raw.startsWith("+") && digits.length >= 12)
        return "PHONE";
    return "EVP";
};
exports.resolveAsaasPixKeyType = resolveAsaasPixKeyType;
const normalizePixKeyForAsaas = (pixKey, keyType) => {
    const raw = String(pixKey ?? "").trim();
    if (keyType === "EMAIL")
        return raw.toLowerCase();
    if (keyType === "CPF" || keyType === "CNPJ")
        return raw.replace(/\D/g, "");
    if (keyType === "PHONE")
        return normalizePhoneDigits(raw.replace(/\D/g, ""));
    return raw;
};
exports.normalizePixKeyForAsaas = normalizePixKeyForAsaas;
