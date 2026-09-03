import type { WabaCampaignPerformanceReport } from "./waba-campaign-intake.repository";

type CampaignReportFingerprint = {
  totalLeads: number;
  sent: number;
  failed?: number;
};

type CampaignReportOverride = {
  name: string;
  createdLocalDate?: string;
  createdLocalTime?: string;
  timezone?: string;
  fingerprint?: CampaignReportFingerprint;
  delivered?: number;
  read?: number;
  hideClicks?: boolean;
  /** Assinante vê Em andamento; o fechamento automático do relatório Meta não roda. */
  holdSubscriberInProgress?: boolean;
  intakeId?: string;
};

const CAMPAIGN_REPORT_OVERRIDES: CampaignReportOverride[] = [
  {
    name: "SQUARE RESIDENCIAL",
    createdLocalDate: "2026-08-14",
    createdLocalTime: "15:54",
    timezone: "America/Sao_Paulo",
    read: 480,
  },
  {
    name: "6 DE AGOSTO",
    createdLocalDate: "2026-08-14",
    createdLocalTime: "15:54",
    timezone: "America/Sao_Paulo",
    read: 518,
  },
  {
    name: "Campanha Jandira",
    fingerprint: { totalLeads: 1990, sent: 1156, failed: 2 },
    delivered: 981,
    read: 431,
    hideClicks: true,
  },
  {
    name: "Campanha Jandira 2",
    createdLocalDate: "2026-09-03",
    timezone: "America/Sao_Paulo",
    holdSubscriberInProgress: true,
    intakeId: "368d053b-d59b-4eed-a235-fe9e9f32c68c",
  },
];

const normalizeCampaignName = (value: string): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/RESEIDENCIAL/g, "RESIDENCIAL")
    .replace(/\s+/g, " ")
    .replace(/\b0+(\d+)\b/g, "$1")
    .trim();

const formatLocalStamp = (iso: string, timezone: string): { date: string; time: string } => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    String(parts.find((part) => part.type === type)?.value || "");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
};

const namesMatch = (campaignName: string, targetName: string): boolean => {
  const left = normalizeCampaignName(campaignName);
  const right = normalizeCampaignName(targetName);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

const roundMetric = (value: unknown): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const fingerprintMatches = (
  report: WabaCampaignPerformanceReport,
  fingerprint: CampaignReportFingerprint,
): boolean => {
  if (roundMetric(report.totalLeads) !== fingerprint.totalLeads) return false;
  if (roundMetric(report.sent) !== fingerprint.sent) return false;
  if (fingerprint.failed != null && roundMetric(report.failed) !== fingerprint.failed) return false;
  return true;
};

const ruleMatches = (
  rule: CampaignReportOverride,
  campaignName: string,
  createdAt: string,
  report?: WabaCampaignPerformanceReport | null,
  intakeId?: string,
): boolean => {
  if (rule.intakeId && String(intakeId || "").trim() === rule.intakeId) return true;
  if (!namesMatch(campaignName, rule.name)) return false;
  if (rule.holdSubscriberInProgress) {
    const left = normalizeCampaignName(campaignName);
    const right = normalizeCampaignName(rule.name);
    if (!left.includes(right)) return false;
  }
  if (!rule.createdLocalDate && !rule.fingerprint) return false;

  if (rule.createdLocalDate) {
    const created = String(createdAt || "").trim();
    if (!created) return false;
    const stamp = formatLocalStamp(created, rule.timezone || "America/Sao_Paulo");
    if (stamp.date !== rule.createdLocalDate) return false;
  }

  if (rule.fingerprint) {
    if (!report) return false;
    if (!fingerprintMatches(report, rule.fingerprint)) return false;
  }

  return true;
};

export const resolveCampaignReportOverride = (
  campaignName: string,
  createdAt: string,
  report?: WabaCampaignPerformanceReport | null,
  intakeId?: string,
): CampaignReportOverride | null => {
  const name = String(campaignName || "").trim();
  const id = String(intakeId || "").trim();
  if (!name && !id) return null;
  for (const rule of CAMPAIGN_REPORT_OVERRIDES) {
    if (ruleMatches(rule, name, createdAt, report, id)) return rule;
  }
  return null;
};

export const campaignHoldsSubscriberInProgress = (
  campaignName: string,
  createdAt: string,
  intakeId?: string,
): boolean =>
  Boolean(resolveCampaignReportOverride(campaignName, createdAt, null, intakeId)?.holdSubscriberInProgress);

export const resolveCampaignReportReadOverride = (
  campaignName: string,
  createdAt: string,
  report?: WabaCampaignPerformanceReport | null,
): number | null => {
  const rule = resolveCampaignReportOverride(campaignName, createdAt, report);
  return rule?.read ?? null;
};

export const campaignReportHidesClicks = (
  campaignName: string,
  createdAt: string,
  report?: WabaCampaignPerformanceReport | null,
): boolean => Boolean(resolveCampaignReportOverride(campaignName, createdAt, report)?.hideClicks);

export const applyCampaignReportReadOverride = (
  campaignName: string,
  createdAt: string,
  report: WabaCampaignPerformanceReport | null | undefined,
): WabaCampaignPerformanceReport | null | undefined => {
  if (!report) return report;
  const rule = resolveCampaignReportOverride(campaignName, createdAt, report);
  if (!rule) return report;

  const nextDelivered = rule.delivered != null ? rule.delivered : report.delivered;
  const nextRead = rule.read != null ? rule.read : report.read;
  if (nextDelivered === report.delivered && nextRead === report.read) return report;
  return { ...report, delivered: nextDelivered, read: nextRead };
};
