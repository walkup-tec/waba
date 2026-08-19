"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierCoversCampaignSegment = exports.normalizeWabaSupplierSegment = exports.WABA_SUPPLIER_SEGMENT_LABELS = void 0;
exports.WABA_SUPPLIER_SEGMENT_LABELS = {
    bets: "Bets",
    outros: "Outros",
};
const normalizeWabaSupplierSegment = (value) => {
    const raw = String(value ?? "")
        .trim()
        .toLowerCase();
    if (raw === "bets" || raw === "bet")
        return "bets";
    if (raw === "outros" || raw === "outro" || raw === "todos")
        return "outros";
    return null;
};
exports.normalizeWabaSupplierSegment = normalizeWabaSupplierSegment;
/** Fornecedor Bets atende campanhas Bets e Outros; Outros atende somente Outros. */
const supplierCoversCampaignSegment = (supplierSegment, campaignSegment) => {
    if (supplierSegment === "bets")
        return true;
    return campaignSegment === "outros";
};
exports.supplierCoversCampaignSegment = supplierCoversCampaignSegment;
