/** CET — Custo Efetivo Total (taxa Asaas por cobrança PIX recebida). */
const DEFAULT_CET_CENTS_PER_OPERATION = 298;

export const resolveFinanceiroCetCentsPerOperation = (): number => {
  const raw = String(
    process.env.WABA_FINANCEIRO_CET_CENTS_PER_OPERATION ??
      process.env.WABA_FINANCEIRO_COF_CENTS_PER_OPERATION ??
      "",
  ).trim();
  if (raw) {
    const parsed = Math.round(Number(raw));
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_CET_CENTS_PER_OPERATION;
};

/** Uma operação = um pedido pago via PIX (cobrança Asaas). */
export const resolveFinanceiroCetCentsForPaidOrder = (): number =>
  resolveFinanceiroCetCentsPerOperation();
