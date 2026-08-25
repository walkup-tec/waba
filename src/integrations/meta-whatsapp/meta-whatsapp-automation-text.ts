/**
 * Normalização básica para KEYWORD / EXACT_TEXT.
 * Sem regex do frontend: matching literal após trim, case-insensitive e sem acento.
 */
export function normalizeAutomationText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function keywordMatches(messageText: unknown, triggerValue: unknown): boolean {
  const haystack = normalizeAutomationText(messageText);
  const raw = String(triggerValue || "");
  if (!haystack || !raw.trim()) return false;
  const needles = raw
    .split(",")
    .map((part) => normalizeAutomationText(part))
    .filter(Boolean);
  return needles.some((needle) => haystack.includes(needle));
}

export function exactTextMatches(messageText: unknown, triggerValue: unknown): boolean {
  const left = normalizeAutomationText(messageText);
  const right = normalizeAutomationText(triggerValue);
  return Boolean(left) && left === right;
}
