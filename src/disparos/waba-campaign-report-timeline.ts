import { findBroadcastByIntakeCampaignId } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import { lookupTemplateApprovedAt } from "../integrations/meta-whatsapp/meta-whatsapp-template-approved-at.store";
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
  const broadcast = findBroadcastByIntakeCampaignId(intake.id);
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
    createdAt: intake.createdAt,
    attendanceStartedAt: intake.startedAt,
    templateApprovedAt,
    dispatchStartedAt: resolveDispatchStartedAt(broadcast),
    dispatchFinishedAt: broadcast?.sendFinishedAt || null,
  });
}
