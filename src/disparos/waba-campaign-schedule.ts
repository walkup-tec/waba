const SCHEDULE_TZ = "America/Sao_Paulo";
const MIN_LEAD_MS = 60_000;

export const parseScheduledSendAt = (
  raw: unknown,
  options: { requireFuture?: boolean; nowMs?: number } = {},
): string => {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const parsedMs = Date.parse(value);
  if (!Number.isFinite(parsedMs)) {
    throw new Error("Informe uma data e hora válidas para o agendamento.");
  }
  if (options.requireFuture) {
    const nowMs = Number.isFinite(options.nowMs) ? Number(options.nowMs) : Date.now();
    if (parsedMs < nowMs + MIN_LEAD_MS) {
      throw new Error("O disparo precisa ser agendado pelo menos 1 minuto no futuro.");
    }
  }
  return new Date(parsedMs).toISOString();
};

export const isScheduledSendPending = (iso: string | null | undefined, nowMs = Date.now()): boolean => {
  const value = String(iso ?? "").trim();
  if (!value) return false;
  const parsedMs = Date.parse(value);
  return Number.isFinite(parsedMs) && parsedMs > nowMs;
};

export const formatScheduledSendLabel = (iso: string | null | undefined): string => {
  const value = String(iso ?? "").trim();
  if (!value) return "";
  const parsedMs = Date.parse(value);
  if (!Number.isFinite(parsedMs)) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: SCHEDULE_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(parsedMs));
  } catch {
    return new Date(parsedMs).toISOString();
  }
};
