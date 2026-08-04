/**
 * Origem dos créditos consumidos na geração da campanha.
 * Paid = pedido pago pelo cliente; Bonus = bônus de envio (admin), sem receita.
 */
export type WabaCampaignCreditFunding = {
  fromPaid: number;
  fromBonus: number;
};

export const normalizeCampaignCreditFunding = (
  value: unknown,
): WabaCampaignCreditFunding | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { fromPaid?: unknown; fromBonus?: unknown };
  const fromPaid = Math.max(0, Math.round(Number(raw.fromPaid ?? 0)));
  const fromBonus = Math.max(0, Math.round(Number(raw.fromBonus ?? 0)));
  if (fromPaid <= 0 && fromBonus <= 0) return undefined;
  return { fromPaid, fromBonus };
};

/**
 * Envios elegíveis a repasse do fornecedor.
 * Campanha 100% bônus → 0 (sem pagamento do cliente → sem split).
 * Mista → no máximo a parcela paga (crédito pago é consumido primeiro).
 * Sem funding gravado (legado / master ilimitado) → todos os enviados.
 */
export const resolveBillableSentForSupplierSplit = (intake: {
  creditFunding?: WabaCampaignCreditFunding | null;
  performanceReport?: { sent?: number } | null;
}): number => {
  const sent = Math.max(0, Math.round(Number(intake.performanceReport?.sent ?? 0)));
  if (sent <= 0) return 0;

  const funding = normalizeCampaignCreditFunding(intake.creditFunding);
  if (!funding) return sent;

  if (funding.fromPaid <= 0 && funding.fromBonus > 0) return 0;
  if (funding.fromPaid <= 0) return sent;
  return Math.min(sent, funding.fromPaid);
};

export const isBonusOnlyCampaignFunding = (
  funding: WabaCampaignCreditFunding | null | undefined,
): boolean => {
  const normalized = normalizeCampaignCreditFunding(funding);
  if (!normalized) return false;
  return normalized.fromPaid <= 0 && normalized.fromBonus > 0;
};

/** Statuses ainda em fila / execução — elegíveis ao backfill de bonificação legada. */
export const isOpenCampaignStatusForBonusBackfill = (status: unknown): boolean => {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  return normalized === "generated" || normalized === "in_progress";
};

/**
 * Marca campanha legada (sem creditFunding) como 100% bônus de envio.
 * Usado para a fila existente que foi gerada com bonificação antes do campo existir.
 */
export const buildLegacyBonusOnlyCreditFunding = (
  plannedSendCount: number,
): WabaCampaignCreditFunding => {
  const planned = Math.max(0, Math.round(Number(plannedSendCount ?? 0)));
  return { fromPaid: 0, fromBonus: Math.max(1, planned) };
};
