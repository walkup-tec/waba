"use strict";
/**
 * Origem do assinante na lista do master (Site vs usuário que cadastrou).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSubscriberOrigin = exports.isWalkupMasterEmail = exports.WALKUP_MASTER_EMAIL = void 0;
exports.WALKUP_MASTER_EMAIL = "walkup@walkuptec.com.br";
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isWalkupMasterEmail = (email) => normalizeEmail(email) === exports.WALKUP_MASTER_EMAIL;
exports.isWalkupMasterEmail = isWalkupMasterEmail;
const resolveSubscriberOrigin = (subscriber, users = []) => {
    const createdBy = normalizeEmail(String(subscriber?.createdByEmail || ""));
    if (createdBy.includes("@")) {
        const user = users.find((item) => normalizeEmail(String(item.email || "")) === createdBy);
        const name = String(user?.fullName || "").trim();
        return {
            kind: "user",
            label: name || createdBy,
            userEmail: createdBy,
        };
    }
    const indicatorId = String(subscriber?.indicatorUserId || "").trim();
    if (indicatorId) {
        const user = users.find((item) => String(item.id || "").trim() === indicatorId);
        const name = String(user?.fullName || "").trim();
        return {
            kind: "user",
            label: name || "Indicador",
            userEmail: normalizeEmail(String(user?.email || "")),
        };
    }
    return { kind: "site", label: "Site", userEmail: "" };
};
exports.resolveSubscriberOrigin = resolveSubscriberOrigin;
