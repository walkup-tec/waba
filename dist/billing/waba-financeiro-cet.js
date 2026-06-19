"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFinanceiroCetCentsForPaidOrder = exports.resolveFinanceiroCetCentsPerOperation = void 0;
/** CET — Custo Efetivo Total (taxa Asaas por cobrança PIX recebida). */
const DEFAULT_CET_CENTS_PER_OPERATION = 298;
const resolveFinanceiroCetCentsPerOperation = () => {
    const raw = String(process.env.WABA_FINANCEIRO_CET_CENTS_PER_OPERATION ??
        process.env.WABA_FINANCEIRO_COF_CENTS_PER_OPERATION ??
        "").trim();
    if (raw) {
        const parsed = Math.round(Number(raw));
        if (Number.isFinite(parsed) && parsed >= 0)
            return parsed;
    }
    return DEFAULT_CET_CENTS_PER_OPERATION;
};
exports.resolveFinanceiroCetCentsPerOperation = resolveFinanceiroCetCentsPerOperation;
/** Uma operação = um pedido pago via PIX (cobrança Asaas). */
const resolveFinanceiroCetCentsForPaidOrder = () => (0, exports.resolveFinanceiroCetCentsPerOperation)();
exports.resolveFinanceiroCetCentsForPaidOrder = resolveFinanceiroCetCentsForPaidOrder;
