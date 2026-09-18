"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrasiliaParts = getBrasiliaParts;
exports.resolveBrasiliaExpedienteTurno = resolveBrasiliaExpedienteTurno;
const BRASILIA_TZ = "America/Sao_Paulo";
function getBrasiliaParts(now = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: BRASILIA_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
    return { hour, minute };
}
function resolveBrasiliaExpedienteTurno(now = new Date()) {
    const { hour, minute } = getBrasiliaParts(now);
    const total = hour * 60 + minute;
    let id;
    let label;
    if (total >= 1 && total <= 12 * 60) {
        id = "bom_dia";
        label = "Bom dia";
    }
    else if (total >= 12 * 60 + 1 && total <= 18 * 60) {
        id = "boa_tarde";
        label = "Boa tarde";
    }
    else {
        id = "boa_noite";
        label = "Boa noite";
    }
    const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return { id, label, handle: id, hour, minute, timeLabel };
}
