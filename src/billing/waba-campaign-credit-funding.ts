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

/** Pedidos/campanhas deste dia civil (Brasília) em diante adiám o split até finalizar. */
export const DELIVERED_SUPPLIER_SPLIT_RULE_START_YMD = "2026-09-17";

export const calendarDateYmdInSaoPaulo = (value: string | Date | null | undefined): string => {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
};

export const campaignUsesDeliveredSupplierSplitRule = (
  createdAt: string | Date | null | undefined,
): boolean => {
  const ymd = calendarDateYmdInSaoPaulo(createdAt);
  return Boolean(ymd) && ymd >= DELIVERED_SUPPLIER_SPLIT_RULE_START_YMD;
};

/** Pedido pago neste dia em diante não inicia split — espera a campanha finalizar. */
export const shouldDeferSplitUntilCampaignFinalize = (order: {
  paidAt?: string | null;
  createdAt?: string | null;
}): boolean => campaignUsesDeliveredSupplierSplitRule(order.paidAt || order.createdAt);

type SupplierSplitIntake = {
  createdAt?: string | Date | null;
  creditFunding?: WabaCampaignCreditFunding | null;
  performanceReport?: { sent?: number; delivered?: number } | null;
  plannedSendCount?: number;
};

const applyPaidFundingCap = (
  count: number,
  funding: WabaCampaignCreditFunding | null | undefined,
): number => {
  if (count <= 0) return 0;
  const normalized = normalizeCampaignCreditFunding(funding);
  if (!normalized) return count;
  if (normalized.fromPaid <= 0 && normalized.fromBonus > 0) return 0;
  if (normalized.fromPaid <= 0) return count;
  return Math.min(count, normalized.fromPaid);
};

/**
 * Envios elegíveis a repasse do fornecedor (mensagens enviadas).
 * Campanha 100% bônus → 0 (sem pagamento do cliente → sem split).
 * Mista → no máximo a parcela paga (crédito pago é consumido primeiro).
 * Sem funding gravado (legado / master ilimitado) → todos os enviados (limitados pelo planejado).
 */
export const resolveBillableSentForSupplierSplit = (intake: SupplierSplitIntake): number => {
  const sent = Math.max(0, Math.round(Number(intake.performanceReport?.sent ?? 0)));
  const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
  let count = sent;
  if (planned > 0) count = Math.min(count, planned);
  return applyPaidFundingCap(count, intake.creditFunding);
};

/** Alias estável: quantidade do fornecedor = enviados. */
export const resolveBillableSentLegacyForSupplierSplit = resolveBillableSentForSupplierSplit;

export const resolveBillableCountForSupplierSplit = (intake: SupplierSplitIntake): number =>
  resolveBillableSentForSupplierSplit(intake);

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
