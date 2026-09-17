"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLegacyBonusOnlyCreditFunding = exports.isOpenCampaignStatusForBonusBackfill = exports.isBonusOnlyCampaignFunding = exports.resolveBillableCountForSupplierSplit = exports.resolveBillableSentLegacyForSupplierSplit = exports.resolveBillableSentForSupplierSplit = exports.shouldDeferSplitUntilCampaignFinalize = exports.campaignUsesDeliveredSupplierSplitRule = exports.calendarDateYmdInSaoPaulo = exports.DELIVERED_SUPPLIER_SPLIT_RULE_START_YMD = exports.normalizeCampaignCreditFunding = void 0;
const normalizeCampaignCreditFunding = (value) => {
    if (!value || typeof value !== "object")
        return undefined;
    const raw = value;
    const fromPaid = Math.max(0, Math.round(Number(raw.fromPaid ?? 0)));
    const fromBonus = Math.max(0, Math.round(Number(raw.fromBonus ?? 0)));
    if (fromPaid <= 0 && fromBonus <= 0)
        return undefined;
    return { fromPaid, fromBonus };
};
exports.normalizeCampaignCreditFunding = normalizeCampaignCreditFunding;
/** Campanhas criadas neste dia civil (Brasília) em diante usam entregues no split. */
exports.DELIVERED_SUPPLIER_SPLIT_RULE_START_YMD = "2026-09-17";
const calendarDateYmdInSaoPaulo = (value) => {
    if (value == null || value === "")
        return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return "";
    return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
};
exports.calendarDateYmdInSaoPaulo = calendarDateYmdInSaoPaulo;
const campaignUsesDeliveredSupplierSplitRule = (createdAt) => {
    const ymd = (0, exports.calendarDateYmdInSaoPaulo)(createdAt);
    return Boolean(ymd) && ymd >= exports.DELIVERED_SUPPLIER_SPLIT_RULE_START_YMD;
};
exports.campaignUsesDeliveredSupplierSplitRule = campaignUsesDeliveredSupplierSplitRule;
/** Pedido pago neste dia em diante não inicia split — espera a campanha finalizar. */
const shouldDeferSplitUntilCampaignFinalize = (order) => (0, exports.campaignUsesDeliveredSupplierSplitRule)(order.paidAt || order.createdAt);
exports.shouldDeferSplitUntilCampaignFinalize = shouldDeferSplitUntilCampaignFinalize;
const applyPaidFundingCap = (count, funding) => {
    if (count <= 0)
        return 0;
    const normalized = (0, exports.normalizeCampaignCreditFunding)(funding);
    if (!normalized)
        return count;
    if (normalized.fromPaid <= 0 && normalized.fromBonus > 0)
        return 0;
    if (normalized.fromPaid <= 0)
        return count;
    return Math.min(count, normalized.fromPaid);
};
/**
 * Envios elegíveis a repasse do fornecedor (mensagens entregues).
 * Campanha 100% bônus → 0 (sem pagamento do cliente → sem split).
 * Mista → no máximo a parcela paga (crédito pago é consumido primeiro).
 * Sem funding gravado (legado / master ilimitado) → todas as entregues (limitadas por enviados/planejado).
 */
const resolveBillableSentForSupplierSplit = (intake) => {
    const sent = Math.max(0, Math.round(Number(intake.performanceReport?.sent ?? 0)));
    const delivered = Math.max(0, Math.round(Number(intake.performanceReport?.delivered ?? 0)));
    const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
    let count = delivered;
    if (sent > 0)
        count = Math.min(count, sent);
    if (planned > 0)
        count = Math.min(count, planned);
    return applyPaidFundingCap(count, intake.creditFunding);
};
exports.resolveBillableSentForSupplierSplit = resolveBillableSentForSupplierSplit;
/** Regra antiga: quantidade do fornecedor = enviados (não entregues). */
const resolveBillableSentLegacyForSupplierSplit = (intake) => {
    const sent = Math.max(0, Math.round(Number(intake.performanceReport?.sent ?? 0)));
    const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
    let count = sent;
    if (planned > 0)
        count = Math.min(count, planned);
    return applyPaidFundingCap(count, intake.creditFunding);
};
exports.resolveBillableSentLegacyForSupplierSplit = resolveBillableSentLegacyForSupplierSplit;
const resolveBillableCountForSupplierSplit = (intake) => {
    if ((0, exports.campaignUsesDeliveredSupplierSplitRule)(intake.createdAt)) {
        return (0, exports.resolveBillableSentForSupplierSplit)(intake);
    }
    return (0, exports.resolveBillableSentLegacyForSupplierSplit)(intake);
};
exports.resolveBillableCountForSupplierSplit = resolveBillableCountForSupplierSplit;
const isBonusOnlyCampaignFunding = (funding) => {
    const normalized = (0, exports.normalizeCampaignCreditFunding)(funding);
    if (!normalized)
        return false;
    return normalized.fromPaid <= 0 && normalized.fromBonus > 0;
};
exports.isBonusOnlyCampaignFunding = isBonusOnlyCampaignFunding;
/** Statuses ainda em fila / execução — elegíveis ao backfill de bonificação legada. */
const isOpenCampaignStatusForBonusBackfill = (status) => {
    const normalized = String(status ?? "")
        .trim()
        .toLowerCase();
    return normalized === "generated" || normalized === "in_progress";
};
exports.isOpenCampaignStatusForBonusBackfill = isOpenCampaignStatusForBonusBackfill;
/**
 * Marca campanha legada (sem creditFunding) como 100% bônus de envio.
 * Usado para a fila existente que foi gerada com bonificação antes do campo existir.
 */
const buildLegacyBonusOnlyCreditFunding = (plannedSendCount) => {
    const planned = Math.max(0, Math.round(Number(plannedSendCount ?? 0)));
    return { fromPaid: 0, fromBonus: Math.max(1, planned) };
};
exports.buildLegacyBonusOnlyCreditFunding = buildLegacyBonusOnlyCreditFunding;
