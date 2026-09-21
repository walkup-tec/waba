"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesManualBankPaidSplit = matchesManualBankPaidSplit;
exports.applyManualBankPaidSplit = applyManualBankPaidSplit;
exports.runManualBankPaidSplitOneshot = runManualBankPaidSplitOneshot;
const load_env_1 = require("../load-env");
const waba_financeiro_split_settlement_repository_1 = require("./waba-financeiro-split-settlement.repository");
/** Repasse do Erick Sales na NOSSO CONSIG de 09/09/2026: PIX Asaas falhou; pagamento feito no banco. */
const MANUAL_BANK_PAID_SPLIT_RULES = [
    {
        id: "nosso-consig-2026-09-09-erick",
        customerName: "NOSSO CONSIG",
        createdLocalDate: "2026-09-09",
        timezone: "America/Sao_Paulo",
        orderIdStartsWith: "4bbee4e0-f669",
        orderIdEndsWith: "dd8bfcbe4466",
        supplierLabel: "Erick Sales",
        supplierAmountCents: 8812,
    },
];
const normalizeName = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
const formatLocalDate = (iso, timezone) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const get = (type) => String(parts.find((part) => part.type === type)?.value || "");
    return `${get("year")}-${get("month")}-${get("day")}`;
};
const orderIdMatches = (orderId, rule) => {
    const id = String(orderId || "").trim().toLowerCase();
    if (!id)
        return false;
    return (id.startsWith(rule.orderIdStartsWith.toLowerCase()) &&
        id.endsWith(rule.orderIdEndsWith.toLowerCase()));
};
const supplierLineMatches = (settlement, rule) => settlement.lines.some((line) => line.lineKind === "supplier" &&
    normalizeName(line.participantLabel) === normalizeName(rule.supplierLabel) &&
    Math.round(Number(line.amountCents || 0)) === rule.supplierAmountCents);
function matchesManualBankPaidSplit(settlement) {
    for (const rule of MANUAL_BANK_PAID_SPLIT_RULES) {
        if (orderIdMatches(settlement.orderId, rule))
            return true;
        if (normalizeName(settlement.customerName) !== normalizeName(rule.customerName))
            continue;
        if (formatLocalDate(settlement.createdAt, rule.timezone) !== rule.createdLocalDate)
            continue;
        if (!supplierLineMatches(settlement, rule))
            continue;
        return true;
    }
    return false;
}
function applyManualBankPaidSplit(settlement, paidAt = new Date().toISOString()) {
    if (!matchesManualBankPaidSplit(settlement))
        return settlement;
    let changed = false;
    const lines = settlement.lines.map((line) => {
        if (line.lineKind !== "supplier")
            return line;
        if (line.payoutStatus === "paid")
            return line;
        changed = true;
        return {
            ...line,
            payoutStatus: "paid",
            paidAt: line.paidAt || paidAt,
            payoutExternalReference: line.payoutExternalReference || "manual-bank",
            failureReason: undefined,
        };
    });
    if (!changed) {
        const nextStatus = (0, waba_financeiro_split_settlement_repository_1.deriveSettlementPayoutStatus)(lines);
        if (nextStatus === settlement.payoutStatus)
            return settlement;
        return {
            ...settlement,
            lines,
            payoutStatus: nextStatus,
            payoutCompletedAt: nextStatus === "paid" ? settlement.payoutCompletedAt || paidAt : settlement.payoutCompletedAt,
        };
    }
    const payoutStatus = (0, waba_financeiro_split_settlement_repository_1.deriveSettlementPayoutStatus)(lines);
    return {
        ...settlement,
        lines,
        payoutStatus,
        payoutCompletedAt: payoutStatus === "paid" ? settlement.payoutCompletedAt || paidAt : settlement.payoutCompletedAt,
    };
}
function runManualBankPaidSplitOneshot(deps = {}) {
    const env = String(load_env_1.WABA_ENV || process.env.WABA_ENV || "").trim().toLowerCase();
    if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
        return {
            applied: 0,
            skipped: 0,
            orderIds: [],
            message: "oneshot ignorado em ambiente local",
        };
    }
    const repository = deps.settlementRepository || new waba_financeiro_split_settlement_repository_1.WabaFinanceiroSplitSettlementRepository();
    const now = deps.now || (() => new Date().toISOString());
    const orderIds = [];
    let skipped = 0;
    for (const settlement of repository.listAll()) {
        if (!matchesManualBankPaidSplit(settlement))
            continue;
        const next = applyManualBankPaidSplit(settlement, now());
        if (next === settlement) {
            skipped += 1;
            continue;
        }
        repository.save(next);
        orderIds.push(settlement.orderId);
    }
    return {
        applied: orderIds.length,
        skipped,
        orderIds,
        message: orderIds.length
            ? `Repasse manual do banco marcado como pago (${orderIds.join(", ")})`
            : skipped
                ? "Repasse manual do banco já estava concluído"
                : "Nenhum split pontual para marcar como pago no banco",
    };
}
