const normalizeDigits = (value: string): string => value.replace(/\D/g, "");

const stripBrazilCountryCode = (digits: string): string => {
  let normalized = String(digits || "").replace(/\D/g, "");
  while (normalized.startsWith("55") && normalized.length > 11) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("55") && normalized.length === 11 && normalized.charAt(2) !== "9") {
    normalized = normalized.slice(2);
  }
  return normalized;
};

/** DDD + número fixo ou celular, só dígitos (10 ou 11). */
export const formatBrazilPhoneDigits = (raw: string): string => {
  let digits = stripBrazilCountryCode(normalizeDigits(raw));
  if (digits.length < 10 || digits.length > 11) {
    throw new Error("Informe um telefone válido com DDD (ex.: (11) 3333-4444 ou (11) 99999-9999).");
  }
  return digits;
};

/** DDD + número, só dígitos (ex.: 11999999999). */
export const formatBrazilMobileForAsaas = (raw: string): string => {
  const digits = stripBrazilCountryCode(normalizeDigits(raw));
  if (digits.length !== 11 || digits.charAt(2) !== "9") {
    throw new Error("Informe um celular válido com DDD (ex.: (11) 99999-9999).");
  }
  return digits;
};

/** WhatsApp do assinante: usa celular informado ou, se inválido, telefone celular válido. */
export const resolveSubscriberWhatsAppMobile = (whatsappRaw: string, phoneRaw: string): string => {
  try {
    return formatBrazilMobileForAsaas(whatsappRaw);
  } catch (whatsappError) {
    try {
      const phoneDigits = formatBrazilPhoneDigits(phoneRaw);
      if (phoneDigits.length === 11 && phoneDigits.charAt(2) === "9") {
        return phoneDigits;
      }
    } catch {
      /* ignore */
    }
    throw whatsappError;
  }
};
