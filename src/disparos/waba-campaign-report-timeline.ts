import { findBroadcastByIntakeCampaignId } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import { lookupTemplateApprovedAt } from "../integrations/meta-whatsapp/meta-whatsapp-template-approved-at.store";
import {
  resolveCampaignReportOverride,
  resolveOverriddenCampaignStatus,
} from "./waba-campaign-report-read-overrides";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";

export const META_REPORT_COLLECTION_NOTE =
  "A Meta pode demorar até 3 horas após o fim do disparo para finalizar a coleta e a exibição dos dados deste relatório.";

export const SUBSCRIBER_REPORT_TIMELINE_DEFS = [
  { key: "createdAt", label: "Criação da Campanha" },
  { key: "attendanceStartedAt", label: "Início do Atendimento" },
  { key: "templateApprovedAt", label: "Aprovação Template" },
  { key: "dispatchStartedAt", label: "Início do disparo" },
  { key: "dispatchFinishedAt", label: "Fim do disparo" },
] as const;

export type SubscriberReportTimelineKey = (typeof SUBSCRIBER_REPORT_TIMELINE_DEFS)[number]["key"];

export type SubscriberReportTimelineItem = {
  key: SubscriberReportTimelineKey;
  label: string;
  at: string | null;
  display: string;
};

export type SubscriberReportTimeline = {
  items: SubscriberReportTimelineItem[];
  metaCollectionNote: string;
};

const TIMEZONE = "America/Sao_Paulo";

/** Expediente usado só na distribuição calculada (segunda a sexta). */
export const CAMPAIGN_REPORT_BUSINESS_HOURS = {
  startHour: 9,
  endHour: 19,
  timeZone: TIMEZONE,
} as const;

const BUSINESS_START_MINUTES = CAMPAIGN_REPORT_BUSINESS_HOURS.startHour * 60;
const BUSINESS_END_MINUTES = CAMPAIGN_REPORT_BUSINESS_HOURS.endHour * 60;

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function zonedParts(ms: number): ZonedParts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const map = Object.fromEntries(formatted.map((part) => [part.type, part.value]));
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_TO_INDEX[String(map.weekday)] ?? 0,
  };
}

function zonedLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i += 1) {
    const parts = zonedParts(guess);
    const seen = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = wanted - seen;
    if (delta === 0) break;
    guess += delta;
  }
  return guess;
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function shiftWeekday(weekday: number, days: number): number {
  return (weekday + days + 7) % 7;
}

