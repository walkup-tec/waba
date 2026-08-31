import type { WabaCampaignPerformanceReport } from "./waba-campaign-intake.repository";

type CampaignReadOverride = {
  name: string;
  createdLocalDate: string;
  createdLocalTime?: string;
  timezone: string;
  read: number;
};

const CAMPAIGN_REPORT_READ_OVERRIDES: CampaignReadOverride[] = [
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

export const resolveCampaignReportReadOverride = (
  campaignName: string,
  createdAt: string,
): number | null => {
  const name = String(campaignName || "").trim();
  const created = String(createdAt || "").trim();
  if (!name || !created) return null;

  for (const rule of CAMPAIGN_REPORT_READ_OVERRIDES) {
    if (!namesMatch(name, rule.name)) continue;
    const stamp = formatLocalStamp(created, rule.timezone);
    if (stamp.date !== rule.createdLocalDate) continue;
    return rule.read;
  }
  return null;
};

export const applyCampaignReportReadOverride = (
  campaignName: string,
  createdAt: string,
  report: WabaCampaignPerformanceReport | null | undefined,
): WabaCampaignPerformanceReport | null | undefined => {
  if (!report) return report;
  const nextRead = resolveCampaignReportReadOverride(campaignName, createdAt);
  if (nextRead == null || nextRead === report.read) return report;
  return { ...report, read: nextRead };
};
