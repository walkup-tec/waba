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
import { deliverOperacionalNewCampaignWhatsApp } from "./waba-operacional-campaign-whatsapp.service";
import type { WabaWhatsAppDeliveryStatus } from "./waba-welcome-whatsapp.service";

export type OperacionalNotifyRecipientResult = {
  email: string;
  fullName: string;
  status: WabaEmailDeliveryStatus;
  message: string;
  messageId?: string;
  emailStatus: WabaEmailDeliveryStatus;
  emailMessage: string;
  emailMessageId?: string;
  whatsapp: string;
  whatsappStatus: WabaWhatsAppDeliveryStatus;
  whatsappMessage: string;
  whatsappInstanceName?: string;
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
    const emailDelivery = await deliverOperacionalNewCampaignEmail({
      operacionalEmail: operacional.email,
      operacionalName: operacional.fullName,
      campaignId: intake.id,
      campaignName: intake.campaignName,
      subscriberId,
      plannedSendCount,
      createdAtLabel,
      apiKindLabel,
    });
    const whatsappDelivery = await deliverOperacionalNewCampaignWhatsApp({
      recipientEmail: operacional.email,
      recipientName: operacional.fullName,
      whatsapp: String(operacional.whatsapp ?? "").trim(),
      campaignId: intake.id,
      campaignName: intake.campaignName,
      subscriberId,
      plannedSendCount,
      createdAtLabel,
      apiKindLabel,
      campaignUrl: "",
    });
    const aggregatedStatus: WabaEmailDeliveryStatus =
      emailDelivery.status === "sent" || whatsappDelivery.status === "sent"
        ? "sent"
        : emailDelivery.status === "failed" || whatsappDelivery.status === "failed"
          ? "failed"
          : "skipped";
    const aggregatedMessage = [
      `E-mail: ${emailDelivery.message}`,
      `WhatsApp: ${whatsappDelivery.message}`,
    ].join(" | ");

    recipients.push({
      email: operacional.email.trim().toLowerCase(),
      fullName: operacional.fullName,
      status: aggregatedStatus,
      message: aggregatedMessage,
      messageId: emailDelivery.messageId,
      emailStatus: emailDelivery.status,
      emailMessage: emailDelivery.message,
      emailMessageId: emailDelivery.messageId,
      whatsapp: String(operacional.whatsapp ?? "").trim(),
      whatsappStatus: whatsappDelivery.status,
      whatsappMessage: whatsappDelivery.message,
      whatsappInstanceName: whatsappDelivery.instanceName,
    });
    if (aggregatedStatus === "skipped") {
      console.warn(`[notify] ${operacional.email}: ${aggregatedMessage}`);
    } else if (aggregatedStatus === "failed") {
      console.error(`[notify] operacional nova campanha: ${operacional.email}: ${aggregatedMessage}`);
    }
  }

  return {
    attemptedAt,
    apiKind,
    apiKindLabel,
    recipients,
  };
};
