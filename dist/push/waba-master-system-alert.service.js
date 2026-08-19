"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMasterAlertDismissedByEmail = exports.createMasterInAppAlert = void 0;
const waba_push_repository_1 = require("./waba-push.repository");
const pushRepository = new waba_push_repository_1.WabaPushRepository();
/** Alerta in-app no sininho do master (sem push externo). */
const createMasterInAppAlert = (input) => {
    const now = new Date().toISOString();
    const id = pushRepository.createId();
    const message = {
        id,
        title: String(input.title ?? "").trim() || "Alerta",
        originalText: String(input.message ?? "").trim(),
        reviewedText: String(input.message ?? "").trim(),
        image: null,
        audiences: ["users"],
        userRoles: ["master"],
        status: "sent",
        createdByEmail: String(input.createdByEmail ?? "system@waba.local").trim().toLowerCase(),
        createdAt: now,
        sentAt: now,
        deliveryResults: { users: { targeted: 0, roles: ["master"] } },
        dismissedBy: [],
    };
    pushRepository.save(message);
    return id;
};
exports.createMasterInAppAlert = createMasterInAppAlert;
const isMasterAlertDismissedByEmail = (alertId, masterEmail) => {
    const normalized = String(masterEmail ?? "").trim().toLowerCase();
    if (!normalized.includes("@"))
        return true;
    const row = pushRepository.getById(String(alertId ?? "").trim());
    if (!row)
        return true;
    return (row.dismissedBy || [])
        .map((value) => String(value ?? "").trim().toLowerCase())
        .includes(normalized);
};
exports.isMasterAlertDismissedByEmail = isMasterAlertDismissedByEmail;
