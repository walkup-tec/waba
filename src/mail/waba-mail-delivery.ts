import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import {
  buildCampaignReportDeepLink,
  buildCampaignListDeepLink,
  buildOperacionalAdminCampaignDeepLink,
  resolveWabaAppLoginUrl,
} from "./waba-app-url";
import {
  buildCampaignCompletedTemplate,
  buildCampaignErrorReportedTemplate,
  buildOperacionalNewCampaignTemplate,
  buildSubscriberWelcomeTemplate,
  buildSupportTicketClosedTemplate,
} from "./waba-mail.templates";
import { wabaMailService } from "./waba-mail.service";

export type WabaEmailDeliveryStatus = "sent" | "skipped" | "failed";

export type WabaEmailDeliveryResult = {
  status: WabaEmailDeliveryStatus;
  message: string;
  messageId?: string;
};

const subscriberRepository = new WabaSubscriberRepository();

const resolveSubscriberName = (email: string): string => {
  const subscriber = subscriberRepository.getByEmail(email);
  return String(subscriber?.fullName || "").trim();
};

const deliverEmail = async (input: {
  toEmail: string;
  subject: string;
  html: string;
  logLabel: string;
}): Promise<WabaEmailDeliveryResult> => {
  const toEmail = String(input.toEmail || "")
    .trim()
    .toLowerCase();
  if (!toEmail.includes("@")) {
    return { status: "skipped", message: `${input.logLabel}: destinatário sem e-mail válido.` };
  }
  if (!wabaMailService.isConfigured()) {
    return {
      status: "skipped",
      message: `${input.logLabel}: SMTP não configurado (MAIL_MODE=smtp, SMTP_*).`,
    };
  }

  try {
    const delivery = await wabaMailService.send({
      to: toEmail,
      subject: input.subject,
      html: input.html,
    });
    console.log(`[mail] ${input.logLabel} enviado para ${toEmail} (${delivery.messageId || "ok"}).`);
    return {
      status: "sent",
      message: "E-mail enviado.",
      messageId: delivery.messageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar e-mail.";
    console.error(`[mail] ${input.logLabel} falhou para ${toEmail}:`, message);
    return { status: "failed", message };
  }
};

export const deliverSupportTicketClosedEmail = async (input: {
  ownerEmail: string;
  ownerName: string;
  displayId: string;
  ticketTitle: string;
  masterResponse: string;
}): Promise<WabaEmailDeliveryResult> => {
  const ownerEmail = String(input.ownerEmail || "")
    .trim()
    .toLowerCase();
  const ownerName = String(input.ownerName || "").trim() || resolveSubscriberName(ownerEmail);
  const mail = buildSupportTicketClosedTemplate({
    recipientName: ownerName,
    recipientEmail: ownerEmail,
    displayId: input.displayId,
    ticketTitle: input.ticketTitle,
    masterResponse: input.masterResponse,
  });
  return deliverEmail({
    toEmail: ownerEmail,
    subject: mail.subject,
    html: mail.html,
    logLabel: `chamado ${input.displayId || input.ownerEmail}`,
  });
};

export const deliverCampaignCompletedEmail = async (input: {
  ownerEmail: string;
  campaignId: string;
  campaignName: string;
}): Promise<WabaEmailDeliveryResult> => {
  const ownerEmail = String(input.ownerEmail || "")
    .trim()
    .toLowerCase();
  const ownerName = resolveSubscriberName(ownerEmail);
  const reportUrl = buildCampaignReportDeepLink(input.campaignId);
  const mail = buildCampaignCompletedTemplate({
    recipientName: ownerName,
    recipientEmail: ownerEmail,
    campaignName: input.campaignName,
    reportUrl,
  });
  return deliverEmail({
    toEmail: ownerEmail,
    subject: mail.subject,
    html: mail.html,
    logLabel: `campanha ${input.campaignId}`,
  });
};

export const deliverCampaignErrorReportedEmail = async (input: {
  ownerEmail: string;
  campaignId: string;
  campaignName: string;
}): Promise<WabaEmailDeliveryResult> => {
  const ownerEmail = String(input.ownerEmail || "")
    .trim()
    .toLowerCase();
  const ownerName = resolveSubscriberName(ownerEmail);
  const campaignsUrl = buildCampaignListDeepLink();
  const mail = buildCampaignErrorReportedTemplate({
    recipientName: ownerName,
    recipientEmail: ownerEmail,
    campaignName: input.campaignName,
    campaignsUrl,
  });
  return deliverEmail({
    toEmail: ownerEmail,
    subject: mail.subject,
    html: mail.html,
    logLabel: `campanha erro ${input.campaignId}`,
  });
};

export const deliverSubscriberWelcomeEmail = async (input: {
  email: string;
  fullName: string;
  whatsapp: string;
  phone: string;
  cpfCnpj: string;
  loginUrl?: string;
}): Promise<WabaEmailDeliveryResult> => {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const loginUrl = String(input.loginUrl || resolveWabaAppLoginUrl()).trim() || resolveWabaAppLoginUrl();
  const mail = buildSubscriberWelcomeTemplate({
    recipientName: input.fullName,
    recipientEmail: email,
    whatsapp: input.whatsapp,
    phone: input.phone,
    cpfCnpj: input.cpfCnpj,
    loginUrl,
  });
  return deliverEmail({
    toEmail: email,
    subject: mail.subject,
    html: mail.html,
    logLabel: `boas-vindas ${email}`,
  });
};

export const notifySupportTicketClosedEmail = (input: {
  ownerEmail: string;
  ownerName: string;
  displayId: string;
  ticketTitle: string;
  masterResponse: string;
}): void => {
  void deliverSupportTicketClosedEmail(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] chamado finalizado (async):", message);
  });
};

