import type {
  WabaCampaignIntakeStatus,
  WabaCampaignPerformanceReport,
} from "./waba-campaign-intake.repository";
import { findBroadcastByIntakeCampaignId } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import { isCloudBroadcastInactiveForRetry } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast-void";
import { normalizeCampaignIntakeStatus } from "./waba-campaign-intake-status";

type CampaignReportFingerprint = {
  totalLeads: number;
  sent: number;
  delivered?: number;
  failed?: number;
};

type CampaignReportOverride = {
  name: string;
  createdLocalDate?: string;
  createdLocalTime?: string;
  timezone?: string;
  fingerprint?: CampaignReportFingerprint;
  /** Casa só o nome normalizado, sem fingerprint/data. */
  matchExactName?: boolean;
  sent?: number;
  delivered?: number;
  read?: number;
  failed?: number;
  clicks?: number;
  hideClicks?: boolean;
  /** Força o card/taxa de cliques neste relatório, mesmo sem Disparo Cloud. */
  showClicks?: boolean;
  /** Linha do tempo só de leitura (America/Sao_Paulo convertida para ISO). */
  timeline?: {
    createdAt?: string;
    attendanceStartedAt?: string;
    templateApprovedAt?: string;
    dispatchStartedAt?: string;
    dispatchFinishedAt?: string;
  };
  /** Assinante vê Em andamento; o fechamento automático do relatório Meta não roda. */
  holdSubscriberInProgress?: boolean;
  /** Assinante/operacional veem Finalizado e o oneshot persiste o fechamento só desta campanha. */
  forceCompleted?: boolean;
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
  {
    name: "Opt in PTX",
    matchExactName: true,
    sent: 825,
    delivered: 695,
    read: 417,
    failed: 120,
    clicks: 47,
    showClicks: true,
    timeline: {
      createdAt: "2026-09-07T18:03:00.000Z",
      attendanceStartedAt: "2026-09-08T10:00:00.000Z",
      templateApprovedAt: "2026-09-11T18:40:00.000Z",
      dispatchStartedAt: "2026-09-11T19:00:00.000Z",
      dispatchFinishedAt: "2026-09-11T19:12:00.000Z",
    },
  },
  {
    name: "Convite para base Jandira",
    matchExactName: true,
    sent: 1652,
    delivered: 1553,
    read: 931,
    failed: 79,
    clicks: 130,
    showClicks: true,
    timeline: {
      createdAt: "2026-09-07T18:03:00.000Z",
      attendanceStartedAt: "2026-09-08T10:15:00.000Z",
      templateApprovedAt: "2026-09-11T19:35:00.000Z",
      dispatchStartedAt: "2026-09-11T19:50:00.000Z",
      dispatchFinishedAt: "2026-09-11T20:22:00.000Z",
    },
  },
  {
    name: "NOSSO CONSIG 1",
    fingerprint: { totalLeads: 2504, sent: 2203, delivered: 2064, failed: 301 },
    clicks: 144,
    showClicks: true,
    timeline: {
      dispatchFinishedAt: "2026-09-18T13:30:00.000Z",
    },
  },
  {
    name: "Tocantins_V01",
    createdLocalDate: "2026-09-21",
    timezone: "America/Sao_Paulo",
    clicks: 3,
    showClicks: true,
  },
  {
    name: "VITORIA DA CONQUISTA",
    matchExactName: true,
    forceCompleted: true,
    sent: 907,
    delivered: 782,
    read: 484,
    failed: 86,
    showClicks: true,
    timeline: {
      createdAt: "2026-09-08T21:01:00.000Z",
      attendanceStartedAt: "2026-09-09T18:34:00.000Z",
      templateApprovedAt: "2026-09-10T21:01:00.000Z",
      dispatchStartedAt: "2026-09-14T15:01:00.000Z",
      dispatchFinishedAt: "2026-09-14T15:17:00.000Z",
    },
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
  if (fingerprint.delivered != null && roundMetric(report.delivered) !== fingerprint.delivered) {
    return false;
  }
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
  if (rule.matchExactName) {
    return normalizeCampaignName(campaignName) === normalizeCampaignName(rule.name);
  }
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
): boolean => {
  if (!resolveCampaignReportOverride(campaignName, createdAt, null, intakeId)?.holdSubscriberInProgress) {
    return false;
  }
  const active = String(intakeId || "").trim()
    ? findBroadcastByIntakeCampaignId(intakeId as string)
    : null;
  if (active && !isCloudBroadcastInactiveForRetry(active)) return false;
  return true;
};

export const campaignForcesCompleted = (
  campaignName: string,
  createdAt: string,
  intakeId?: string,
): boolean =>
  Boolean(resolveCampaignReportOverride(campaignName, createdAt, null, intakeId)?.forceCompleted);

export const resolveOverriddenCampaignStatus = (
  campaignName: string,
  createdAt: string,
  storedStatus: string,
  intakeId?: string,
): WabaCampaignIntakeStatus => {
  if (campaignHoldsSubscriberInProgress(campaignName, createdAt, intakeId)) return "in_progress";
  if (campaignForcesCompleted(campaignName, createdAt, intakeId)) return "completed";
  return normalizeCampaignIntakeStatus(storedStatus);
};

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

export const campaignReportShowsClicks = (
  campaignName: string,
  createdAt: string,
  report?: WabaCampaignPerformanceReport | null,
): boolean => Boolean(resolveCampaignReportOverride(campaignName, createdAt, report)?.showClicks);

export const applyCampaignReportReadOverride = (
  campaignName: string,
  createdAt: string,
  report: WabaCampaignPerformanceReport | null | undefined,
): WabaCampaignPerformanceReport | null | undefined => {
  const rule = resolveCampaignReportOverride(campaignName, createdAt, report);
  if (!rule) return report;

  const base: WabaCampaignPerformanceReport = report || {
    totalLeads: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    clicks: 0,
    source: "manual",
    filledAt: "",
    filledByEmail: "",
  };
  const nextSent = rule.sent != null ? rule.sent : base.sent;
  const nextDelivered = rule.delivered != null ? rule.delivered : base.delivered;
  const nextRead = rule.read != null ? rule.read : base.read;
  const nextFailed = rule.failed != null ? rule.failed : base.failed;
  const nextClicks = rule.clicks != null ? rule.clicks : base.clicks;
  if (
    report &&
    nextSent === report.sent &&
    nextDelivered === report.delivered &&
    nextRead === report.read &&
    nextFailed === report.failed &&
    nextClicks === report.clicks
  ) {
    return report;
  }
  return {
    ...base,
    sent: nextSent,
    delivered: nextDelivered,
    read: nextRead,
    failed: nextFailed,
    clicks: nextClicks,
  };
};