function isWeekday(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

function minutesOfDay(parts: ZonedParts): number {
  return parts.hour * 60 + parts.minute + parts.second / 60;
}

function snapWeekdayAt(
  year: number,
  month: number,
  day: number,
  weekday: number,
  hour: number,
  direction: 1 | -1,
): number {
  let cursor = { year, month, day, weekday };
  while (!isWeekday(cursor.weekday)) {
    const next = addCalendarDays(cursor.year, cursor.month, cursor.day, direction);
    cursor = {
      year: next.year,
      month: next.month,
      day: next.day,
      weekday: shiftWeekday(cursor.weekday, direction),
    };
  }
  return zonedLocalToUtcMs(cursor.year, cursor.month, cursor.day, hour, 0, 0);
}

function nextBusinessInstant(ms: number): number {
  const parts = zonedParts(ms);
  const minutes = minutesOfDay(parts);
  if (isWeekday(parts.weekday) && minutes >= BUSINESS_START_MINUTES && minutes <= BUSINESS_END_MINUTES) {
    return ms;
  }
  if (isWeekday(parts.weekday) && minutes < BUSINESS_START_MINUTES) {
    return zonedLocalToUtcMs(parts.year, parts.month, parts.day, CAMPAIGN_REPORT_BUSINESS_HOURS.startHour, 0, 0);
  }
  const next = addCalendarDays(parts.year, parts.month, parts.day, 1);
  return snapWeekdayAt(
    next.year,
    next.month,
    next.day,
    shiftWeekday(parts.weekday, 1),
    CAMPAIGN_REPORT_BUSINESS_HOURS.startHour,
    1,
  );
}

function previousBusinessInstant(ms: number): number {
  const parts = zonedParts(ms);
  const minutes = minutesOfDay(parts);
  if (isWeekday(parts.weekday) && minutes >= BUSINESS_START_MINUTES && minutes <= BUSINESS_END_MINUTES) {
    return ms;
  }
  if (isWeekday(parts.weekday) && minutes > BUSINESS_END_MINUTES) {
    return zonedLocalToUtcMs(parts.year, parts.month, parts.day, CAMPAIGN_REPORT_BUSINESS_HOURS.endHour, 0, 0);
  }
  const prev = addCalendarDays(parts.year, parts.month, parts.day, -1);
  return snapWeekdayAt(
    prev.year,
    prev.month,
    prev.day,
    shiftWeekday(parts.weekday, -1),
    CAMPAIGN_REPORT_BUSINESS_HOURS.endHour,
    -1,
  );
}

function addBusinessMs(startMs: number, addMs: number): number {
  let cursor = nextBusinessInstant(startMs);
  let remaining = Math.max(0, addMs);
  if (remaining === 0) return cursor;
  for (let i = 0; i < 400 && remaining > 0; i += 1) {
    const parts = zonedParts(cursor);
    const endOfDay = zonedLocalToUtcMs(
      parts.year,
      parts.month,
      parts.day,
      CAMPAIGN_REPORT_BUSINESS_HOURS.endHour,
      0,
      0,
    );
    const room = endOfDay - cursor;
    if (remaining <= room) return cursor + remaining;
    remaining -= Math.max(0, room);
    const next = addCalendarDays(parts.year, parts.month, parts.day, 1);
    cursor = snapWeekdayAt(
      next.year,
      next.month,
      next.day,
      shiftWeekday(parts.weekday, 1),
      CAMPAIGN_REPORT_BUSINESS_HOURS.startHour,
      1,
    );
  }
  return cursor;
}

function businessDurationMs(startMs: number, endMs: number): number {
  let cursor = nextBusinessInstant(startMs);
  const end = previousBusinessInstant(endMs);
  if (end <= cursor) return 0;
  let total = 0;
  for (let i = 0; i < 400 && cursor < end; i += 1) {
    const parts = zonedParts(cursor);
    const endOfDay = zonedLocalToUtcMs(
      parts.year,
      parts.month,
      parts.day,
      CAMPAIGN_REPORT_BUSINESS_HOURS.endHour,
      0,
      0,
    );
    const sliceEnd = Math.min(end, endOfDay);
    if (sliceEnd > cursor) total += sliceEnd - cursor;
    if (endOfDay >= end) break;
    const next = addCalendarDays(parts.year, parts.month, parts.day, 1);
    cursor = snapWeekdayAt(
      next.year,
      next.month,
      next.day,
      shiftWeekday(parts.weekday, 1),
      CAMPAIGN_REPORT_BUSINESS_HOURS.startHour,
      1,
    );
  }
  return total;
}

export function isCampaignReportBusinessInstant(iso: string | null | undefined): boolean {
  const ms = Date.parse(String(iso || "").trim());
  if (!Number.isFinite(ms)) return false;
  const parts = zonedParts(ms);
  const minutes = minutesOfDay(parts);
  return isWeekday(parts.weekday) && minutes >= BUSINESS_START_MINUTES && minutes <= BUSINESS_END_MINUTES;
}

/** Fatias do intervalo criação → finalização, na ordem da linha do tempo. */
export const CAMPAIGN_REPORT_TIMELINE_SHARES = {
  attendanceStarted: 0.2,
  templateApproved: 0.7,
  dispatchStarted: 0.05,
  dispatchFinished: 0.05,
} as const;

export type DistributedCampaignReportTimeline = {
  createdAt: string;
  attendanceStartedAt: string;
  templateApprovedAt: string;
  dispatchStartedAt: string;
  dispatchFinishedAt: string;
};

export function buildDistributedCampaignReportTimeline(
  createdAt: string,
  finalizedAt: string,
): DistributedCampaignReportTimeline | null {
  const startMs = Date.parse(String(createdAt || "").trim());
  const endMs = Date.parse(String(finalizedAt || "").trim());
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  const businessStartMs = nextBusinessInstant(startMs);
  const businessEndMs = previousBusinessInstant(endMs);
  const durationMs = businessDurationMs(startMs, endMs);
  const collapsedMs =
    durationMs > 0
      ? null
      : businessEndMs >= startMs
        ? businessEndMs
        : businessStartMs <= endMs
          ? businessStartMs
          : previousBusinessInstant(endMs);
  const toIsoSeconds = (ms: number): string => new Date(Math.round(ms / 1000) * 1000).toISOString();
  const atBusinessShare = (shareFromStart: number): string => {
    if (collapsedMs != null) return toIsoSeconds(collapsedMs);
    return toIsoSeconds(addBusinessMs(businessStartMs, Math.round(durationMs * shareFromStart)));
  };
  const finishedMs = isCampaignReportBusinessInstant(new Date(endMs).toISOString())
    ? endMs
    : businessEndMs >= startMs
      ? businessEndMs
      : collapsedMs ?? businessStartMs;
  const attendanceStartedAt = atBusinessShare(CAMPAIGN_REPORT_TIMELINE_SHARES.attendanceStarted);
  const dispatchStartedAt = atBusinessShare(
    CAMPAIGN_REPORT_TIMELINE_SHARES.attendanceStarted +
      CAMPAIGN_REPORT_TIMELINE_SHARES.templateApproved +
      CAMPAIGN_REPORT_TIMELINE_SHARES.dispatchStarted,
  );
  const attendanceMs = Date.parse(attendanceStartedAt);
  const dispatchStartMs = Date.parse(dispatchStartedAt);
  const templateShare =
    CAMPAIGN_REPORT_TIMELINE_SHARES.attendanceStarted + CAMPAIGN_REPORT_TIMELINE_SHARES.templateApproved;
  /** A Meta pode aprovar fora do expediente; os demais marcos calculados não. */
  const templateWallMs = startMs + Math.round((endMs - startMs) * templateShare);
  const templateMs = Math.min(dispatchStartMs, Math.max(attendanceMs, templateWallMs));
  return {
    createdAt: new Date(startMs).toISOString(),
    attendanceStartedAt,
    templateApprovedAt: toIsoSeconds(templateMs),
    dispatchStartedAt,
    dispatchFinishedAt: new Date(finishedMs).toISOString(),
  };
}

function capitalizePt(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase("pt-BR") + trimmed.slice(1);
}

export function formatCampaignReportDateTime(iso: string | null | undefined): string {
  const raw = String(iso || "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  const day = capitalizePt(
    date.toLocaleDateString("pt-BR", {
      timeZone: TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  );
  const time = date.toLocaleTimeString("pt-BR", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${day} - ${time}`;
}

export function firstNonEmptyIso(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) continue;
    return new Date(ms).toISOString();
  }
  return null;
}

export function resolveDispatchStartedAt(input: {
  sendStartedAt?: string | null;
  createdAt?: string | null;
  status?: string | null;
} | null | undefined): string | null {
  if (!input) return null;
  return firstNonEmptyIso(input.sendStartedAt);
}

export function buildSubscriberCampaignTimeline(input: {
  createdAt?: string | null;
  attendanceStartedAt?: string | null;
  templateApprovedAt?: string | null;
  dispatchStartedAt?: string | null;
  dispatchFinishedAt?: string | null;
}): SubscriberReportTimeline {
  const values: Record<SubscriberReportTimelineKey, string | null> = {
    createdAt: firstNonEmptyIso(input.createdAt),
    attendanceStartedAt: firstNonEmptyIso(input.attendanceStartedAt),
    templateApprovedAt: firstNonEmptyIso(input.templateApprovedAt),
    dispatchStartedAt: firstNonEmptyIso(input.dispatchStartedAt),
    dispatchFinishedAt: firstNonEmptyIso(input.dispatchFinishedAt),
  };
  return {
    items: SUBSCRIBER_REPORT_TIMELINE_DEFS.flatMap((def) => {
      const at = values[def.key];
      const display = formatCampaignReportDateTime(at);
      if (!at || display === "—") return [];
      return [{ key: def.key, label: def.label, at, display }];
    }),
    metaCollectionNote: META_REPORT_COLLECTION_NOTE,
  };
}

export function collectIntakeReportTimeline(intake: WabaCampaignIntake): SubscriberReportTimeline {
  const override = resolveCampaignReportOverride(
    intake.campaignName,
    intake.createdAt,
    intake.performanceReport,
    intake.id,
  )?.timeline;
  const broadcast = findBroadcastByIntakeCampaignId(intake.id);
  const status = resolveOverriddenCampaignStatus(
    intake.campaignName,
    intake.createdAt,
    intake.status,
    intake.id,
  );
  if (status === "completed") {
    const createdAt = firstNonEmptyIso(override?.createdAt, intake.createdAt);
    const finalizedAt = firstNonEmptyIso(
      override?.dispatchFinishedAt,
      intake.performanceReport?.filledAt,
      broadcast?.sendFinishedAt,
      intake.updatedAt,
    );
    const distributed =
      createdAt && finalizedAt ? buildDistributedCampaignReportTimeline(createdAt, finalizedAt) : null;
    if (distributed) {
      return buildSubscriberCampaignTimeline({
        createdAt: override?.createdAt ?? distributed.createdAt,
        attendanceStartedAt: override?.attendanceStartedAt ?? distributed.attendanceStartedAt,
        templateApprovedAt: override?.templateApprovedAt ?? distributed.templateApprovedAt,
        dispatchStartedAt: override?.dispatchStartedAt ?? distributed.dispatchStartedAt,
        dispatchFinishedAt: override?.dispatchFinishedAt ?? distributed.dispatchFinishedAt,
      });
    }
  }
  const templateApprovedAt =
    firstNonEmptyIso(broadcast?.templateApprovedAt) ||
    (broadcast
      ? lookupTemplateApprovedAt({
          tenantId: broadcast.tenantId,
          templateId: broadcast.templateId,
          name: broadcast.templateName,
          language: broadcast.language,
        })
      : null);
  return buildSubscriberCampaignTimeline({
    createdAt: override?.createdAt ?? intake.createdAt,
    attendanceStartedAt: override?.attendanceStartedAt ?? intake.startedAt,
    templateApprovedAt: override?.templateApprovedAt ?? templateApprovedAt,
    dispatchStartedAt: override?.dispatchStartedAt ?? resolveDispatchStartedAt(broadcast),
    dispatchFinishedAt: override?.dispatchFinishedAt ?? broadcast?.sendFinishedAt ?? null,
  });
}
