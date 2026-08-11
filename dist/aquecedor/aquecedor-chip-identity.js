"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aquecedorChipKeyFromNumber = aquecedorChipKeyFromNumber;
exports.buildAquecedorChipIndex = buildAquecedorChipIndex;
exports.resolveAquecedorInstanceToChip = resolveAquecedorInstanceToChip;
exports.resolveAquecedorNumberToChip = resolveAquecedorNumberToChip;
exports.buildAquecedorNumberVariantToChipMap = buildAquecedorNumberVariantToChipMap;
exports.resolveNumberVariantToChip = resolveNumberVariantToChip;
const evo_instance_phone_service_1 = require("../instances/evo-instance-phone.service");
function digitsOnly(raw) {
    return String(raw || "").replace(/\D/g, "");
}
/** Chave estável do chip WhatsApp (sem 9º dígito móvel quando aplicável). */
function aquecedorChipKeyFromNumber(raw) {
    const digits = digitsOnly(raw);
    if (!digits)
        return "";
    return (0, evo_instance_phone_service_1.canonicalizeBrazilWhatsAppNumber)(digits) || digits;
}
/**
 * Índice chip ↔ instância atual. A lógica de aquecimento deve usar `chips`,
 * não o nome técnico da instância (rename não muda o chip).
 */
function buildAquecedorChipIndex(connected) {
    const chipToInstance = new Map();
    const instanceToChip = new Map();
    for (const item of connected) {
        const instancia = String(item.instancia || "").trim();
        const chip = aquecedorChipKeyFromNumber(item.numero);
        if (!instancia || !chip)
            continue;
        instanceToChip.set(instancia.toLowerCase(), chip);
        // Mantém a primeira instância conectada como “atual” do chip.
        if (!chipToInstance.has(chip)) {
            chipToInstance.set(chip, instancia);
        }
    }
    const chips = Array.from(chipToInstance.keys()).sort((a, b) => a.localeCompare(b));
    return { chips, chipToInstance, instanceToChip };
}
function resolveAquecedorInstanceToChip(instanceName, index) {
    const key = String(instanceName || "").trim().toLowerCase();
    if (!key)
        return "";
    return index.instanceToChip.get(key) || "";
}
function resolveAquecedorNumberToChip(rawNumber, index) {
    const chip = aquecedorChipKeyFromNumber(rawNumber);
    if (!chip)
        return "";
    if (index.chipToInstance.has(chip))
        return chip;
    for (const known of index.chips) {
        if ((0, evo_instance_phone_service_1.brazilWhatsAppNumbersMatch)(known, chip))
            return known;
    }
    return chip;
}
/** Mapa dígitos/variantes → chip (para resolver numero_destino histórico). */
function buildAquecedorNumberVariantToChipMap(connected) {
    const map = new Map();
    for (const item of connected) {
        const chip = aquecedorChipKeyFromNumber(item.numero);
        if (!chip)
            continue;
        for (const variant of (0, evo_instance_phone_service_1.expandBrazilWhatsAppNumberVariants)(item.numero)) {
            map.set(variant, chip);
            map.set(variant.toLowerCase(), chip);
        }
        map.set(chip, chip);
    }
    return map;
}
function resolveNumberVariantToChip(rawNumber, variantToChip) {
    const digits = digitsOnly(rawNumber);
    if (!digits)
        return "";
    const direct = variantToChip.get(digits) || variantToChip.get(digits.toLowerCase());
    if (direct)
        return direct;
    const chip = aquecedorChipKeyFromNumber(digits);
    if (chip && (variantToChip.get(chip) || variantToChip.has(chip)))
        return chip;
    for (const [stored, mapped] of variantToChip.entries()) {
        if (/^\d+$/.test(stored) && (0, evo_instance_phone_service_1.brazilWhatsAppNumbersMatch)(stored, digits))
            return mapped;
    }
    return chip;
}
