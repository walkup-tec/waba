import { toNonNegativeCents } from "../billing/waba-money-cents";

/** Comissão padrão do indicador, em centavos por envio (R$ 0,02). Editável no cadastro. */
export const DEFAULT_INDICATOR_COMMISSION_CENTS_PER_SEND = 2;

export const hasOwnCommissionInput = (value: unknown): boolean =>
  value !== undefined && value !== null && String(value).trim() !== "";

export const resolveIndicatorCommissionCentsPerSend = (
  value: unknown,
  fallback = DEFAULT_INDICATOR_COMMISSION_CENTS_PER_SEND,
): number => {
  if (!hasOwnCommissionInput(value)) return toNonNegativeCents(fallback);
  return toNonNegativeCents(value);
};
