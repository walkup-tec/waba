"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLinkableLabCampaignStatus = isLinkableLabCampaignStatus;
exports.formatCloudLinkableCampaignLabel = formatCloudLinkableCampaignLabel;
const waba_campaign_intake_status_1 = require("../../disparos/waba-campaign-intake-status");
function isLinkableLabCampaignStatus(status) {
    return (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(status) === "in_progress";
}
function formatCloudLinkableCampaignLabel(input) {
    const subscriber = String(input.subscriberName || "").trim() ||
        String(input.ownerEmail || "").trim() ||
        "Assinante";
    const campaign = String(input.campaignName || "").trim() || "Campanha";
    const envios = Math.max(0, Math.round(Number(input.plannedSendCount) || 0));
    return `${subscriber} - ${campaign} - ${envios}`;
}
