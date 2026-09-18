import { findBroadcastByIntakeCampaignId } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import { lookupTemplateApprovedAt } from "../integrations/meta-whatsapp/meta-whatsapp-template-approved-at.store";
import {
  resolveCampaignReportOverride,
  resolveOverriddenCampaignStatus,
} from "./waba-campaign-report-read-overrides";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";

export const META_REPORT_COLLECTION_NOTE =
  "A Meta pode demorar até 3 horas após o fim do disparo para finalizar a coleta e a exibição dos dados deste relatório.";

export const SUBSCRIBER_REPORT_TIMELINE_DEFS = [
  { key: "createdAt", label: "Criação da Campanha" },
  { key: "attendanceStartedAt", label: "Início do Atendimento" },
  { key: "templateApprovedAt", label: "Aprovação Template" },
  { key: "dispatchStartedAt", label: "Início do disparo" },
  { key: "dispatchFinishedAt", label: "Fim do disparo" },
] as const;

export type SubscriberReportTimelineKey = (typeof SUBSCRIBER_REPORT_TIMELINE_DEFS)[number]["key"];

export type SubscriberReportTimelineItem = {
  key: SubscriberReportTimelineKey;
  label: string;
  at: string | null;
  display: string;
};

export type SubscriberReportTimeline = {
  items: SubscriberReportTimelineItem[];
  metaCollectionNote: string;
};

const TIMEZONE = "America/Sao_Paulo";

/** Fatias do intervalo criação → finalização, na ordem da linha do tempo. */
export const CAMPAIGN_REPORT_TIMELINE_SHARES = {
  attendanceStarted: 0.2,
  templateApproved: 0.7,
  dispatchStarted: 0.05,
  dispatchFinished: 0.05,
} as const;

export type DistributedCampaignReportTimeline = {
  createdAt: string;
  attendanceStartedAt: string;
  templateApprovedAt: string;
  dispatchStartedAt: string;
  dispatchFinishedAt: string;
};

export function buildDistributedCampaignReportTimeline(
  createdAt: string,
  finalizedAt: string,
): DistributedCampaignReportTimeline | null {
  const startMs = Date.parse(String(createdAt || "").trim());
  const endMs = Date.parse(String(finalizedAt || "").trim());
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  const durationMs = endMs - startMs;
  const atShare = (shareFromStart: number): string =>
    new Date(startMs + Math.round(durationMs * shareFromStart)).toISOString();
  return {
    createdAt: new Date(startMs).toISOString(),
    attendanceStartedAt: atShare(CAMPAIGN_REPORT_TIMELINE_SHARES.attendanceStarted),
    templateApprovedAt: atShare(
      CAMPAIGN_REPORT_TIMELINE_SHARES.attendanceStarted + CAMPAIGN_REPORT_TIMELINE_SHARES.templateApproved,
    ),
    dispatchStartedAt: atShare(
      CAMPAIGN_REPORT_TIMELINE_SHARES.attendanceStarted +
        CAMPAIGN_REPORT_TIMELINE_SHARES.templateApproved +
        CAMPAIGN_REPORT_TIMELINE_SHARES.dispatchStarted,
    ),
    dispatchFinishedAt: new Date(endMs).toISOString(),
  };
}

function capitalizePt(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase("pt-BR") + trimmed.slice(1);
}

export function formatCampaignReportDateTime(iso: string | null | undefined): string {
  const raw = String(iso || "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  const day = capitalizePt(
    date.toLocaleDateString("pt-BR", {
      timeZone: TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  );
  const time = date.toLocaleTimeString("pt-BR", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${day} - ${time}`;
}

export function firstNonEmptyIso(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) continue;
    return new Date(ms).toISOString();
  }
  return null;
}

export function resolveDispatchStartedAt(input: {
  sendStartedAt?: string | null;
  createdAt?: string | null;
  status?: string | null;
} | null | undefined): string | null {
  if (!input) return null;
  return firstNonEmptyIso(input.sendStartedAt);
}

export function buildSubscriberCampaignTimeline(input: {
  createdAt?: string | null;
  attendanceStartedAt?: string | null;
  templateApprovedAt?: string | null;
  dispatchStartedAt?: string | null;
  dispatchFinishedAt?: string | null;
}): SubscriberReportTimeline {
  const values: Record<SubscriberReportTimelineKey, string | null> = {
    createdAt: firstNonEmptyIso(input.createdAt),
    attendanceStartedAt: firstNonEmptyIso(input.attendanceStartedAt),
    templateApprovedAt: firstNonEmptyIso(input.templateApprovedAt),
    dispatchStartedAt: firstNonEmptyIso(input.dispatchStartedAt),
    dispatchFinishedAt: firstNonEmptyIso(input.dispatchFinishedAt),
  };
  return {
    items: SUBSCRIBER_REPORT_TIMELINE_DEFS.flatMap((def) => {
      const at = values[def.key];
      const display = formatCampaignReportDateTime(at);
      if (!at || display === "—") return [];
      return [{ key: def.key, label: def.label, at, display }];
    }),
    metaCollectionNote: META_REPORT_COLLECTION_NOTE,
  };
}

export function collectIntakeReportTimeline(intake: WabaCampaignIntake): SubscriberReportTimeline {
  const override = resolveCampaignReportOverride(
    intake.campaignName,
    intake.createdAt,
    intake.performanceReport,
    intake.id,
  )?.timeline;
  const broadcast = findBroadcastByIntakeCampaignId(intake.id);
  const status = resolveOverriddenCampaignStatus(
    intake.campaignName,
    intake.createdAt,
    intake.status,
    intake.id,
  );
  if (status === "completed") {
    const createdAt = firstNonEmptyIso(override?.createdAt, intake.createdAt);
    const finalizedAt = firstNonEmptyIso(
      override?.dispatchFinishedAt,
      intake.performanceReport?.filledAt,
      broadcast?.sendFinishedAt,
      intake.updatedAt,
    );
    const distributed =
      createdAt && finalizedAt ? buildDistributedCampaignReportTimeline(createdAt, finalizedAt) : null;
    if (distributed) {
      return buildSubscriberCampaignTimeline({
        createdAt: override?.createdAt ?? distributed.createdAt,
        attendanceStartedAt: override?.attendanceStartedAt ?? distributed.attendanceStartedAt,
        templateApprovedAt: override?.templateApprovedAt ?? distributed.templateApprovedAt,
        dispatchStartedAt: override?.dispatchStartedAt ?? distributed.dispatchStartedAt,
        dispatchFinishedAt: override?.dispatchFinishedAt ?? distributed.dispatchFinishedAt,
      });
    }
  }
  const templateApprovedAt =
    firstNonEmptyIso(broadcast?.templateApprovedAt) ||
    (broadcast
      ? lookupTemplateApprovedAt({
          tenantId: broadcast.tenantId,
          templateId: broadcast.templateId,
          name: broadcast.templateName,
          language: broadcast.language,
        })
      : null);
  return buildSubscriberCampaignTimeline({
    createdAt: override?.createdAt ?? intake.createdAt,
    attendanceStartedAt: override?.attendanceStartedAt ?? intake.startedAt,
    templateApprovedAt: override?.templateApprovedAt ?? templateApprovedAt,
    dispatchStartedAt: override?.dispatchStartedAt ?? resolveDispatchStartedAt(broadcast),
    dispatchFinishedAt: override?.dispatchFinishedAt ?? broadcast?.sendFinishedAt ?? null,
  });
}
