"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aquecedorChipKeyFromNumber = aquecedorChipKeyFromNumber;
exports.scoreAquecedorDuplicateInstance = scoreAquecedorDuplicateInstance;
exports.dedupeAquecedorConnectedByNumber = dedupeAquecedorConnectedByNumber;
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
 * Quando duas instâncias compartilham o mesmo chip, preferir o nome técnico
 * que coincide com o final do número (6635 em 555181076635) e nomes só-dígitos
 * (9224 em vez de soma-9224).
 */
function scoreAquecedorDuplicateInstance(instanceName, numero) {
    const name = String(instanceName || "").trim();
    const nameDigits = digitsOnly(name);
    const phone = aquecedorChipKeyFromNumber(numero);
    let score = 0;
    if (/^\d+$/.test(name))
        score += 50;
    if (nameDigits.length >= 3 && phone.endsWith(nameDigits))
        score += 100;
    if (/^soma-/i.test(name) || /proxy-/i.test(name))
        score -= 25;
    return score;
}
function dedupeAquecedorConnectedByNumber(rows) {
    const best = new Map();
    const withoutNumber = [];
    for (const row of rows) {
        const instancia = String(row?.instancia || "").trim();
        if (!instancia)
            continue;
        const canon = aquecedorChipKeyFromNumber(row?.numero);
        if (!canon) {
            withoutNumber.push(row);
            continue;
        }
        const current = best.get(canon);
        if (!current) {
            best.set(canon, row);
            continue;
        }
        const nextScore = scoreAquecedorDuplicateInstance(instancia, canon);
        const curScore = scoreAquecedorDuplicateInstance(String(current.instancia || ""), canon);
        if (nextScore > curScore)
            best.set(canon, row);
    }
    const winners = new Set(best.values());
    const out = [];
    const pushed = new Set();
    for (const row of rows) {
        if ((winners.has(row) || withoutNumber.includes(row)) && !pushed.has(row)) {
            out.push(row);
            pushed.add(row);
        }
    }
    return out;
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
        const current = chipToInstance.get(chip);
        if (!current ||
            scoreAquecedorDuplicateInstance(instancia, chip) >
                scoreAquecedorDuplicateInstance(current, chip)) {
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
