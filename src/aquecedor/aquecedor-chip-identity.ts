import {
  brazilWhatsAppNumbersMatch,
  canonicalizeBrazilWhatsAppNumber,
  expandBrazilWhatsAppNumberVariants,
} from "../instances/evo-instance-phone.service";

export type AquecedorConnectedRow = {
  instancia: string;
  numero: string;
};

export type AquecedorChipIndex = {
  /** Chips únicos (chave canônica 55+DDD+8). */
  chips: string[];
  /** chip → nome de instância atual (conectado). */
  chipToInstance: Map<string, string>;
  /** nome instância (lower) → chip. */
  instanceToChip: Map<string, string>;
};

function digitsOnly(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

/** Chave estável do chip WhatsApp (sem 9º dígito móvel quando aplicável). */
export function aquecedorChipKeyFromNumber(raw: string): string {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  return canonicalizeBrazilWhatsAppNumber(digits) || digits;
}

/**
 * Quando duas instâncias compartilham o mesmo chip, preferir o nome técnico
 * que coincide com o final do número (6635 em 555181076635) e nomes só-dígitos
 * (9224 em vez de soma-9224).
 */
export function scoreAquecedorDuplicateInstance(instanceName: string, numero: string): number {
  const name = String(instanceName || "").trim();
  const nameDigits = digitsOnly(name);
  const phone = aquecedorChipKeyFromNumber(numero);
  let score = 0;
  if (/^\d+$/.test(name)) score += 50;
  if (nameDigits.length >= 3 && phone.endsWith(nameDigits)) score += 100;
  if (/^soma-/i.test(name) || /proxy-/i.test(name)) score -= 25;
  return score;
}

export function dedupeAquecedorConnectedByNumber<T extends AquecedorConnectedRow>(rows: T[]): T[] {
  const best = new Map<string, T>();
  const withoutNumber: T[] = [];
  for (const row of rows) {
    const instancia = String(row?.instancia || "").trim();
    if (!instancia) continue;
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
    if (nextScore > curScore) best.set(canon, row);
  }

  const winners = new Set<T>(best.values());
  const out: T[] = [];
  const pushed = new Set<T>();
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
export function buildAquecedorChipIndex(
  connected: AquecedorConnectedRow[],
): AquecedorChipIndex {
  const chipToInstance = new Map<string, string>();
  const instanceToChip = new Map<string, string>();

  for (const item of connected) {
    const instancia = String(item.instancia || "").trim();
    const chip = aquecedorChipKeyFromNumber(item.numero);
    if (!instancia || !chip) continue;
    instanceToChip.set(instancia.toLowerCase(), chip);
    const current = chipToInstance.get(chip);
    if (
      !current ||
      scoreAquecedorDuplicateInstance(instancia, chip) >
        scoreAquecedorDuplicateInstance(current, chip)
    ) {
      chipToInstance.set(chip, instancia);
    }
  }

  const chips = Array.from(chipToInstance.keys()).sort((a, b) => a.localeCompare(b));
  return { chips, chipToInstance, instanceToChip };
}

export function resolveAquecedorInstanceToChip(
  instanceName: string,
  index: AquecedorChipIndex,
): string {
  const key = String(instanceName || "").trim().toLowerCase();
  if (!key) return "";
  return index.instanceToChip.get(key) || "";
}

export function resolveAquecedorNumberToChip(
  rawNumber: string,
  index: AquecedorChipIndex,
): string {
  const chip = aquecedorChipKeyFromNumber(rawNumber);
  if (!chip) return "";
  if (index.chipToInstance.has(chip)) return chip;
  for (const known of index.chips) {
    if (brazilWhatsAppNumbersMatch(known, chip)) return known;
  }
  return chip;
}

/** Mapa dígitos/variantes → chip (para resolver numero_destino histórico). */
export function buildAquecedorNumberVariantToChipMap(
  connected: AquecedorConnectedRow[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of connected) {
    const chip = aquecedorChipKeyFromNumber(item.numero);
    if (!chip) continue;
    for (const variant of expandBrazilWhatsAppNumberVariants(item.numero)) {
      map.set(variant, chip);
      map.set(variant.toLowerCase(), chip);
    }
    map.set(chip, chip);
  }
  return map;
}

export function resolveNumberVariantToChip(
  rawNumber: string,
  variantToChip: Map<string, string>,
): string {
  const digits = digitsOnly(rawNumber);
  if (!digits) return "";
  const direct = variantToChip.get(digits) || variantToChip.get(digits.toLowerCase());
  if (direct) return direct;
  const chip = aquecedorChipKeyFromNumber(digits);
  if (chip && (variantToChip.get(chip) || variantToChip.has(chip))) return chip;
  for (const [stored, mapped] of variantToChip.entries()) {
    if (/^\d+$/.test(stored) && brazilWhatsAppNumbersMatch(stored, digits)) return mapped;
  }
  return chip;
}
