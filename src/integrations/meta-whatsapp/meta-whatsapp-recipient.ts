export type CloudApiRecipientOk = { ok: true; waId: string };
export type CloudApiRecipientErr = { ok: false; error: string };

/**
 * Destinatário Cloud API (E.164 sem +).
 * Não acrescenta DDI, nono dígito nem 55. Não altera o número em silêncio.
 */
export function normalizeCloudApiRecipient(input: unknown): CloudApiRecipientOk | CloudApiRecipientErr {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return { ok: false, error: "Informe o número de destino." };
  }
  const stripped = raw.replace(/[\s().-]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(stripped)) {
    return {
      ok: false,
      error: "O destino deve conter apenas dígitos, com DDI. Ex.: 5551999887766",
    };
  }
  if (stripped.length < 8 || stripped.length > 15) {
    return {
      ok: false,
      error: "Informe o número com DDI (8 a 15 dígitos). Ex.: 5551999887766",
    };
  }
  if (stripped.startsWith("0")) {
    return {
      ok: false,
      error: "O número não deve começar com 0. Inclua o DDI (ex.: 55).",
    };
  }
  return { ok: true, waId: stripped };
}

export function normalizeTemplateLanguage(input: unknown): string | null {
  const raw = String(input ?? "").trim().replace(/-/g, "_");
  if (!/^[a-z]{2}(_[A-Za-z]{2})?$/.test(raw)) return null;
  const [lang, region] = raw.split("_");
  return region ? `${lang.toLowerCase()}_${region.toUpperCase()}` : lang.toLowerCase();
}
