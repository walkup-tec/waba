"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_LAB_REPORT_MAX_WAIT_MS = exports.META_LAB_REPORT_QUIET_MS = void 0;
exports.computeMetaLabCampaignMetrics = computeMetaLabCampaignMetrics;
exports.shouldFinalizeMetaLabReport = shouldFinalizeMetaLabReport;
exports.tryFinalizeLabIntakeReport = tryFinalizeLabIntakeReport;
exports.scheduleLabReportFinalize = scheduleLabReportFinalize;
exports.tryFinalizeDueLabReports = tryFinalizeDueLabReports;
exports.ensureLabReportFinalizeSweep = ensureLabReportFinalizeSweep;
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
const waba_campaign_intake_repository_1 = require("../../disparos/waba-campaign-intake.repository");
const waba_campaign_intake_status_1 = require("../../disparos/waba-campaign-intake-status");
const waba_campaign_laboratorio_attended_1 = require("../../disparos/waba-campaign-laboratorio-attended");
const waba_campaign_report_finalize_service_1 = require("../../disparos/waba-campaign-report-finalize.service");
/** Sem webhook novo após o envio, fecha o relatório. */
exports.META_LAB_REPORT_QUIET_MS = 15 * 60 * 1000;
/** Teto: não espera leitura eterna. */
exports.META_LAB_REPORT_MAX_WAIT_MS = 2 * 60 * 60 * 1000;
const finalizeTimers = new Map();
function leadCountsAsSent(lead) {
    if (lead.status === "sent")
        return true;
    const meta = String(lead.metaStatus || "");
    return meta === "sent" || meta === "delivered" || meta === "read" || meta === "accepted";
}
function leadCountsAsDelivered(lead) {
    const meta = String(lead.metaStatus || "");
    return meta === "delivered" || meta === "read";
}
function leadCountsAsRead(lead) {
    return String(lead.metaStatus || "") === "read";
}
function leadCountsAsFailed(lead) {
    return lead.status === "failed" || String(lead.metaStatus || "") === "failed";
}
function computeMetaLabCampaignMetrics(campaign, totalLeads) {
    const leads = Array.isArray(campaign.leads) ? campaign.leads : [];
    return {
        totalLeads: Math.max(0, Math.round(Number(totalLeads) || 0)),
        sent: leads.filter(leadCountsAsSent).length,
        delivered: leads.filter(leadCountsAsDelivered).length,
        read: leads.filter(leadCountsAsRead).length,
        failed: leads.filter(leadCountsAsFailed).length,
        clicks: Math.max(0, Math.round(Number(campaign.clicks) || 0)),
    };
}
function shouldFinalizeMetaLabReport(campaign, nowMs = Date.now()) {
    if (campaign.reportFinalizedAt)
        return false;
    if (campaign.status !== "done" && campaign.status !== "failed")
        return false;
    if ((campaign.leads || []).some((lead) => lead.status === "queued"))
        return false;
    const doneAt = Date.parse(String(campaign.sendFinishedAt || campaign.updatedAt || "")) || 0;
    if (!doneAt)
        return false;
    const lastMeta = Date.parse(String(campaign.lastMetaStatusAt || "")) || 0;
    const lastEvent = Math.max(doneAt, lastMeta, Date.parse(String(campaign.updatedAt || "")) || 0);
    if (nowMs - lastEvent >= exports.META_LAB_REPORT_QUIET_MS)
        return true;
    if (nowMs - doneAt >= exports.META_LAB_REPORT_MAX_WAIT_MS)
        return true;
    return false;
}
function tryFinalizeLabIntakeReport(intakeCampaignId, nowMs = Date.now()) {
    const intakeId = String(intakeCampaignId || "").trim();
    if (!intakeId)
        return false;
    const campaign = (0, meta_whatsapp_broadcast_store_1.findBroadcastByIntakeCampaignId)(intakeId);
    if (!campaign)
        return false;
    if (!shouldFinalizeMetaLabReport(campaign, nowMs))
        return false;
    const intakes = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    const intake = intakes.getById(intakeId);
    if (!intake)
        return false;
    if (!(0, waba_campaign_laboratorio_attended_1.campaignAttendedByLaboratorioStaff)(intake))
        return false;
    const status = (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(intake.status);
    if (status === "completed" || status === "error_reported" || status === "cancelled")
        return false;
    if (status !== "in_progress")
        return false;
    const metrics = computeMetaLabCampaignMetrics(campaign, Number(intake.plannedSendCount || campaign.total || 0));
    try {
        (0, waba_campaign_report_finalize_service_1.finalizeIntakePerformanceReport)({
            campaignId: intakeId,
            metrics,
            filledByEmail: "meta-lab",
            source: "meta_lab",
            intakeRepository: intakes,
        });
        campaign.reportFinalizedAt = new Date().toISOString();
        (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(campaign);
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-report-finalized", {
            sent: metrics.sent,
            delivered: metrics.delivered,
            read: metrics.read,
            failed: metrics.failed,
            clicks: metrics.clicks,
        });
        return true;
    }
    catch (error) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("broadcast-report-finalize-failed", {
            reason: error instanceof Error ? error.message.slice(0, 80) : "unknown",
        });
        return false;
    }
}
function scheduleLabReportFinalize(intakeCampaignId, delayMs = exports.META_LAB_REPORT_QUIET_MS) {
    const id = String(intakeCampaignId || "").trim();
    if (!id)
        return;
    ensureLabReportFinalizeSweep();
    const previous = finalizeTimers.get(id);
    if (previous)
        clearTimeout(previous);
    finalizeTimers.set(id, setTimeout(() => {
        finalizeTimers.delete(id);
        tryFinalizeLabIntakeReport(id);
    }, Math.max(1000, delayMs)));
}
function tryFinalizeDueLabReports(nowMs = Date.now()) {
    const intakes = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    let done = 0;
    for (const intake of intakes.listAll()) {
        if (!(0, waba_campaign_laboratorio_attended_1.campaignAttendedByLaboratorioStaff)(intake))
            continue;
        if ((0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(intake.status) !== "in_progress")
            continue;
        if (tryFinalizeLabIntakeReport(intake.id, nowMs))
            done += 1;
    }
    return done;
}
let labReportSweepTimer = null;
function ensureLabReportFinalizeSweep() {
    if (labReportSweepTimer)
        return;
    labReportSweepTimer = setInterval(() => {
        try {
            tryFinalizeDueLabReports();
        }
        catch {
            /* ignore sweep errors */
        }
    }, 60000);
    labReportSweepTimer.unref?.();
}
