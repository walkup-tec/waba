"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JANDIRA2_VOID_INTAKE_ID = exports.JANDIRA2_VOID_BROADCAST_ID = void 0;
exports.isBroadcastVoided = isBroadcastVoided;
exports.isBroadcastAbandonedForRetry = isBroadcastAbandonedForRetry;
exports.shouldVoidCloudBroadcast = shouldVoidCloudBroadcast;
exports.isCloudBroadcastInactiveForRetry = isCloudBroadcastInactiveForRetry;
/** Disparo Cloud da Jandira 2 que a Meta recusou (131053 / weblink 403). */
exports.JANDIRA2_VOID_BROADCAST_ID = "26d33b09-8868-41dd-af78-afd59e7982f2";
exports.JANDIRA2_VOID_INTAKE_ID = "368d053b-d59b-4eed-a235-fe9e9f32c68c";
function leadCountsAsDelivered(lead) {
    const meta = String(lead.metaStatus || "");
    return meta === "delivered" || meta === "read";
}
function leadCountsAsFailed(lead) {
    return lead.status === "failed" || String(lead.metaStatus || "") === "failed";
}
function isBroadcastVoided(row) {
    return Boolean(String(row?.voidedAt || "").trim());
}
/** Envio já terminou, ninguém recebeu e todos os leads falharam no webhook. */
function isBroadcastAbandonedForRetry(row) {
    if (!row)
        return false;
    if (row.status === "queued" || row.status === "running")
        return false;
    const leads = Array.isArray(row.leads) ? row.leads : [];
    if (!leads.length)
        return false;
    if (leads.some(leadCountsAsDelivered))
        return false;
    return leads.every((lead) => leadCountsAsFailed(lead) || lead.status === "skipped");
}
function shouldVoidCloudBroadcast(row) {
    if (isBroadcastVoided(row))
        return false;
    if (String(row.id || "") === exports.JANDIRA2_VOID_BROADCAST_ID)
        return true;
    if (String(row.intakeCampaignId || "") === exports.JANDIRA2_VOID_INTAKE_ID && isBroadcastAbandonedForRetry(row)) {
        return true;
    }
    return false;
}
function isCloudBroadcastInactiveForRetry(row) {
    if (!row)
        return true;
    return isBroadcastVoided(row) || isBroadcastAbandonedForRetry(row);
}