export const notifyCampaignCompletedEmail = (input: {
  ownerEmail: string;
  campaignId: string;
  campaignName: string;
}): void => {
  void deliverCampaignCompletedEmail(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] campanha finalizada (async):", message);
  });
};

export const notifyCampaignErrorReportedEmail = (input: {
  ownerEmail: string;
  campaignId: string;
  campaignName: string;
}): void => {
  void deliverCampaignErrorReportedEmail(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] campanha erro reportado (async):", message);
  });
};

export const deliverOperacionalNewCampaignEmail = async (input: {
  operacionalEmail: string;
  operacionalName: string;
  campaignId: string;
  campaignName: string;
  subscriberId: string;
  plannedSendCount: number;
  createdAtLabel: string;
  apiKindLabel: string;
}): Promise<WabaEmailDeliveryResult> => {
  const operacionalEmail = String(input.operacionalEmail || "")
    .trim()
    .toLowerCase();
  const operacionalName = String(input.operacionalName || "").trim();
  const campaignUrl = buildOperacionalAdminCampaignDeepLink(input.campaignId);
  const mail = buildOperacionalNewCampaignTemplate({
    recipientName: operacionalName,
    recipientEmail: operacionalEmail,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    subscriberId: input.subscriberId,
    plannedSendCount: input.plannedSendCount,
    createdAtLabel: input.createdAtLabel,
    apiKindLabel: input.apiKindLabel,
    campaignUrl,
  });
  return deliverEmail({
    toEmail: operacionalEmail,
    subject: mail.subject,
    html: mail.html,
    logLabel: `operacional nova campanha ${input.campaignId}`,
  });
};

export const notifyOperacionalNewCampaignEmail = (input: {
  operacionalEmail: string;
  operacionalName: string;
  campaignId: string;
  campaignName: string;
  subscriberId: string;
  plannedSendCount: number;
  createdAtLabel: string;
  apiKindLabel: string;
}): void => {
  void deliverOperacionalNewCampaignEmail(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] operacional nova campanha (async):", message);
  });
};

export const notifySubscriberWelcomeEmail = (input: {
  email: string;
  fullName: string;
  whatsapp: string;
  phone: string;
  cpfCnpj: string;
  loginUrl?: string;
}): void => {
  void deliverSubscriberWelcomeEmail(input).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail] boas-vindas cadastro (async):", message);
  });
};
