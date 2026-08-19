"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toEvoSendNumberDigits = toEvoSendNumberDigits;
exports.pickCanonicalWhatsAppNumberFromExistsCheck = pickCanonicalWhatsAppNumberFromExistsCheck;
exports.welcomeDestinationCandidates = welcomeDestinationCandidates;
const evo_instance_phone_service_1 = require("../instances/evo-instance-phone.service");
/** Dígitos com DDI 55 quando o tamanho for nacional (10/11). */
function toEvoSendNumberDigits(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits)
        return "";
    if (digits.length >= 12 && digits.startsWith("55"))
        return digits;
    if (digits.length >= 10 && digits.length <= 11)
        return `55${digits}`;
    return digits;
}
/**
 * Evolution às vezes confirma exists:true num formato e devolve o JID canônico noutro
 * (ex.: cadastro 5541989006946 → jid 554189006946). Enviar o JID, não o digitado.
 */
function pickCanonicalWhatsAppNumberFromExistsCheck(items) {
    if (!Array.isArray(items))
        return "";
    for (const item of items) {
        if (item?.exists !== true)
            continue;
        const jidDigits = String(item.jid || "")
            .split("@")[0]
            .replace(/\D/g, "");
        if (jidDigits.length >= 10)
            return toEvoSendNumberDigits(jidDigits);
        const numberDigits = String(item.number || "").replace(/\D/g, "");
        if (numberDigits.length >= 10)
            return toEvoSendNumberDigits(numberDigits);
    }
    return "";
}
function welcomeDestinationCandidates(raw, canonical = "") {
    const out = [];
    const seen = new Set();
    const add = (value) => {
        const digits = toEvoSendNumberDigits(value);
        if (!digits || seen.has(digits))
            return;
        seen.add(digits);
        out.push(digits);
    };
    add(canonical);
    for (const variant of (0, evo_instance_phone_service_1.expandBrazilWhatsAppNumberVariants)(raw))
        add(variant);
    add(raw);
    return out;
}
