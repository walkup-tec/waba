"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverMasterBmInoperanteCampaignWhatsApp = exports.deliverOperacionalNewCampaignWhatsApp = void 0;
const waba_mail_templates_1 = require("./waba-mail.templates");
const waba_evolution_whatsapp_delivery_service_1 = require("./waba-evolution-whatsapp-delivery.service");
const buildDeliveryRetryKey = (input) => {
    const campaignId = String(input.campaignId || "").trim();
    const event = input.notifyEvent === "reassigned" ? "reassigned" : "assigned";
    const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
    const phoneKey = whatsapp.length >= 11 ? whatsapp.slice(-11) : whatsapp;
    return `${event}:${campaignId}:wa:${phoneKey}`;
};
const buildBmInoperanteRetryKey = (input) => {
    const campaignId = String(input.campaignId || "").trim();
    const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
    const phoneKey = whatsapp.length >= 11 ? whatsapp.slice(-11) : whatsapp;
    return `bm-inoperante:${campaignId}:wa:${phoneKey}`;
};
const deliverOperacionalNewCampaignWhatsApp = async (input) => {
    const reassigned = input.notifyEvent === "reassigned";
    const text = input.recipientRole === "master"
        ? reassigned
            ? (0, waba_mail_templates_1.buildMasterCampaignReassignedWhatsAppText)(input)
            : (0, waba_mail_templates_1.buildMasterNewCampaignWhatsAppText)(input)
        : reassigned
            ? (0, waba_mail_templates_1.buildOperacionalCampaignReassignedWhatsAppText)(input)
            : (0, waba_mail_templates_1.buildOperacionalNewCampaignWhatsAppText)(input);
    return (0, waba_evolution_whatsapp_delivery_service_1.deliverWabaEvolutionWhatsApp)({
        targetWhatsapp: input.whatsapp,
        recipientEmail: input.recipientEmail,
        text,
        logLabel: input.recipientRole === "master" ? "master campanha" : "operacional campanha",
        backgroundRetryKey: buildDeliveryRetryKey(input),
    });
};
exports.deliverOperacionalNewCampaignWhatsApp = deliverOperacionalNewCampaignWhatsApp;
const deliverMasterBmInoperanteCampaignWhatsApp = async (input) => {
    const text = (0, waba_mail_templates_1.buildMasterBmInoperanteCampaignWhatsAppText)(input);
    return (0, waba_evolution_whatsapp_delivery_service_1.deliverWabaEvolutionWhatsApp)({
        targetWhatsapp: input.whatsapp,
        recipientEmail: input.recipientEmail,
        text,
        logLabel: "master bm inoperante",
        backgroundRetryKey: buildBmInoperanteRetryKey(input),
    });
};
exports.deliverMasterBmInoperanteCampaignWhatsApp = deliverMasterBmInoperanteCampaignWhatsApp;
