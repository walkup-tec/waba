"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCampaignReportReadOverride = exports.campaignReportHidesClicks = exports.resolveCampaignReportReadOverride = exports.campaignHoldsSubscriberInProgress = exports.resolveCampaignReportOverride = void 0;
const CAMPAIGN_REPORT_OVERRIDES = [
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
const normalizeCampaignName = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/RESEIDENCIAL/g, "RESIDENCIAL")
    .replace(/\s+/g, " ")
    .replace(/\b0+(\d+)\b/g, "$1")
    .trim();
const formatLocalStamp = (iso, timezone) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return { date: "", time: "" };
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const get = (type) => String(parts.find((part) => part.type === type)?.value || "");
    return {
        date: `${get("year")}-${get("month")}-${get("day")}`,
        time: `${get("hour")}:${get("minute")}`,
    };
};
const namesMatch = (campaignName, targetName) => {
    const left = normalizeCampaignName(campaignName);
    const right = normalizeCampaignName(targetName);
    if (!left || !right)
        return false;
    return left === right || left.includes(right) || right.includes(left);
};
const roundMetric = (value) => {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0)
        return 0;
    return parsed;
};
const fingerprintMatches = (report, fingerprint) => {
    if (roundMetric(report.totalLeads) !== fingerprint.totalLeads)
        return false;
    if (roundMetric(report.sent) !== fingerprint.sent)
        return false;
    if (fingerprint.failed != null && roundMetric(report.failed) !== fingerprint.failed)
        return false;
    return true;
};
const ruleMatches = (rule, campaignName, createdAt, report, intakeId) => {
    if (rule.intakeId && String(intakeId || "").trim() === rule.intakeId)
        return true;
    if (!namesMatch(campaignName, rule.name))
        return false;
    if (rule.holdSubscriberInProgress) {
        const left = normalizeCampaignName(campaignName);
        const right = normalizeCampaignName(rule.name);
        if (!left.includes(right))
            return false;
    }
    if (!rule.createdLocalDate && !rule.fingerprint)
        return false;
    if (rule.createdLocalDate) {
        const created = String(createdAt || "").trim();
        if (!created)
            return false;
        const stamp = formatLocalStamp(created, rule.timezone || "America/Sao_Paulo");
        if (stamp.date !== rule.createdLocalDate)
            return false;
    }
    if (rule.fingerprint) {
        if (!report)
            return false;
        if (!fingerprintMatches(report, rule.fingerprint))
            return false;
    }
    return true;
};
const resolveCampaignReportOverride = (campaignName, createdAt, report, intakeId) => {
    const name = String(campaignName || "").trim();
    const id = String(intakeId || "").trim();
    if (!name && !id)
        return null;
    for (const rule of CAMPAIGN_REPORT_OVERRIDES) {
        if (ruleMatches(rule, name, createdAt, report, id))
            return rule;
    }
    return null;
};
exports.resolveCampaignReportOverride = resolveCampaignReportOverride;
const campaignHoldsSubscriberInProgress = (campaignName, createdAt, intakeId) => Boolean((0, exports.resolveCampaignReportOverride)(campaignName, createdAt, null, intakeId)?.holdSubscriberInProgress);
exports.campaignHoldsSubscriberInProgress = campaignHoldsSubscriberInProgress;
const resolveCampaignReportReadOverride = (campaignName, createdAt, report) => {
    const rule = (0, exports.resolveCampaignReportOverride)(campaignName, createdAt, report);
    return rule?.read ?? null;
};
exports.resolveCampaignReportReadOverride = resolveCampaignReportReadOverride;
const campaignReportHidesClicks = (campaignName, createdAt, report) => Boolean((0, exports.resolveCampaignReportOverride)(campaignName, createdAt, report)?.hideClicks);
exports.campaignReportHidesClicks = campaignReportHidesClicks;
const applyCampaignReportReadOverride = (campaignName, createdAt, report) => {
    if (!report)
        return report;
    const rule = (0, exports.resolveCampaignReportOverride)(campaignName, createdAt, report);
    if (!rule)
        return report;
    const nextDelivered = rule.delivered != null ? rule.delivered : report.delivered;
    const nextRead = rule.read != null ? rule.read : report.read;
    if (nextDelivered === report.delivered && nextRead === report.read)
        return report;
    return { ...report, delivered: nextDelivered, read: nextRead };
};
exports.applyCampaignReportReadOverride = applyCampaignReportReadOverride;
