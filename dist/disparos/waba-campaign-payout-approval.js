"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApprovedMasterPayoutApproval = exports.isPendingMasterPayoutApproval = exports.persistCampaignPayoutEvidence = exports.assertPayoutEvidenceUpload = exports.resolvePayoutEvidenceExtension = exports.isAllowedPayoutEvidenceMime = exports.PAYOUT_EVIDENCE_TOO_LARGE_MESSAGE = exports.PAYOUT_EVIDENCE_INVALID_TYPE_MESSAGE = exports.PAYOUT_EVIDENCE_REQUIRED_MESSAGE = exports.PAYOUT_EVIDENCE_MAX_BYTES = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const waba_campaign_intake_repository_1 = require("./waba-campaign-intake.repository");
exports.PAYOUT_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
exports.PAYOUT_EVIDENCE_REQUIRED_MESSAGE = "Envie o print da tela com os indicadores da campanha.";
exports.PAYOUT_EVIDENCE_INVALID_TYPE_MESSAGE = "O print deve ser uma imagem JPEG, PNG ou WebP.";
exports.PAYOUT_EVIDENCE_TOO_LARGE_MESSAGE = "O print deve ter no máximo 8 MB.";
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const normalizeMime = (value) => String(value || "").trim().toLowerCase();
const isAllowedPayoutEvidenceMime = (mimeType) => {
    const mime = normalizeMime(mimeType);
    return ALLOWED_MIME.has(mime) || mime === "image/jpg";
};
exports.isAllowedPayoutEvidenceMime = isAllowedPayoutEvidenceMime;
const resolvePayoutEvidenceExtension = (mimeType) => {
    const mime = normalizeMime(mimeType);
    if (mime === "image/webp")
        return ".webp";
    if (mime === "image/png")
        return ".png";
    return ".jpg";
};
exports.resolvePayoutEvidenceExtension = resolvePayoutEvidenceExtension;
const assertPayoutEvidenceUpload = (file) => {
    if (!file?.buffer?.length) {
        throw new Error(exports.PAYOUT_EVIDENCE_REQUIRED_MESSAGE);
    }
    if (file.buffer.length > exports.PAYOUT_EVIDENCE_MAX_BYTES) {
        throw new Error(exports.PAYOUT_EVIDENCE_TOO_LARGE_MESSAGE);
    }
    if (!(0, exports.isAllowedPayoutEvidenceMime)(file.mimeType)) {
        throw new Error(exports.PAYOUT_EVIDENCE_INVALID_TYPE_MESSAGE);
    }
    return file;
};
exports.assertPayoutEvidenceUpload = assertPayoutEvidenceUpload;
const persistCampaignPayoutEvidence = (campaignId, file) => {
    const valid = (0, exports.assertPayoutEvidenceUpload)(file);
    const id = String(campaignId || "").trim();
    if (!id)
        throw new Error("Campanha não encontrada.");
    const ext = (0, exports.resolvePayoutEvidenceExtension)(valid.mimeType);
    const storedName = `payout-evidence${ext}`;
    const dir = (0, waba_campaign_intake_repository_1.resolveCampaignIntakeStorageDir)(id);
    const storedPath = node_path_1.default.join(dir, storedName);
    (0, node_fs_1.writeFileSync)(storedPath, valid.buffer);
    const original = node_path_1.default.basename(String(valid.originalName || "").trim()) || storedName;
    const originalExt = node_path_1.default.extname(original).toLowerCase();
    const fileName = originalExt ? original : `${original}${ext}`;
    return {
        evidenceFileName: fileName,
        evidenceStoredPath: storedPath,
        evidenceMimeType: normalizeMime(valid.mimeType) === "image/jpg" ? "image/jpeg" : normalizeMime(valid.mimeType),
    };
};
exports.persistCampaignPayoutEvidence = persistCampaignPayoutEvidence;
const isPendingMasterPayoutApproval = (approval) => String(approval?.status || "").trim() === "pending_master";
exports.isPendingMasterPayoutApproval = isPendingMasterPayoutApproval;
const isApprovedMasterPayoutApproval = (approval) => String(approval?.status || "").trim() === "approved";
exports.isApprovedMasterPayoutApproval = isApprovedMasterPayoutApproval;
