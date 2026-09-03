"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLOUD_BROADCAST_RESUME_WATCHDOG_MS = void 0;
exports.buildCloudBroadcastProtectSnapshot = buildCloudBroadcastProtectSnapshot;
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
/** Intervalo do guardião em processo (retoma loop morto sem Redeploy). */
exports.CLOUD_BROADCAST_RESUME_WATCHDOG_MS = 20000;
function pendingCount(row) {
    return (row.leads || []).filter(meta_whatsapp_broadcast_store_1.broadcastLeadIsPendingSend).length;
}
/**
 * Snapshot seguro para /health — sem tokens, telefones ou conteúdo de leads.
 * Operacional e agentes usam `blockRedeploy` antes de Redeploy EasyPanel.
 */
function buildCloudBroadcastProtectSnapshot(input) {
    const items = input.campaigns
        .filter((row) => {
        if (String(row.voidedAt || "").trim())
            return false;
        return row.status === "running" || row.status === "queued";
    })
        .map((row) => {
        const pending = pendingCount(row);
        return {
            id: row.id,
            tenantId: row.tenantId,
            templateName: String(row.templateName || "").slice(0, 80),
            ...(row.intakeCampaignId ? { intakeCampaignId: row.intakeCampaignId } : {}),
            status: row.status,
            sent: Math.max(0, Number(row.sent) || 0),
            failed: Math.max(0, Number(row.failed) || 0),
            total: Math.max(0, Number(row.total) || 0),
            pending,
            loopAlive: input.isLoopAlive(row.id),
        };
    })
        .sort((a, b) => b.pending - a.pending || a.id.localeCompare(b.id));
    const pendingLeads = items.reduce((sum, item) => sum + item.pending, 0);
    return {
        active: items.length > 0,
        count: items.length,
        pendingLeads,
        blockRedeploy: items.some((item) => item.pending > 0 || item.status === "running"),
        resumeWatchdogMs: Math.max(5000, Number(input.watchdogMs) || exports.CLOUD_BROADCAST_RESUME_WATCHDOG_MS),
        policy: "resume_on_boot_and_watchdog",
        items,
    };
}
