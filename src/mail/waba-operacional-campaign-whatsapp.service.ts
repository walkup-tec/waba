import {
  buildMasterBmInoperanteCampaignWhatsAppText,
  buildMasterCampaignReassignedWhatsAppText,
  buildMasterNewCampaignWhatsAppText,
  buildOperacionalCampaignReassignedWhatsAppText,
  buildOperacionalNewCampaignWhatsAppText,
  type MasterBmInoperanteCampaignTemplateInput,
  type OperacionalNewCampaignTemplateInput,
} from "./waba-mail.templates";
import { deliverWabaEvolutionWhatsApp } from "./waba-evolution-whatsapp-delivery.service";
import type { WabaWhatsAppDeliveryResult } from "./waba-welcome-whatsapp.service";

export type OperacionalCampaignWhatsAppInput = OperacionalNewCampaignTemplateInput & {
  whatsapp: string;
  /** Atribuição inicial vs transferência/reatribuição. */
  notifyEvent?: "assigned" | "reassigned";
};

export type MasterBmInoperanteCampaignWhatsAppInput = MasterBmInoperanteCampaignTemplateInput & {
  whatsapp: string;
};

const buildDeliveryRetryKey = (input: OperacionalCampaignWhatsAppInput): string => {
  const campaignId = String(input.campaignId || "").trim();
  const event = input.notifyEvent === "reassigned" ? "reassigned" : "assigned";
  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  const phoneKey = whatsapp.length >= 11 ? whatsapp.slice(-11) : whatsapp;
  return `${event}:${campaignId}:wa:${phoneKey}`;
};

const buildBmInoperanteRetryKey = (input: MasterBmInoperanteCampaignWhatsAppInput): string => {
  const campaignId = String(input.campaignId || "").trim();
  const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
  const phoneKey = whatsapp.length >= 11 ? whatsapp.slice(-11) : whatsapp;
  return `bm-inoperante:${campaignId}:wa:${phoneKey}`;
};

export const deliverOperacionalNewCampaignWhatsApp = async (
  input: OperacionalCampaignWhatsAppInput,
): Promise<WabaWhatsAppDeliveryResult> => {
  const reassigned = input.notifyEvent === "reassigned";
  const text =
    input.recipientRole === "master"
      ? reassigned
        ? buildMasterCampaignReassignedWhatsAppText(input)
        : buildMasterNewCampaignWhatsAppText(input)
      : reassigned
        ? buildOperacionalCampaignReassignedWhatsAppText(input)
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
