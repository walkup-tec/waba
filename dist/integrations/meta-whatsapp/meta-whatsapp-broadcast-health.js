"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLOUD_BROADCAST_NOT_SENDING_MS = exports.CLOUD_BROADCAST_STALL_MS = exports.CLOUD_BROADCAST_MISSED_SCHEDULE_GRACE_MS = void 0;
exports.evaluateCloudBroadcastHealth = evaluateCloudBroadcastHealth;
const meta_whatsapp_broadcast_void_1 = require("./meta-whatsapp-broadcast-void");
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
const HEALTHY = { ok: true, key: "ok", label: "" };
/** Horário agendado passou e o loop ainda não começou. */
exports.CLOUD_BROADCAST_MISSED_SCHEDULE_GRACE_MS = 90000;
/** `updatedAt` parado com leads pendentes — o loop grava a cada envio. */
exports.CLOUD_BROADCAST_STALL_MS = 150000;
/** Campanha `running` sem nenhum processamento. */
exports.CLOUD_BROADCAST_NOT_SENDING_MS = 180000;
function parseIsoMs(value) {
    const parsed = Date.parse(String(value || "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
}
function processedCount(row) {
    return Math.max(0, Math.round(Number(row.sent || 0))) + Math.max(0, Math.round(Number(row.failed || 0)));
}
function evaluateCloudBroadcastHealth(row, nowMs = Date.now()) {
    if (!row)
        return HEALTHY;
    if (String(row.voidedAt || "").trim() || String(row.pausedAt || "").trim() || String(row.hiddenAt || "").trim()) {
        return HEALTHY;
    }
    if (row.status === "done" || row.status === "failed")
        return HEALTHY;
    if ((0, meta_whatsapp_broadcast_void_1.shouldAbortBroadcastOnHeaderMediaFailure)(row)) {
        return {
            ok: false,
            key: "header_media",
            label: "Cabeçalho recusado — o lote não está entregando",
        };
    }
    const processed = processedCount(row);
    const scheduledMs = parseIsoMs(row.scheduledSendAt);
    if (row.status === "queued" && scheduledMs && scheduledMs + exports.CLOUD_BROADCAST_MISSED_SCHEDULE_GRACE_MS < nowMs && processed === 0) {
        return {
            ok: false,
            key: "missed_schedule",
            label: "Horário passou e o disparo não começou",
        };
    }
    if (row.status !== "running")
        return HEALTHY;
    const updatedMs = parseIsoMs(row.updatedAt);
    const startedMs = parseIsoMs(row.sendStartedAt);
    const pending = (row.leads || []).some(meta_whatsapp_broadcast_store_1.broadcastLeadIsPendingSend);
    if (processed === 0) {
        const referenceMs = startedMs || updatedMs;
        if (referenceMs && nowMs - referenceMs > exports.CLOUD_BROADCAST_NOT_SENDING_MS) {
            return {
                ok: false,
                key: "not_sending",
                label: "Campanha aberta, mas nenhuma mensagem saiu",
            };
        }
    }
    if (pending && updatedMs && nowMs - updatedMs > exports.CLOUD_BROADCAST_STALL_MS) {
        return {
            ok: false,
            key: "stalled",
            label: "Disparo parado — não há envios recentes",
        };
    }
    return HEALTHY;
}
