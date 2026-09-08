/** Valores monetários do WABA são sempre inteiros em centavos. */

export const toCents = (value: unknown): number => {
  const n = Math.round(Number(value ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export const toNonNegativeCents = (value: unknown): number => Math.max(0, toCents(value));

export const multiplyCents = (unitCents: number, quantity: number): number => {
  const unit = toNonNegativeCents(unitCents);
  const qty = Math.max(0, Math.round(Number(quantity ?? 0)));
  if (!qty) return 0;
  return unit * qty;
};

export const unitCentsFromTotal = (totalCents: number, quantity: number): number => {
  const total = toNonNegativeCents(totalCents);
  const qty = Math.max(0, Math.round(Number(quantity ?? 0)));
  if (!qty) return 0;
  return Math.round(total / qty);
};
