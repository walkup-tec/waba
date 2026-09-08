"use strict";
/** Valores monetários do WABA são sempre inteiros em centavos. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitCentsFromTotal = exports.multiplyCents = exports.toNonNegativeCents = exports.toCents = void 0;
const toCents = (value) => {
    const n = Math.round(Number(value ?? 0));
    return Number.isFinite(n) ? n : 0;
};
exports.toCents = toCents;
const toNonNegativeCents = (value) => Math.max(0, (0, exports.toCents)(value));
exports.toNonNegativeCents = toNonNegativeCents;
const multiplyCents = (unitCents, quantity) => {
    const unit = (0, exports.toNonNegativeCents)(unitCents);
    const qty = Math.max(0, Math.round(Number(quantity ?? 0)));
    if (!qty)
        return 0;
    return unit * qty;
};
exports.multiplyCents = multiplyCents;
const unitCentsFromTotal = (totalCents, quantity) => {
    const total = (0, exports.toNonNegativeCents)(totalCents);
    const qty = Math.max(0, Math.round(Number(quantity ?? 0)));
    if (!qty)
        return 0;
    return Math.round(total / qty);
};
exports.unitCentsFromTotal = unitCentsFromTotal;
