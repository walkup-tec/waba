import {
  resolveIntakeApiKindFromIntake,
  WABA_DISPATCHES_API_LABELS,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import type { WabaSystemUser } from "../users/waba-system-user.repository";
import {
  deliverOperacionalNewCampaignEmail,
  type WabaEmailDeliveryStatus,
} from "./waba-mail-delivery";
import { deliverOperacionalNewCampaignWhatsApp } from "./waba-operacional-campaign-whatsapp.service";
import type { WabaWhatsAppDeliveryStatus } from "./waba-welcome-whatsapp.service";

export type OperacionalNotifyRecipientRole = "operacional" | "master";

export type OperacionalNotifyRecipientResult = {
  role: OperacionalNotifyRecipientRole;
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

const buildSkippedRecipient = (input: {
  role: OperacionalNotifyRecipientRole;
  user: Pick<WabaSystemUser, "email" | "fullName" | "whatsapp">;
  message: string;
}): OperacionalNotifyRecipientResult => ({
  role: input.role,
  email: String(input.user.email || "").trim().toLowerCase(),
  fullName: String(input.user.fullName || "").trim(),
  status: "skipped",
  message: input.message,
  emailStatus: "skipped",
  emailMessage: input.role === "master" ? "E-mail não enviado para master." : input.message,
  whatsapp: String(input.user.whatsapp ?? "").trim(),
  whatsappStatus: "skipped",
  whatsappMessage: input.message,
});

const notifyAssignedOperacionalAndMasters = async (
  intake: WabaCampaignIntake,
): Promise<OperacionalNotifyResult> => {
  const attemptedAt = new Date().toISOString();
  const apiKind = resolveApiKind(intake);
  const apiKindLabel = WABA_DISPATCHES_API_LABELS[apiKind];
  const assignedEmail = String(intake.assignedOperacionalEmail || "").trim().toLowerCase();

  if (!assignedEmail) {
    console.warn(
      `[mail] campanha ${intake.id}: sem operacional atribuído — notificação de campanha ignorada.`,
    );
    return {
      attemptedAt,
      apiKind,
      apiKindLabel,
      recipients: [],
    };
  }

  const userService = new WabaSystemUserService();
  const operacional = userService.getByEmail(assignedEmail);
  if (!operacional || operacional.role !== "operacional") {
    console.warn(`[mail] campanha ${intake.id}: operacional atribuído inválido (${assignedEmail}).`);
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
  const assignedOperacionalName = String(operacional.fullName || "").trim() || assignedEmail;

  const templateBase = {
    campaignId: intake.id,
    campaignName: intake.campaignName,
    subscriberId,
    plannedSendCount,
    createdAtLabel,
    createdAtIso: intake.createdAt,
    assignedOperacionalName,
    apiKindLabel,
    campaignUrl: "",
  };

  const recipients: OperacionalNotifyRecipientResult[] = [];

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
  const operacionalWhatsappDelivery = await deliverOperacionalNewCampaignWhatsApp({
    recipientEmail: operacional.email,
    recipientName: operacional.fullName,
    whatsapp: String(operacional.whatsapp ?? "").trim(),
    ...templateBase,
  });
  const operacionalAggregatedStatus: WabaEmailDeliveryStatus =
    emailDelivery.status === "sent" || operacionalWhatsappDelivery.status === "sent"
      ? "sent"
      : emailDelivery.status === "failed" || operacionalWhatsappDelivery.status === "failed"
        ? "failed"
        : "skipped";

  recipients.push({
    role: "operacional",
    email: operacional.email.trim().toLowerCase(),
    fullName: operacional.fullName,
    status: operacionalAggregatedStatus,
    message: [
      `E-mail: ${emailDelivery.message}`,
      `WhatsApp: ${operacionalWhatsappDelivery.message}`,
    ].join(" | "),
    messageId: emailDelivery.messageId,
    emailStatus: emailDelivery.status,
    emailMessage: emailDelivery.message,
    emailMessageId: emailDelivery.messageId,
    whatsapp: String(operacional.whatsapp ?? "").trim(),
    whatsappStatus: operacionalWhatsappDelivery.status,
    whatsappMessage: operacionalWhatsappDelivery.message,
    whatsappInstanceName: operacionalWhatsappDelivery.instanceName,
  });

  const masters = userService.listMasterUsers();
  console.log(
    `[mail] campanha ${intake.id} (${apiKindLabel}): WhatsApp para operacional ${assignedEmail} e ${masters.length} master(s).`,
  );

  for (const master of masters) {
    const masterWhatsapp = String(master.whatsapp ?? "").trim();
    if (!masterWhatsapp.replace(/\D/g, "") || masterWhatsapp.replace(/\D/g, "").length < 10) {
      recipients.push(
        buildSkippedRecipient({
          role: "master",
          user: master,
          message: "WhatsApp master inválido ou ausente.",
        }),
      );
      continue;
    }

    const masterWhatsappDelivery = await deliverOperacionalNewCampaignWhatsApp({
      recipientEmail: master.email,
      recipientName: master.fullName,
      whatsapp: masterWhatsapp,
      ...templateBase,
    });
    const masterStatus: WabaEmailDeliveryStatus =
      masterWhatsappDelivery.status === "sent"
        ? "sent"
        : masterWhatsappDelivery.status === "failed"
          ? "failed"
          : "skipped";

    recipients.push({
      role: "master",
      email: master.email.trim().toLowerCase(),
      fullName: master.fullName,
      status: masterStatus,
      message: `WhatsApp: ${masterWhatsappDelivery.message}`,
      emailStatus: "skipped",
      emailMessage: "E-mail não enviado para master.",
      whatsapp: masterWhatsapp,
      whatsappStatus: masterWhatsappDelivery.status,
      whatsappMessage: masterWhatsappDelivery.message,
      whatsappInstanceName: masterWhatsappDelivery.instanceName,
    });
  }

  return {
    attemptedAt,
    apiKind,
    apiKindLabel,
    recipients,
  };
};

export const notifyOperacionalStaffOnCampaignAssigned = async (
  intake: WabaCampaignIntake,
): Promise<OperacionalNotifyResult> => notifyAssignedOperacionalAndMasters(intake);

export const notifyOperacionalStaffOnCampaignCreated = async (
  intake: WabaCampaignIntake,
): Promise<OperacionalNotifyResult> => notifyAssignedOperacionalAndMasters(intake);
