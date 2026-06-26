import {
  resolveIntakeApiKindFromIntake,
  WABA_DISPATCHES_API_LABELS,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import { notifyOperacionalNewCampaignEmail } from "./waba-mail-delivery";

const formatCreatedAtLabel = (iso: string): string => {
  const value = String(iso ?? "").trim();
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolvePlannedSendCount = (intake: WabaCampaignIntake): number => {
  const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
  if (planned > 0) return planned;
  return Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
};

const resolveApiKind = (intake: WabaCampaignIntake): WabaDispatchesApiKind =>
  resolveIntakeApiKindFromIntake(intake);

export const notifyOperacionalStaffOnCampaignCreated = (intake: WabaCampaignIntake): void => {
  const apiKind = resolveApiKind(intake);
  const operacionais = new WabaSystemUserService().listOperacionalUsersForDispatchesApi(apiKind);
  if (!operacionais.length) {
    console.warn(
      `[mail] campanha ${intake.id}: nenhum usuário operacional designado para ${apiKind}.`,
    );
    return;
  }

  const subscriber = new WabaSubscriberRepository().getByEmail(intake.ownerEmail);
  const subscriberId = String(subscriber?.id ?? "").trim() || "—";
  const createdAtLabel = formatCreatedAtLabel(intake.createdAt);
  const plannedSendCount = resolvePlannedSendCount(intake);
  const apiKindLabel = WABA_DISPATCHES_API_LABELS[apiKind];

  for (const operacional of operacionais) {
    notifyOperacionalNewCampaignEmail({
      operacionalEmail: operacional.email,
      operacionalName: operacional.fullName,
      campaignId: intake.id,
      campaignName: intake.campaignName,
      subscriberId,
      plannedSendCount,
      createdAtLabel,
      apiKindLabel,
    });
  }
};
