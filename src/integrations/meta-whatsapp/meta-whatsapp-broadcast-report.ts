import { logMetaWhatsappSafe } from "./meta-whatsapp-errors";
import {
  findBroadcastByIntakeCampaignId,
  saveBroadcastCampaign,
  type MetaBroadcastCampaign,
  type MetaBroadcastLead,
} from "./meta-whatsapp-broadcast.store";
import { WabaCampaignIntakeRepository } from "../../disparos/waba-campaign-intake.repository";
import { normalizeCampaignIntakeStatus } from "../../disparos/waba-campaign-intake-status";
import { campaignAttendedByLaboratorioStaff } from "../../disparos/waba-campaign-laboratorio-attended";
import { finalizeIntakePerformanceReport } from "../../disparos/waba-campaign-report-finalize.service";

/** Sem webhook novo após o envio, fecha o relatório. */
export const META_LAB_REPORT_QUIET_MS = 15 * 60 * 1000;
/** Teto: não espera leitura eterna. */
export const META_LAB_REPORT_MAX_WAIT_MS = 2 * 60 * 60 * 1000;

const finalizeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function leadCountsAsSent(lead: MetaBroadcastLead): boolean {
  if (lead.status === "sent") return true;
  const meta = String(lead.metaStatus || "");
  return meta === "sent" || meta === "delivered" || meta === "read" || meta === "accepted";
}

function leadCountsAsDelivered(lead: MetaBroadcastLead): boolean {
  const meta = String(lead.metaStatus || "");
  return meta === "delivered" || meta === "read";
}

function leadCountsAsRead(lead: MetaBroadcastLead): boolean {
  return String(lead.metaStatus || "") === "read";
}

function leadCountsAsFailed(lead: MetaBroadcastLead): boolean {
  return lead.status === "failed" || String(lead.metaStatus || "") === "failed";
}

