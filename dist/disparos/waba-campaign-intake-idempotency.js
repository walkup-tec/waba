"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCampaignIntakeDuplicateWindowMs = exports.buildCampaignIntakeSubmissionFingerprint = exports.withCampaignIntakeSubmissionLock = void 0;
/** Serializa POSTs concorrentes com a mesma chave (clientRequestId ou fingerprint). */
const submissionLocks = new Map();
const withCampaignIntakeSubmissionLock = async (key, fn) => {
    const normalized = String(key || "").trim();
    if (!normalized)
        return fn();
    while (submissionLocks.has(normalized)) {
        await submissionLocks.get(normalized);
    }
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    submissionLocks.set(normalized, gate);
    try {
        return await fn();
    }
    finally {
        submissionLocks.delete(normalized);
        release();
    }
};
exports.withCampaignIntakeSubmissionLock = withCampaignIntakeSubmissionLock;
const buildCampaignIntakeSubmissionFingerprint = (input) => {
    const parts = [
        String(input.campaignName || "").trim().toLowerCase(),
        String(input.regionDdd || "").trim(),
        String(Math.max(0, Math.round(Number(input.plannedSendCount || 0)))),
        String(input.apiKind || "").trim().toLowerCase(),
        String(Math.max(0, Math.round(Number(input.imageByteLength || 0)))),
        String(Math.max(0, Math.round(Number(input.spreadsheetByteLength || 0)))),
    ];
    return parts.join("|");
};
exports.buildCampaignIntakeSubmissionFingerprint = buildCampaignIntakeSubmissionFingerprint;
const resolveCampaignIntakeDuplicateWindowMs = () => {
    const raw = process.env.WABA_CAMPAIGN_INTAKE_DUPLICATE_WINDOW_MS;
    if (raw !== undefined && String(raw).trim() !== "") {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 30000)
            return Math.min(600000, Math.round(n));
    }
    return 300000;
};
exports.resolveCampaignIntakeDuplicateWindowMs = resolveCampaignIntakeDuplicateWindowMs;
