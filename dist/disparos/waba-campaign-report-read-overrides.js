"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCampaignReportReadOverride = exports.resolveCampaignReportReadOverride = void 0;
const CAMPAIGN_REPORT_READ_OVERRIDES = [
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
const resolveCampaignReportReadOverride = (campaignName, createdAt) => {
    const name = String(campaignName || "").trim();
    const created = String(createdAt || "").trim();
    if (!name || !created)
        return null;
    for (const rule of CAMPAIGN_REPORT_READ_OVERRIDES) {
        if (!namesMatch(name, rule.name))
            continue;
        const stamp = formatLocalStamp(created, rule.timezone);
        if (stamp.date !== rule.createdLocalDate)
            continue;
        return rule.read;
    }
    return null;
};
exports.resolveCampaignReportReadOverride = resolveCampaignReportReadOverride;
const applyCampaignReportReadOverride = (campaignName, createdAt, report) => {
    if (!report)
        return report;
    const nextRead = (0, exports.resolveCampaignReportReadOverride)(campaignName, createdAt);
    if (nextRead == null || nextRead === report.read)
        return report;
    return { ...report, read: nextRead };
};
exports.applyCampaignReportReadOverride = applyCampaignReportReadOverride;