export function computeMetaLabCampaignMetrics(campaign: MetaBroadcastCampaign, totalLeads: number) {
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

function campaignHasDeliverySignal(campaign: MetaBroadcastCampaign): boolean {
  return (campaign.leads || []).some((lead) => leadCountsAsDelivered(lead) || leadCountsAsRead(lead));
}

export function shouldFinalizeMetaLabReport(
  campaign: MetaBroadcastCampaign,
  nowMs = Date.now(),
): boolean {
  if (campaign.reportFinalizedAt) return false;
  if (campaign.status !== "done" && campaign.status !== "failed") return false;
  if ((campaign.leads || []).some((lead) => lead.status === "queued")) return false;
  const doneAt = Date.parse(String(campaign.sendFinishedAt || campaign.updatedAt || "")) || 0;
  if (!doneAt) return false;
  const lastMeta = Date.parse(String(campaign.lastMetaStatusAt || "")) || 0;
  if (nowMs - doneAt >= META_LAB_REPORT_MAX_WAIT_MS) return true;
  if (campaignHasDeliverySignal(campaign) && lastMeta && nowMs - lastMeta >= META_LAB_REPORT_QUIET_MS) {
    return true;
  }
  return false;
}

function performanceChanged(
  previous: { sent?: number; delivered?: number; read?: number; failed?: number; clicks?: number } | null | undefined,
  metrics: ReturnType<typeof computeMetaLabCampaignMetrics>,
): boolean {
  if (!previous) return true;
  return (
    Number(previous.sent || 0) !== metrics.sent ||
    Number(previous.delivered || 0) !== metrics.delivered ||
    Number(previous.read || 0) !== metrics.read ||
    Number(previous.failed || 0) !== metrics.failed ||
    Number(previous.clicks || 0) !== metrics.clicks
  );
}

/** Atualiza relatório Meta já finalizado quando o webhook chega depois. Não mexe em bônus. */
export function refreshCompletedLabIntakeReport(intakeCampaignId: string): boolean {
  const intakeId = String(intakeCampaignId || "").trim();
  if (!intakeId) return false;
  const campaign = findBroadcastByIntakeCampaignId(intakeId);
  if (!campaign) return false;
  const intakes = new WabaCampaignIntakeRepository();
  const intake = intakes.getById(intakeId);
  if (!intake) return false;
  if (!campaignAttendedByLaboratorioStaff(intake)) return false;
  if (normalizeCampaignIntakeStatus(intake.status) !== "completed") return false;
  if (intake.performanceReport?.source !== "meta_lab") return false;
  const metrics = computeMetaLabCampaignMetrics(campaign, Number(intake.plannedSendCount || campaign.total || 0));
  if (!performanceChanged(intake.performanceReport, metrics)) return false;
  const now = new Date().toISOString();
  intakes.updateById(intakeId, {
    performanceReport: {
      ...intake.performanceReport,
      sent: metrics.sent,
      delivered: metrics.delivered,
      read: metrics.read,
      failed: metrics.failed,
      clicks: metrics.clicks,
      source: "meta_lab",
      filledAt: now,
      filledByEmail: "meta-lab",
    },
    updatedAt: now,
  });
  logMetaWhatsappSafe("broadcast-report-refreshed", {
    sent: metrics.sent,
    delivered: metrics.delivered,
    read: metrics.read,
    failed: metrics.failed,
    clicks: metrics.clicks,
  });
  return true;
}

export function tryFinalizeLabIntakeReport(intakeCampaignId: string, nowMs = Date.now()): boolean {
  const intakeId = String(intakeCampaignId || "").trim();
  if (!intakeId) return false;
  const campaign = findBroadcastByIntakeCampaignId(intakeId);
  if (!campaign) return false;
  if (!shouldFinalizeMetaLabReport(campaign, nowMs)) return false;
  const intakes = new WabaCampaignIntakeRepository();
  const intake = intakes.getById(intakeId);
  if (!intake) return false;
  if (!campaignAttendedByLaboratorioStaff(intake)) return false;
  const status = normalizeCampaignIntakeStatus(intake.status);
  if (status === "completed" || status === "error_reported" || status === "cancelled") return false;
  if (status !== "in_progress") return false;
  const metrics = computeMetaLabCampaignMetrics(campaign, Number(intake.plannedSendCount || campaign.total || 0));
  try {
    finalizeIntakePerformanceReport({
      campaignId: intakeId,
      metrics,
      filledByEmail: "meta-lab",
      source: "meta_lab",
      intakeRepository: intakes,
    });
    campaign.reportFinalizedAt = new Date().toISOString();
    saveBroadcastCampaign(campaign);
    logMetaWhatsappSafe("broadcast-report-finalized", {
      sent: metrics.sent,
      delivered: metrics.delivered,
      read: metrics.read,
      failed: metrics.failed,
      clicks: metrics.clicks,
    });
    return true;
  } catch (error) {
    logMetaWhatsappSafe("broadcast-report-finalize-failed", {
      reason: error instanceof Error ? error.message.slice(0, 80) : "unknown",
    });
    return false;
  }
}

export function scheduleLabReportFinalize(intakeCampaignId: string, delayMs = META_LAB_REPORT_QUIET_MS): void {
  const id = String(intakeCampaignId || "").trim();
  if (!id) return;
  ensureLabReportFinalizeSweep();
  const previous = finalizeTimers.get(id);
  if (previous) clearTimeout(previous);
  finalizeTimers.set(
    id,
    setTimeout(() => {
      finalizeTimers.delete(id);
      tryFinalizeLabIntakeReport(id);
    }, Math.max(1000, delayMs)),
  );
}

export function tryFinalizeDueLabReports(nowMs = Date.now()): number {
  const intakes = new WabaCampaignIntakeRepository();
  let done = 0;
  for (const intake of intakes.listAll()) {
    if (!campaignAttendedByLaboratorioStaff(intake)) continue;
    const status = normalizeCampaignIntakeStatus(intake.status);
    if (status === "in_progress") {
      if (tryFinalizeLabIntakeReport(intake.id, nowMs)) done += 1;
      continue;
    }
    if (status === "completed" && refreshCompletedLabIntakeReport(intake.id)) done += 1;
  }
  return done;
}

let labReportSweepTimer: ReturnType<typeof setInterval> | null = null;

export function ensureLabReportFinalizeSweep(): void {
  if (labReportSweepTimer) return;
  labReportSweepTimer = setInterval(() => {
    try {
      tryFinalizeDueLabReports();
    } catch {
      /* ignore sweep errors */
    }
  }, 60_000);
  labReportSweepTimer.unref?.();
}
