export type BotExpedienteTurnoId = "bom_dia" | "boa_tarde" | "boa_noite";

export type BotExpedienteTurno = {
  id: BotExpedienteTurnoId;
  label: string;
  handle: BotExpedienteTurnoId;
  hour: number;
  minute: number;
  timeLabel: string;
};

const BRASILIA_TZ = "America/Sao_Paulo";

export function getBrasiliaParts(now = new Date()): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRASILIA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return { hour, minute };
}

export function resolveBrasiliaExpedienteTurno(now = new Date()): BotExpedienteTurno {
  const { hour, minute } = getBrasiliaParts(now);
  const total = hour * 60 + minute;
  let id: BotExpedienteTurnoId;
  let label: string;
  if (total >= 1 && total <= 12 * 60) {
    id = "bom_dia";
    label = "Bom dia";
  } else if (total >= 12 * 60 + 1 && total <= 18 * 60) {
    id = "boa_tarde";
    label = "Boa tarde";
  } else {
    id = "boa_noite";
    label = "Boa noite";
  }
  const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { id, label, handle: id, hour, minute, timeLabel };
}
