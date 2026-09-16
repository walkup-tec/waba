import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../data-path";
import { WABA_ENV } from "../load-env";
import { WabaCampaignIntakeRepository, type WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";
import {
  buildCampaignReportSnapshotModel,
  renderCampaignReportSnapshotPng,
  type CampaignReportSnapshotInput,
} from "../disparos/waba-campaign-report-snapshot";
import {
  VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
  VITORIA_DA_CONQUISTA_SUBSCRIBER_ID,
  isVitoriaDaConquistaCampaignName,
} from "../disparos/waba-campaign-intake-vitoria-short-url";
import { collectIntakeReportTimeline } from "../disparos/waba-campaign-report-timeline";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { buildCampaignReportDeepLink } from "./waba-app-url";
import { deliverCampaignCompletedEmail } from "./waba-mail-delivery";
import { buildCampaignCompletedWhatsAppText } from "./waba-mail.templates";
import { deliverWabaEvolutionWhatsApp } from "./waba-evolution-whatsapp-delivery.service";
import type { WabaEmailDeliveryResult } from "./waba-mail-delivery";
import type { WabaWhatsAppDeliveryResult } from "./waba-welcome-whatsapp.service";

const ONESHOT_FILE = "waba-campaign-completed-notify-oneshots.json";
export const VITORIA_COMPLETED_NOTIFY_TEST_ID = "vitoria-completed-notify-test-20260916-print3";
export const VITORIA_COMPLETED_NOTIFY_TEST_EMAIL = "walkup@walkuptec.com.br";
export const VITORIA_COMPLETED_NOTIFY_TEST_WHATSAPP = "51999666841";

export type CampaignCompletedNotifyResult = {
  email: WabaEmailDeliveryResult;
  whatsapp: WabaWhatsAppDeliveryResult;
  hasImage: boolean;
};

const stubIntakeForSnapshot = (input: CampaignReportSnapshotInput, id = "snapshot"): WabaCampaignIntake =>
  ({
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
  }) as WabaCampaignIntake;

async function captureReportImage(
  model: CampaignReportSnapshotInput,
  renderPng?: (input: CampaignReportSnapshotInput) => Promise<Buffer>,
): Promise<Buffer | null> {
  try {
    const png = await (renderPng || renderCampaignReportSnapshotPng)(model);
    if (png && png.length > 32) return png;
  } catch (error) {
    console.error(
      "[notify] falha ao gerar print do relatório:",
      error instanceof Error ? error.message : error,
    );
  }
  return null;
}

export async function notifyCampaignCompleted(input: {
  ownerEmail: string;
  campaignId: string;
  campaignName: string;
  intake?: WabaCampaignIntake | null;
  toEmail?: string;
  toWhatsapp?: string;
  recipientName?: string;
  snapshot?: CampaignReportSnapshotInput;
  renderPng?: (input: CampaignReportSnapshotInput) => Promise<Buffer>;
}): Promise<CampaignCompletedNotifyResult> {
  const intakeRepository = new WabaCampaignIntakeRepository();
  const subscriberRepository = new WabaSubscriberRepository();
  const intake = input.intake || intakeRepository.getById(input.campaignId);
  const ownerEmail = String(input.toEmail || input.ownerEmail || intake?.ownerEmail || "")
    .trim()
    .toLowerCase();
  const subscriber = ownerEmail ? subscriberRepository.getByEmail(ownerEmail) : null;
  const recipientName =
    String(input.recipientName || "").trim() || String(subscriber?.fullName || "").trim();
  const whatsapp = String(input.toWhatsapp || subscriber?.whatsapp || subscriber?.phone || "").replace(
    /\D/g,
    "",
  );
  const model =
    input.snapshot ||
    (intake
      ? buildCampaignReportSnapshotModel(intake)
      : {
          campaignName: input.campaignName,
          timeline: collectIntakeReportTimeline(
            stubIntakeForSnapshot({
              campaignName: input.campaignName,
              timeline: { items: [], metaCollectionNote: "" },
              totalLeads: 0,
              sent: 0,
              delivered: 0,
              read: 0,
              failed: 0,
            }),
          ),
          totalLeads: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
        });
  const image = await captureReportImage(model, input.renderPng);
  const reportUrl = buildCampaignReportDeepLink(input.campaignId);
  const email = await deliverCampaignCompletedEmail({
    ownerEmail,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    recipientName,
    reportImage: image || undefined,
  });
  const text = buildCampaignCompletedWhatsAppText({
    recipientName,
    recipientEmail: ownerEmail,
    campaignName: input.campaignName,
  });
  const whatsappDelivery = whatsapp
    ? await deliverWabaEvolutionWhatsApp({
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
        status: "skipped" as const,
        message: "Assinante sem WhatsApp cadastrado.",
      };
  return { email, whatsapp: whatsappDelivery, hasImage: Boolean(image) };
}

export function notifyCampaignCompletedAsync(input: {
  ownerEmail: string;
  campaignId: string;
  campaignName: string;
}): void {
  void notifyCampaignCompleted(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[notify] campanha finalizada (async):", message);
  });
}

const readOneshotStore = (): Record<string, { sentAt: string }> => {
  try {
    const filePath = path.join(resolveDataDir(), ONESHOT_FILE);
    if (!existsSync(filePath)) return {};
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeOneshotStore = (store: Record<string, { sentAt: string }>): void => {
  const dir = resolveDataDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, ONESHOT_FILE), JSON.stringify(store, null, 2), "utf8");
};

export function buildVitoriaCompletedNotifySnapshot(intake?: WabaCampaignIntake | null): CampaignReportSnapshotInput {
  if (intake) return buildCampaignReportSnapshotModel(intake);
  const stub = stubIntakeForSnapshot({
    campaignName: VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
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
    campaignName: VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
    timeline: collectIntakeReportTimeline({
      ...stub,
      campaignName: VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
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

export async function runVitoriaCompletedNotifyTestOneshot(input?: {
  forceLocal?: boolean;
  force?: boolean;
  renderPng?: (model: CampaignReportSnapshotInput) => Promise<Buffer>;
}): Promise<{
  applied: boolean;
  reason: string;
  message: string;
  emailStatus?: string;
  whatsappStatus?: string;
}> {
  const env = String(WABA_ENV || process.env.WABA_ENV || "").trim().toLowerCase();
  if (!input?.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
    return { applied: false, reason: "local-env", message: "oneshot ignorado em ambiente local" };
  }
  const store = readOneshotStore();
  if (!input?.force && store[VITORIA_COMPLETED_NOTIFY_TEST_ID]) {
    return {
      applied: false,
      reason: "already-sent",
      message: `Teste já enviado em ${store[VITORIA_COMPLETED_NOTIFY_TEST_ID].sentAt}`,
    };
  }

  const intakeRepository = new WabaCampaignIntakeRepository();
  const subscriberRepository = new WabaSubscriberRepository();
  const subscriber = subscriberRepository.getById(VITORIA_DA_CONQUISTA_SUBSCRIBER_ID);
  const intake =
    (subscriber
      ? intakeRepository
          .listByEmail(subscriber.email)
          .find((item) => isVitoriaDaConquistaCampaignName(item.campaignName))
      : null) ||
    intakeRepository.listAll().find((item) => isVitoriaDaConquistaCampaignName(item.campaignName)) ||
    null;

  const result = await notifyCampaignCompleted({
    ownerEmail: VITORIA_COMPLETED_NOTIFY_TEST_EMAIL,
    toEmail: VITORIA_COMPLETED_NOTIFY_TEST_EMAIL,
    toWhatsapp: VITORIA_COMPLETED_NOTIFY_TEST_WHATSAPP,
    recipientName: "Walkup",
    campaignId: intake?.id || "vitoria-da-conquista",
    campaignName: VITORIA_DA_CONQUISTA_CAMPAIGN_NAME,
    intake,
    snapshot: buildVitoriaCompletedNotifySnapshot(intake),
    renderPng: input?.renderPng,
  });

  const applied = result.email.status === "sent" || result.whatsapp.status === "sent";
  if (applied) {
    store[VITORIA_COMPLETED_NOTIFY_TEST_ID] = { sentAt: new Date().toISOString() };
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
