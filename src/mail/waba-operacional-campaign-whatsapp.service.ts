import {
  buildOperacionalNewCampaignWhatsAppText,
  type OperacionalNewCampaignTemplateInput,
} from "./waba-mail.templates";
import { deliverWabaEvolutionWhatsApp } from "./waba-evolution-whatsapp-delivery.service";
import type { WabaWhatsAppDeliveryResult } from "./waba-welcome-whatsapp.service";

export type OperacionalCampaignWhatsAppInput = OperacionalNewCampaignTemplateInput & {
  whatsapp: string;
};

const buildDeliveryRetryKey = (input: OperacionalCampaignWhatsAppInput): string => {
  const campaignId = String(input.campaignId || "").trim();
  const email = String(input.recipientEmail || "").trim().toLowerCase();
  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  return `${campaignId}:${email}:${whatsapp}`;
};

export const deliverOperacionalNewCampaignWhatsApp = async (
  input: OperacionalCampaignWhatsAppInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const text = buildOperacionalNewCampaignWhatsAppText(input);
  return deliverWabaEvolutionWhatsApp({
    targetWhatsapp: input.whatsapp,
    recipientEmail: input.recipientEmail,
    text,
    logLabel: "operacional campanha",
    backgroundRetryKey: buildDeliveryRetryKey(input),
  });
};
