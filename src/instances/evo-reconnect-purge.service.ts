import {
  brazilWhatsAppNumbersMatch,
  extractPhoneFromEvoListItem,
  normalizeEvoWhatsAppNumber,
} from "./evo-instance-phone.service";

export type EvoPhoneInstanceHit = {
  instanceName: string;
  phone: string;
};

/**
 * Reconexão do mesmo número: apaga clones e sessão antiga na Evolution.
 * Preserva no WABA: foguinhos (lifecycle) e totais de mensagens (logs_envios).
 */
export function collectEvoInstancesSharingPhone(
  instances: unknown[],
  phone: string,
): EvoPhoneInstanceHit[] {
  const want = normalizeEvoWhatsAppNumber(phone);
  if (!want) return [];
  const list = Array.isArray(instances) ? instances : [];
  const out: EvoPhoneInstanceHit[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const row = extractPhoneFromEvoListItem(item);
    if (!row?.instanceName || !row.phone) continue;
    if (!brazilWhatsAppNumbersMatch(want, row.phone)) continue;
    const key = row.instanceName.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ instanceName: row.instanceName.trim(), phone: row.phone });
  }
  return out;
}

export function splitCanonicalAndDuplicateNames(
  hits: EvoPhoneInstanceHit[],
  canonicalName: string,
): { canonical: string; duplicates: string[] } {
  const canonical = String(canonicalName || "").trim();
  const canonicalLc = canonical.toLowerCase();
  const duplicates = hits
    .map((h) => h.instanceName)
    .filter((n) => n.toLowerCase() !== canonicalLc);
  return { canonical, duplicates };
}
