/**
 * Owners cujas campanhas/pedidos NÃO entram em:
 * - Dashboard Admin (métricas)
 * - Split / Financeiro (settlements e product metrics)
 * - Dashboard Disparos (visão consolidada master)
 */
export const WABA_METRICS_EXCLUDED_OWNER_EMAILS = [
  "mozart.pmo@gmail.com",
  "quantumivst@gmail.com",
  "walkup@walkuptec.com.br",
] as const;

const EXCLUDED_SET = new Set(
  WABA_METRICS_EXCLUDED_OWNER_EMAILS.map((email) => email.trim().toLowerCase()),
);

export const normalizeMetricsOwnerEmail = (email: string): string =>
  String(email || "")
    .trim()
    .toLowerCase();

export const isWabaMetricsExcludedOwnerEmail = (email: string): boolean => {
  const normalized = normalizeMetricsOwnerEmail(email);
  return Boolean(normalized) && EXCLUDED_SET.has(normalized);
};

export const filterOutMetricsExcludedOwners = <T extends { ownerEmail?: string | null }>(
  items: T[],
): T[] => items.filter((item) => !isWabaMetricsExcludedOwnerEmail(String(item.ownerEmail || "")));
