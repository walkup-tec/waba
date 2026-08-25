const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export type BusinessHoursInput = {
  timezone?: string | null;
  businessDays?: number[] | null;
  businessStart?: string | null;
  businessEnd?: string | null;
};

export type BusinessHoursState = {
  configured: boolean;
  inside: boolean;
  timezone: string;
  isoDay: number;
  minutes: number;
};

function parseHm(value: string | null | undefined): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value || "").trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function zonedClock(timeZone: string, now: Date): { isoDay: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]));
  const isoDay = WEEKDAY_TO_ISO[String(parts.weekday || "Mon")] || 1;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    isoDay,
    minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
  };
}

export function evaluateBusinessHours(
  input: BusinessHoursInput,
  now: Date = new Date(),
): BusinessHoursState {
  const timezone = String(input.timezone || "America/Sao_Paulo").trim() || "America/Sao_Paulo";
  const days = (input.businessDays || []).map((d) => Number(d)).filter((d) => d >= 1 && d <= 7);
  const start = parseHm(input.businessStart);
  const end = parseHm(input.businessEnd);
  let clock: { isoDay: number; minutes: number };
  try {
    clock = zonedClock(timezone, now);
  } catch {
    clock = zonedClock("America/Sao_Paulo", now);
  }
  const configured = days.length > 0 && start != null && end != null && start !== end;
  if (!configured) {
    return { configured: false, inside: false, timezone, isoDay: clock.isoDay, minutes: clock.minutes };
  }
  if (!days.includes(clock.isoDay)) {
    return { configured: true, inside: false, timezone, isoDay: clock.isoDay, minutes: clock.minutes };
  }
  const inside =
    start < end
      ? clock.minutes >= start && clock.minutes < end
      : clock.minutes >= start || clock.minutes < end;
  return { configured: true, inside, timezone, isoDay: clock.isoDay, minutes: clock.minutes };
}
