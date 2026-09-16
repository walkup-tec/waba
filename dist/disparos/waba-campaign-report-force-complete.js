"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runForcedCampaignReportCompleteOneshot = runForcedCampaignReportCompleteOneshot;
const load_env_1 = require("../load-env");
const meta_whatsapp_broadcast_store_1 = require("../integrations/meta-whatsapp/meta-whatsapp-broadcast.store");
const waba_campaign_intake_repository_1 = require("./waba-campaign-intake.repository");
const waba_campaign_intake_status_1 = require("./waba-campaign-intake-status");
const waba_campaign_report_finalize_service_1 = require("./waba-campaign-report-finalize.service");
const waba_campaign_report_read_overrides_1 = require("./waba-campaign-report-read-overrides");
const existingClicks = (intake) => {
    const stored = Math.round(Number(intake.performanceReport?.clicks));
    if (Number.isFinite(stored) && stored >= 0)
        return stored;
    const broadcast = (0, meta_whatsapp_broadcast_store_1.findBroadcastByIntakeCampaignId)(intake.id);
    const live = Math.round(Number(broadcast?.clicks));
    if (Number.isFinite(live) && live >= 0)
        return live;
    return undefined;
};
function runForcedCampaignReportCompleteOneshot(deps = {}) {
    const env = String(load_env_1.WABA_ENV || process.env.WABA_ENV || "").trim().toLowerCase();
    if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
        return {
            applied: 0,
            skipped: 0,
            campaignIds: [],
            message: "oneshot ignorado em ambiente local",
        };
    }
    const intakeRepository = deps.intakeRepository || new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    const finalize = deps.finalize || waba_campaign_report_finalize_service_1.finalizeIntakePerformanceReport;
    const now = deps.now || (() => new Date().toISOString());
    const campaignIds = [];
    let skipped = 0;
    for (const intake of intakeRepository.listAll()) {
        const rule = (0, waba_campaign_report_read_overrides_1.resolveCampaignReportOverride)(intake.campaignName, intake.createdAt, intake.performanceReport, intake.id);
        if (!rule?.forceCompleted)
            continue;
        const status = (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(intake.status);
        if (status === "completed" || status === "error_reported" || status === "cancelled") {
            skipped += 1;
            continue;
        }
        if (status !== "in_progress") {
            skipped += 1;
            continue;
        }
        try {
            finalize({
                campaignId: intake.id,
                metrics: {
                    sent: rule.sent ?? 0,
                    delivered: rule.delivered ?? 0,
                    read: rule.read ?? 0,
                    failed: rule.failed ?? 0,
                    clicks: rule.clicks ?? existingClicks(intake),
                },
                filledByEmail: "meta-lab",
                source: "meta_lab",
                intakeRepository,
            });
            const broadcast = (0, meta_whatsapp_broadcast_store_1.findBroadcastByIntakeCampaignId)(intake.id);
            if (broadcast && !broadcast.reportFinalizedAt) {
                broadcast.reportFinalizedAt = now();
                (0, meta_whatsapp_broadcast_store_1.saveBroadcastCampaign)(broadcast);
            }
            campaignIds.push(intake.id);
        }
        catch (error) {
            skipped += 1;
            console.error(`[campanhas] falha ao finalizar relatório pontual ${intake.campaignName}:`, error instanceof Error ? error.message : error);
        }
    }
    return {
        applied: campaignIds.length,
        skipped,
        campaignIds,
        message: campaignIds.length
            ? `Relatório pontual finalizado (${campaignIds.join(", ")})`
            : skipped
                ? "Relatório pontual já estava finalizado ou fora de andamento"
                : "Nenhuma campanha pontual para finalizar",
    };
}
