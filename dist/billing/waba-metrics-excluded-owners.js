"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterOutMetricsExcludedOwners = exports.isWabaMetricsExcludedOwnerEmail = exports.normalizeMetricsOwnerEmail = exports.WABA_METRICS_EXCLUDED_OWNER_EMAILS = void 0;
/**
 * Owners cujas campanhas/pedidos NÃO entram em:
 * - Dashboard Admin (métricas)
 * - Split / Financeiro (settlements e product metrics)
 * - Dashboard Disparos (visão consolidada master)
 */
exports.WABA_METRICS_EXCLUDED_OWNER_EMAILS = [
    "mozart.pmo@gmail.com",
    "quantumivst@gmail.com",
    "walkup@walkuptec.com.br",
];
const EXCLUDED_SET = new Set(exports.WABA_METRICS_EXCLUDED_OWNER_EMAILS.map((email) => email.trim().toLowerCase()));
const normalizeMetricsOwnerEmail = (email) => String(email || "")
    .trim()
    .toLowerCase();
exports.normalizeMetricsOwnerEmail = normalizeMetricsOwnerEmail;
const isWabaMetricsExcludedOwnerEmail = (email) => {
    const normalized = (0, exports.normalizeMetricsOwnerEmail)(email);
    return Boolean(normalized) && EXCLUDED_SET.has(normalized);
};
exports.isWabaMetricsExcludedOwnerEmail = isWabaMetricsExcludedOwnerEmail;
const filterOutMetricsExcludedOwners = (items) => items.filter((item) => !(0, exports.isWabaMetricsExcludedOwnerEmail)(String(item.ownerEmail || "")));
exports.filterOutMetricsExcludedOwners = filterOutMetricsExcludedOwners;
