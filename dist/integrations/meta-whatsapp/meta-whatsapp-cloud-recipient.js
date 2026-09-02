"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spreadsheetPhoneCellDigits = spreadsheetPhoneCellDigits;
exports.normalizeMetaSpreadsheetRecipient = normalizeMetaSpreadsheetRecipient;
exports.metaSpreadsheetRecipientDedupeKey = metaSpreadsheetRecipientDedupeKey;
const evo_instance_phone_service_1 = require("../../instances/evo-instance-phone.service");
const meta_whatsapp_recipient_1 = require("./meta-whatsapp-recipient");
/**
 * Extrai dígitos de célula de planilha (máscara, Excel número/científico, +, 00, zero de tronco).
 * Não envia à Graph — só prepara o candidato E.164.
 */
function spreadsheetPhoneCellDigits(raw) {
    let text = "";
    if (typeof raw === "number" && Number.isFinite(raw)) {
        if (raw <= 0)
            return "";
        if (Number.isInteger(raw) || Math.abs(raw - Math.round(raw)) < 1e-6) {
            text = String(Math.round(raw));
        }
        else {
            text = raw.toExponential().replace("+", "");
        }
    }
    else {
        text = String(raw ?? "").trim();
    }
    if (!text)
        return "";
    text = text.replace(/\u00a0/g, " ").replace(/^\++/, "");
    if (/^\d+[.,]\d+[eE][+-]?\d+$/.test(text)) {
        const asNumber = Number(text.replace(",", "."));
        if (Number.isFinite(asNumber) && asNumber > 0) {
            text = String(Math.round(asNumber));
        }
    }
    text = text.replace(/^00+/, "");
    let digits = text.replace(/\D/g, "");
    if (!digits)
        return "";
    if (digits.startsWith("0") && digits.length >= 11 && digits.length <= 14) {
        const withoutTrunk = digits.replace(/^0+/, "");
        const national = withoutTrunk.length >= 10 && withoutTrunk.length <= 11;
        const intlBr = withoutTrunk.startsWith("55") && withoutTrunk.length >= 12 && withoutTrunk.length <= 13;
        if (national || intlBr)
            digits = withoutTrunk;
    }
    return digits;
}
function pickBrazilMobileWaId(digits) {
    const variants = (0, evo_instance_phone_service_1.expandBrazilWhatsAppNumberVariants)(digits);
    const mobileIntl = variants.find((item) => item.startsWith("55") && item.length === 13 && item.charAt(4) === "9");
    if (mobileIntl)
        return mobileIntl;
    const landIntl = variants.find((item) => item.startsWith("55") && item.length === 12);
    if (landIntl)
        return landIntl;
    const mobileNational = variants.find((item) => !item.startsWith("55") && item.length === 11 && item.charAt(2) === "9");
    if (mobileNational)
        return `55${mobileNational}`;
    if (digits.startsWith("55"))
        return digits;
    if (digits.length >= 10 && digits.length <= 11)
        return `55${digits}`;
    return digits;
}
/**
 * Planilha → destino Cloud API (E.164 sem +).
 * BR: DDI 55 e 9º dígito móvel quando faltar. Outros países: DDI já na célula (12–15 dígitos).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api
 */
function normalizeMetaSpreadsheetRecipient(raw) {
    const digits = spreadsheetPhoneCellDigits(raw);
    if (!digits) {
        return { ok: false, error: "Informe o número de destino com DDI. Ex.: 5551999887766" };
    }
    if (digits.length >= 12 && digits.length <= 15 && !digits.startsWith("55")) {
        return (0, meta_whatsapp_recipient_1.normalizeCloudApiRecipient)(digits);
    }
    return (0, meta_whatsapp_recipient_1.normalizeCloudApiRecipient)(pickBrazilMobileWaId(digits));
}
/** Chave de dedupe na mesma campanha (BR sem o 9 móvel quando aplicável). */
function metaSpreadsheetRecipientDedupeKey(waId) {
    return (0, evo_instance_phone_service_1.canonicalizeBrazilWhatsAppNumber)(waId) || waId;
}
