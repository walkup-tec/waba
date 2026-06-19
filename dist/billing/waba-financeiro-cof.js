"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFinanceiroCofCentsForPaidOrder = exports.resolveFinanceiroCofCentsPerOperation = void 0;
/** COF — custo de operação financeira (taxa Asaas por cobrança PIX recebida). */
const DEFAULT_COF_CENTS_PER_OPERATION = 298;
const resolveFinanceiroCofCentsPerOperation = () => {
    const raw = String(process.env.WABA_FINANCEIRO_COF_CENTS_PER_OPERATION ?? "").trim();
    if (raw) {
        const parsed = Math.round(Number(raw));
        if (Number.isFinite(parsed) && parsed >= 0)
            return parsed;
    }
    return DEFAULT_COF_CENTS_PER_OPERATION;
};
exports.resolveFinanceiroCofCentsPerOperation = resolveFinanceiroCofCentsPerOperation;
/** Uma operação = um pedido pago via PIX (cobrança Asaas). */
const resolveFinanceiroCofCentsForPaidOrder = () => (0, exports.resolveFinanceiroCofCentsPerOperation)();
exports.resolveFinanceiroCofCentsForPaidOrder = resolveFinanceiroCofCentsForPaidOrder;
