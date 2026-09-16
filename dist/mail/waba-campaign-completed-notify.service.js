"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VITORIA_COMPLETED_NOTIFY_TEST_WHATSAPP = exports.VITORIA_COMPLETED_NOTIFY_TEST_EMAIL = exports.VITORIA_COMPLETED_NOTIFY_TEST_ID = void 0;
exports.notifyCampaignCompleted = notifyCampaignCompleted;
exports.notifyCampaignCompletedAsync = notifyCampaignCompletedAsync;
exports.buildVitoriaCompletedNotifySnapshot = buildVitoriaCompletedNotifySnapshot;
exports.runVitoriaCompletedNotifyTestOneshot = runVitoriaCompletedNotifyTestOneshot;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const load_env_1 = require("../load-env");
const waba_campaign_intake_repository_1 = require("../disparos/waba-campaign-intake.repository");
const waba_campaign_report_snapshot_1 = require("../disparos/waba-campaign-report-snapshot");
const waba_campaign_intake_vitoria_short_url_1 = require("../disparos/waba-campaign-intake-vitoria-short-url");
const waba_campaign_report_timeline_1 = require("../disparos/waba-campaign-report-timeline");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_app_url_1 = require("./waba-app-url");
const waba_mail_delivery_1 = require("./waba-mail-delivery");
const waba_mail_templates_1 = require("./waba-mail.templates");
const waba_evolution_whatsapp_delivery_service_1 = require("./waba-evolution-whatsapp-delivery.service");
const ONESHOT_FILE = "waba-campaign-completed-notify-oneshots.json";
exports.VITORIA_COMPLETED_NOTIFY_TEST_ID = "vitoria-completed-notify-test-20260916-print3";
exports.VITORIA_COMPLETED_NOTIFY_TEST_EMAIL = "walkup@walkuptec.com.br";
exports.VITORIA_COMPLETED_NOTIFY_TEST_WHATSAPP = "51999666841";
const stubIntakeForSnapshot = (input, id = "snapshot") => ({
    id,
    ownerEmail: "",
    campaignName: input.campaignName,
    regionDdd: "",
    textOptions: ["a", "b", "c"],
    importedLineCount: input.totalLeads,
    plannedSendCount: input.totalLeads,
    status: "completed",
    createdAt: input.timeline.items.find((item) => item.key === "createdAt")?.at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    performanceReport: {
        totalLeads: input.totalLeads,
        sent: input.sent,
        delivered: input.delivered,
        read: input.read,
        failed: input.failed,
        clicks: input.clicks,
        source: "meta_lab",
        filledAt: new Date().toISOString(),
        filledByEmail: "meta-lab",
    },
});
async function captureReportImage(model, renderPng) {
    try {
        const png = await (renderPng || waba_campaign_report_snapshot_1.renderCampaignReportSnapshotPng)(model);
        if (png && png.length > 32)
            return png;
    }
    catch (error) {
        console.error("[notify] falha ao gerar print do relatório:", error instanceof Error ? error.message : error);
    }
    return null;
}
async function notifyCampaignCompleted(input) {
    const intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    const subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository();
    const intake = input.intake || intakeRepository.getById(input.campaignId);
    const ownerEmail = String(input.toEmail || input.ownerEmail || intake?.ownerEmail || "")
        .trim()
        .toLowerCase();
    const subscriber = ownerEmail ? subscriberRepository.getByEmail(ownerEmail) : null;
    const recipientName = String(input.recipientName || "").trim() || String(subscriber?.fullName || "").trim();
    const whatsapp = String(input.toWhatsapp || subscriber?.whatsapp || subscriber?.phone || "").replace(/\D/g, "");
    const model = input.snapshot ||
        (intake
            ? (0, waba_campaign_report_snapshot_1.buildCampaignReportSnapshotModel)(intake)
            : {
                campaignName: input.campaignName,
                timeline: (0, waba_campaign_report_timeline_1.collectIntakeReportTimeline)(stubIntakeForSnapshot({
                    campaignName: input.campaignName,
                    timeline: { items: [], metaCollectionNote: "" },
                    totalLeads: 0,
                    sent: 0,
                    delivered: 0,
                    read: 0,
                    failed: 0,
                })),
                totalLeads: 0,
                sent: 0,
                delivered: 0,
                read: 0,
                failed: 0,
            });
    const image = await captureReportImage(model, input.renderPng);
    const reportUrl = (0, waba_app_url_1.buildCampaignReportDeepLink)(input.campaignId);
    const email = await (0, waba_mail_delivery_1.deliverCampaignCompletedEmail)({
        ownerEmail,
        campaignId: input.campaignId,
        campaignName: input.campaignName,
        recipientName,
        reportImage: image || undefined,
    });
    const text = (0, waba_mail_templates_1.buildCampaignCompletedWhatsAppText)({
        recipientName,
        recipientEmail: ownerEmail,
        campaignName: input.campaignName,
    });
    const whatsappDelivery = whatsapp
        ? await (0, waba_evolution_whatsapp_delivery_service_1.deliverWabaEvolutionWhatsApp)({
            targetWhatsapp: whatsapp,
            recipientEmail: ownerEmail,
            text,
            logLabel: `campanha finalizada ${input.campaignId}`,
            backgroundRetryKey: `campaign-done:${input.campaignId}:wa:${whatsapp.slice(-11)}`,
            image: image
                ? {
                    mediaBase64: image.toString("base64"),
                    mimetype: "image/png",
                    fileName: "relatorio-campanha.png",
                }
                : undefined,
            urlButton: {
                label: "Relatório",
                url: reportUrl,
            },
        })
        : {
            status: "skipped",
            message: "Assinante sem WhatsApp cadastrado.",
        };
    return { email, whatsapp: whatsappDelivery, hasImage: Boolean(image) };
}
function notifyCampaignCompletedAsync(input) {
    void notifyCampaignCompleted(input).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[notify] campanha finalizada (async):", message);
    });
}
const readOneshotStore = () => {
    try {
        const filePath = node_path_1.default.join((0, data_path_1.resolveDataDir)(), ONESHOT_FILE);
        if (!(0, node_fs_1.existsSync)(filePath))
            return {};
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
};
const writeOneshotStore = (store) => {
    const dir = (0, data_path_1.resolveDataDir)();
    (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(dir, ONESHOT_FILE), JSON.stringify(store, null, 2), "utf8");
};
function buildVitoriaCompletedNotifySnapshot(intake) {
    if (intake)
        return (0, waba_campaign_report_snapshot_1.buildCampaignReportSnapshotModel)(intake);
    const stub = stubIntakeForSnapshot({
        campaignName: waba_campaign_intake_vitoria_short_url_1.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
        timeline: { items: [], metaCollectionNote: "" },
        totalLeads: 1000,
        sent: 907,
        delivered: 782,
        read: 484,
        failed: 86,
        clicks: 0,
        showClicks: true,
    });
    return {
        campaignName: waba_campaign_intake_vitoria_short_url_1.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
        timeline: (0, waba_campaign_report_timeline_1.collectIntakeReportTimeline)({
            ...stub,
            campaignName: waba_campaign_intake_vitoria_short_url_1.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
            createdAt: "2026-09-08T21:01:00.000Z",
        }),
        totalLeads: 1000,
        sent: 907,
        delivered: 782,
        read: 484,
        failed: 86,
        clicks: 0,
        showClicks: true,
        reportSource: "meta_lab",
    };
}
async function runVitoriaCompletedNotifyTestOneshot(input) {
    const env = String(load_env_1.WABA_ENV || process.env.WABA_ENV || "").trim().toLowerCase();
    if (!input?.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
        return { applied: false, reason: "local-env", message: "oneshot ignorado em ambiente local" };
    }
    const store = readOneshotStore();
    if (!input?.force && store[exports.VITORIA_COMPLETED_NOTIFY_TEST_ID]) {
        return {
            applied: false,
            reason: "already-sent",
            message: `Teste já enviado em ${store[exports.VITORIA_COMPLETED_NOTIFY_TEST_ID].sentAt}`,
        };
    }
    const intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    const subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository();
    const subscriber = subscriberRepository.getById(waba_campaign_intake_vitoria_short_url_1.VITORIA_DA_CONQUISTA_SUBSCRIBER_ID);
    const intake = (subscriber
        ? intakeRepository
            .listByEmail(subscriber.email)
            .find((item) => (0, waba_campaign_intake_vitoria_short_url_1.isVitoriaDaConquistaCampaignName)(item.campaignName))
        : null) ||
        intakeRepository.listAll().find((item) => (0, waba_campaign_intake_vitoria_short_url_1.isVitoriaDaConquistaCampaignName)(item.campaignName)) ||
        null;
    const result = await notifyCampaignCompleted({
        ownerEmail: exports.VITORIA_COMPLETED_NOTIFY_TEST_EMAIL,
        toEmail: exports.VITORIA_COMPLETED_NOTIFY_TEST_EMAIL,
        toWhatsapp: exports.VITORIA_COMPLETED_NOTIFY_TEST_WHATSAPP,
        recipientName: "Walkup",
        campaignId: intake?.id || "vitoria-da-conquista",
        campaignName: waba_campaign_intake_vitoria_short_url_1.VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
        intake,
        snapshot: buildVitoriaCompletedNotifySnapshot(intake),
        renderPng: input?.renderPng,
    });
    const applied = result.email.status === "sent" || result.whatsapp.status === "sent";
    if (applied) {
        store[exports.VITORIA_COMPLETED_NOTIFY_TEST_ID] = { sentAt: new Date().toISOString() };
        writeOneshotStore(store);
    }
    return {
        applied,
        reason: applied ? "sent" : "delivery-failed",
        message: `e-mail=${result.email.status}; whatsapp=${result.whatsapp.status}; imagem=${result.hasImage}`,
        emailStatus: result.email.status,
        whatsappStatus: result.whatsapp.status,
    };
}
