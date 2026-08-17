"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLegacyBonusOnlyCreditFunding = exports.isOpenCampaignStatusForBonusBackfill = exports.isBonusOnlyCampaignFunding = exports.resolveBillableSentForSupplierSplit = exports.normalizeCampaignCreditFunding = void 0;
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
    if (count <= 0)
        return 0;
    const funding = (0, exports.normalizeCampaignCreditFunding)(intake.creditFunding);
    if (!funding)
        return count;
    if (funding.fromPaid <= 0 && funding.fromBonus > 0)
        return 0;
    if (funding.fromPaid <= 0)
        return count;
    return Math.min(count, funding.fromPaid);
};
exports.resolveBillableSentForSupplierSplit = resolveBillableSentForSupplierSplit;
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
