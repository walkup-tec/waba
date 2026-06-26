import {
  resolveIntakeApiKindFromIntake,
  WABA_DISPATCHES_API_LABELS,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import {
  deliverOperacionalNewCampaignEmail,
  type WabaEmailDeliveryStatus,
} from "./waba-mail-delivery";

export type OperacionalNotifyRecipientResult = {
  email: string;
  fullName: string;
  status: WabaEmailDeliveryStatus;
  message: string;
  messageId?: string;
};

export type OperacionalNotifyResult = {
  attemptedAt: string;
  apiKind: WabaDispatchesApiKind;
  apiKindLabel: string;
  recipients: OperacionalNotifyRecipientResult[];
};

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

export const notifyOperacionalStaffOnCampaignCreated = async (
  intake: WabaCampaignIntake,
): Promise<OperacionalNotifyResult> => {
  const attemptedAt = new Date().toISOString();
  const apiKind = resolveApiKind(intake);
  const apiKindLabel = WABA_DISPATCHES_API_LABELS[apiKind];
  const operacionais = new WabaSystemUserService().listOperacionalUsersForDispatchesApi(apiKind);

  if (!operacionais.length) {
    const message =
      `Nenhum usuário operacional designado para ${apiKindLabel}. ` +
      "Configure em Admin · Usuários o plano de atendimento (API Oficial ou API Alternativa).";
    console.warn(`[mail] campanha ${intake.id}: ${message}`);
    return {
      attemptedAt,
      apiKind,
      apiKindLabel,
      recipients: [],
    };
  }

  const subscriber = new WabaSubscriberRepository().getByEmail(intake.ownerEmail);
  const subscriberId = String(subscriber?.id ?? "").trim() || "—";
  const createdAtLabel = formatCreatedAtLabel(intake.createdAt);
  const plannedSendCount = resolvePlannedSendCount(intake);

  console.log(
    `[mail] campanha ${intake.id} (${apiKindLabel}): notificando ${operacionais.length} operacional(is): ` +
      operacionais.map((user) => user.email).join(", "),
  );

  const recipients: OperacionalNotifyRecipientResult[] = [];
  for (const operacional of operacionais) {
    const delivery = await deliverOperacionalNewCampaignEmail({
      operacionalEmail: operacional.email,
      operacionalName: operacional.fullName,
      campaignId: intake.id,
      campaignName: intake.campaignName,
      subscriberId,
      plannedSendCount,
      createdAtLabel,
      apiKindLabel,
    });
    recipients.push({
      email: operacional.email.trim().toLowerCase(),
      fullName: operacional.fullName,
      status: delivery.status,
      message: delivery.message,
      messageId: delivery.messageId,
    });
    if (delivery.status === "skipped") {
      console.warn(`[mail] ${delivery.message}`);
    } else if (delivery.status === "failed") {
      console.error(`[mail] operacional nova campanha: ${delivery.message}`);
    }
  }

  return {
    attemptedAt,
    apiKind,
    apiKindLabel,
    recipients,
  };
};
