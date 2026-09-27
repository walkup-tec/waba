import { writeFileSync } from "node:fs";
import path from "node:path";
import { resolveCampaignIntakeStorageDir, type WabaCampaignPayoutApproval } from "./waba-campaign-intake.repository";

export const PAYOUT_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;

export const PAYOUT_EVIDENCE_REQUIRED_MESSAGE =
  "Envie o print da tela com os indicadores da campanha.";

export const PAYOUT_EVIDENCE_INVALID_TYPE_MESSAGE =
  "O print deve ser uma imagem JPEG, PNG ou WebP.";

export const PAYOUT_EVIDENCE_TOO_LARGE_MESSAGE =
  "O print deve ter no máximo 8 MB.";

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type PayoutEvidenceUpload = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
};

const normalizeMime = (value: string): string => String(value || "").trim().toLowerCase();

export const isAllowedPayoutEvidenceMime = (mimeType: string): boolean => {
  const mime = normalizeMime(mimeType);
  return ALLOWED_MIME.has(mime) || mime === "image/jpg";
};

export const resolvePayoutEvidenceExtension = (mimeType: string): string => {
  const mime = normalizeMime(mimeType);
  if (mime === "image/webp") return ".webp";
  if (mime === "image/png") return ".png";
  return ".jpg";
};

export const assertPayoutEvidenceUpload = (file: PayoutEvidenceUpload | null | undefined): PayoutEvidenceUpload => {
  if (!file?.buffer?.length) {
    throw new Error(PAYOUT_EVIDENCE_REQUIRED_MESSAGE);
  }
  if (file.buffer.length > PAYOUT_EVIDENCE_MAX_BYTES) {
    throw new Error(PAYOUT_EVIDENCE_TOO_LARGE_MESSAGE);
  }
  if (!isAllowedPayoutEvidenceMime(file.mimeType)) {
    throw new Error(PAYOUT_EVIDENCE_INVALID_TYPE_MESSAGE);
  }
  return file;
};

export const persistCampaignPayoutEvidence = (
  campaignId: string,
  file: PayoutEvidenceUpload | null | undefined,
): Pick<WabaCampaignPayoutApproval, "evidenceFileName" | "evidenceStoredPath" | "evidenceMimeType"> => {
  const valid = assertPayoutEvidenceUpload(file);
  const id = String(campaignId || "").trim();
  if (!id) throw new Error("Campanha não encontrada.");
  const ext = resolvePayoutEvidenceExtension(valid.mimeType);
  const storedName = `payout-evidence${ext}`;
  const dir = resolveCampaignIntakeStorageDir(id);
  const storedPath = path.join(dir, storedName);
  writeFileSync(storedPath, valid.buffer);
  const original = path.basename(String(valid.originalName || "").trim()) || storedName;
  const originalExt = path.extname(original).toLowerCase();
  const fileName = originalExt ? original : `${original}${ext}`;
  return {
    evidenceFileName: fileName,
    evidenceStoredPath: storedPath,
    evidenceMimeType: normalizeMime(valid.mimeType) === "image/jpg" ? "image/jpeg" : normalizeMime(valid.mimeType),
  };
};

export const isPendingMasterPayoutApproval = (
  approval: WabaCampaignPayoutApproval | null | undefined,
): boolean => String(approval?.status || "").trim() === "pending_master";

export const isApprovedMasterPayoutApproval = (
  approval: WabaCampaignPayoutApproval | null | undefined,
): boolean => String(approval?.status || "").trim() === "approved";
