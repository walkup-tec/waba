import {
  buildMasterBmInoperanteCampaignWhatsAppText,
  buildMasterNewCampaignWhatsAppText,
  buildOperacionalNewCampaignWhatsAppText,
  type MasterBmInoperanteCampaignTemplateInput,
  type OperacionalNewCampaignTemplateInput,
} from "./waba-mail.templates";
import { deliverWabaEvolutionWhatsApp } from "./waba-evolution-whatsapp-delivery.service";
import type { WabaWhatsAppDeliveryResult } from "./waba-welcome-whatsapp.service";

export type OperacionalCampaignWhatsAppInput = OperacionalNewCampaignTemplateInput & {
  whatsapp: string;
};

export type MasterBmInoperanteCampaignWhatsAppInput = MasterBmInoperanteCampaignTemplateInput & {
  whatsapp: string;
};

const buildDeliveryRetryKey = (input: OperacionalCampaignWhatsAppInput): string => {
  const campaignId = String(input.campaignId || "").trim();
  const email = String(input.recipientEmail || "").trim().toLowerCase();
  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  return `${campaignId}:${email}:${whatsapp}`;
};

const buildBmInoperanteRetryKey = (input: MasterBmInoperanteCampaignWhatsAppInput): string => {
  const campaignId = String(input.campaignId || "").trim();
  const email = String(input.recipientEmail || "").trim().toLowerCase();
  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  return `bm-inoperante:${campaignId}:${email}:${whatsapp}`;
};

export const deliverOperacionalNewCampaignWhatsApp = async (
  input: OperacionalCampaignWhatsAppInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const text =
    input.recipientRole === "master"
      ? buildMasterNewCampaignWhatsAppText(input)
      : buildOperacionalNewCampaignWhatsAppText(input);
  return deliverWabaEvolutionWhatsApp({
    targetWhatsapp: input.whatsapp,
    recipientEmail: input.recipientEmail,
    text,
    logLabel: input.recipientRole === "master" ? "master campanha" : "operacional campanha",
    backgroundRetryKey: buildDeliveryRetryKey(input),
  });
};

export const deliverMasterBmInoperanteCampaignWhatsApp = async (
  input: MasterBmInoperanteCampaignWhatsAppInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const text = buildMasterBmInoperanteCampaignWhatsAppText(input);
  return deliverWabaEvolutionWhatsApp({
    targetWhatsapp: input.whatsapp,
    recipientEmail: input.recipientEmail,
    text,
    logLabel: "master bm inoperante",
    backgroundRetryKey: buildBmInoperanteRetryKey(input),
  });
};
