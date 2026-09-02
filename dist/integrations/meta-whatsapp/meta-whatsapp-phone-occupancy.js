"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCloudPhoneBusyForCampaign = isCloudPhoneBusyForCampaign;
exports.collectBusyCloudPhoneNumberIds = collectBusyCloudPhoneNumberIds;
exports.listBusyCloudPhoneNumberIds = listBusyCloudPhoneNumberIds;
exports.applyCloudPhoneOccupancy = applyCloudPhoneOccupancy;
const waba_campaign_intake_repository_1 = require("../../disparos/waba-campaign-intake.repository");
const waba_campaign_intake_status_1 = require("../../disparos/waba-campaign-intake-status");
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
function isCloudPhoneBusyForCampaign(input) {
    if (input.intakeStatus) {
        const intake = (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(input.intakeStatus);
        if (intake === "completed" || intake === "error_reported" || intake === "cancelled") {
            return false;
        }
        if (intake === "generated" || intake === "in_progress") {
            return true;
        }
    }
    return input.broadcastStatus === "queued" || input.broadcastStatus === "running";
}
function collectBusyCloudPhoneNumberIds(campaigns, intakeStatusById) {
    const busy = new Set();
    for (const row of campaigns) {
        const phoneId = String(row.phoneNumberId || "").trim();
        if (!phoneId)
            continue;
        const intakeId = String(row.intakeCampaignId || "").trim();
        const intakeStatus = intakeId ? intakeStatusById.get(intakeId) : undefined;
        if (isCloudPhoneBusyForCampaign({
            broadcastStatus: row.status,
            intakeStatus,
        })) {
            busy.add(phoneId);
        }
    }
    return busy;
}
function listBusyCloudPhoneNumberIds(tenantId) {
    const campaigns = (0, meta_whatsapp_broadcast_store_1.listAllBroadcastCampaigns)(tenantId);
    const intakeIds = [
        ...new Set(campaigns.map((row) => String(row.intakeCampaignId || "").trim()).filter(Boolean)),
    ];
    const intakeStatusById = new Map();
    if (intakeIds.length) {
        const intakes = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
        for (const id of intakeIds) {
            const intake = intakes.getById(id);
            if (intake)
                intakeStatusById.set(id, intake.status);
        }
    }
    return collectBusyCloudPhoneNumberIds(campaigns, intakeStatusById);
}
function applyCloudPhoneOccupancy(tenantId, numbers, busyPhoneIds) {
    const busy = busyPhoneIds || listBusyCloudPhoneNumberIds(tenantId);
    return numbers.map((row) => ({
        ...row,
        dispatchStatus: busy.has(String(row.phoneNumberId || "").trim()) ? "em_disparo" : "livre",
    }));
}
