"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canAdvanceMetaMessageStatus = canAdvanceMetaMessageStatus;
exports.mapWebhookStatus = mapWebhookStatus;
const STATUS_RANK = {
    queued: 0,
    accepted: 1,
    sent: 2,
    delivered: 3,
    read: 4,
    failed: 50,
};
function canAdvanceMetaMessageStatus(current, next) {
    if (current === next)
        return false;
    if (current === "failed")
        return false;
    if (current === "read" && next !== "failed")
        return false;
    if (next === "failed") {
        return current === "queued" || current === "accepted" || current === "sent";
    }
    return STATUS_RANK[next] > STATUS_RANK[current];
}
function mapWebhookStatus(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (value === "sent")
        return "sent";
    if (value === "delivered")
        return "delivered";
    if (value === "read")
        return "read";
    if (value === "failed")
        return "failed";
    return null;
}
