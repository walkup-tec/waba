"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeiroServesCampaign = exports.financeiroRowServesCampaign = exports.mergeOperacionalSegmentLists = exports.listFinanceiroSegmentsForEmail = exports.toCampaignSupplierSegment = exports.toSupplierApiKind = exports.toSupplierSegment = void 0;
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const toSupplierSegment = (value) => String(value || "").trim().toLowerCase() === "bets" ? "bets" : "outros";
exports.toSupplierSegment = toSupplierSegment;
const toSupplierApiKind = (value) => String(value || "").trim().toLowerCase() === "alternativa" ? "alternativa" : "oficial";
exports.toSupplierApiKind = toSupplierApiKind;
const toCampaignSupplierSegment = (subscriberSegment) => (subscriberSegment === "bets" ? "bets" : "outros");
exports.toCampaignSupplierSegment = toCampaignSupplierSegment;
const isActiveSupplierRow = (row) => row.active !== false;
const listFinanceiroSegmentsForEmail = (suppliers, emailRaw) => {
    const email = normalizeEmail(emailRaw);
    if (!email)
        return [];
    const found = new Set();
    for (const row of suppliers ?? []) {
        if (!isActiveSupplierRow(row))
            continue;
        if (normalizeEmail(row.systemUserEmail) !== email)
            continue;
        found.add((0, exports.toSupplierSegment)(row.segment));
    }
    const ordered = [];
    if (found.has("bets"))
        ordered.push("bets");
    if (found.has("outros"))
        ordered.push("outros");
    return ordered;
};
exports.listFinanceiroSegmentsForEmail = listFinanceiroSegmentsForEmail;
const mergeOperacionalSegmentLists = (...lists) => {
    const found = new Set();
    for (const list of lists) {
        for (const item of list ?? []) {
            found.add(item === "bets" ? "bets" : "outros");
        }
    }
    const ordered = [];
    if (found.has("bets"))
        ordered.push("bets");
    if (found.has("outros"))
        ordered.push("outros");
    return ordered;
};
exports.mergeOperacionalSegmentLists = mergeOperacionalSegmentLists;
const financeiroRowServesCampaign = (row, emailRaw, apiKind, subscriberSegment) => {
    if (!isActiveSupplierRow(row))
        return false;
    if (normalizeEmail(row.systemUserEmail) !== normalizeEmail(emailRaw))
        return false;
    if ((0, exports.toSupplierApiKind)(row.apiKind) !== apiKind)
        return false;
    return (0, exports.toSupplierSegment)(row.segment) === (0, exports.toCampaignSupplierSegment)(subscriberSegment);
};
exports.financeiroRowServesCampaign = financeiroRowServesCampaign;
const financeiroServesCampaign = (suppliers, emailRaw, apiKind, subscriberSegment) => (suppliers ?? []).some((row) => (0, exports.financeiroRowServesCampaign)(row, emailRaw, apiKind, subscriberSegment));
exports.financeiroServesCampaign = financeiroServesCampaign;
