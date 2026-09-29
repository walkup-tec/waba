"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOfficialWabaConnection = isOfficialWabaConnection;
exports.isOfficialSendConnection = isOfficialSendConnection;
const OFFICIAL_GRAPH_STATUSES = new Set([
    "connected",
    "pending_confirmation",
    "pending_token",
]);
/** Card do Lab com WABA: connected, pending_confirmation ou pending_token da BM convidada. */
function isOfficialWabaConnection(row, tenantId) {
    if (!row || row.disconnectedAt)
        return false;
    if (tenantId && row.tenantId !== tenantId)
        return false;
    if (!String(row.wabaId || "").trim())
        return false;
    return OFFICIAL_GRAPH_STATUSES.has(row.status);
}
/** Envio Cloud: mesmo card, com token e um número (no registro ou no disparo). */
function isOfficialSendConnection(row, tenantId, phoneNumberId) {
    if (!isOfficialWabaConnection(row, tenantId))
        return false;
    if (!String(row.accessTokenEncrypted || "").trim())
        return false;
    return Boolean(String(row.phoneNumberId || phoneNumberId || "").trim());
}
