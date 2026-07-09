"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverMasterBmInoperanteCampaignWhatsApp = exports.deliverOperacionalNewCampaignWhatsApp = void 0;
const waba_mail_templates_1 = require("./waba-mail.templates");
const waba_evolution_whatsapp_delivery_service_1 = require("./waba-evolution-whatsapp-delivery.service");
const buildDeliveryRetryKey = (input) => {
    const campaignId = String(input.campaignId || "").trim();
    const email = String(input.recipientEmail || "").trim().toLowerCase();
    const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
    return `${campaignId}:${email}:${whatsapp}`;
};
const buildBmInoperanteRetryKey = (input) => {
    const campaignId = String(input.campaignId || "").trim();
    const email = String(input.recipientEmail || "").trim().toLowerCase();
    const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
    return `bm-inoperante:${campaignId}:${email}:${whatsapp}`;
};
const deliverOperacionalNewCampaignWhatsApp = async (input) => {
    const text = input.recipientRole === "master"
        ? (0, waba_mail_templates_1.buildMasterNewCampaignWhatsAppText)(input)
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
