const normalizeDigits = (value: string): string => value.replace(/\D/g, "");

/** DDD + número fixo ou celular, só dígitos (10 ou 11). */
export const formatBrazilPhoneDigits = (raw: string): string => {
  let digits = normalizeDigits(raw);
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 11) {
    throw new Error("Informe um telefone válido com DDD (ex.: (11) 3333-4444 ou (11) 99999-9999).");
  }
  return digits;
};

/** DDD + número, só dígitos (ex.: 11999999999). */
export const formatBrazilMobileForAsaas = (raw: string): string => {
  let digits = normalizeDigits(raw);
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.length !== 11 || digits.charAt(2) !== "9") {
    throw new Error("Informe um celular válido com DDD (ex.: (11) 99999-9999).");
  }
  return digits;
};
