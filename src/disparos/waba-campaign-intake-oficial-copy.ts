import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../data-path";
import {
  resolveIntakeApiKindFromIntake,
  type WabaDispatchesApiKind,
} from "./waba-dispatches-api-kind";
import { normalizeCampaignIntakeStatus } from "./waba-campaign-intake-status";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";

export const OFFICIAL_CAMPAIGN_DUPLICATE_STATUSES = ["generated", "error_reported"] as const;
export const OFFICIAL_CAMPAIGN_EDIT_STATUSES = ["generated"] as const;

export type OfficialCampaignCopyErrorCode =
  | "not_found"
  | "forbidden"
  | "not_oficial"
  | "status_blocked";

export class OfficialCampaignCopyError extends Error {
  readonly code: OfficialCampaignCopyErrorCode;
  readonly statusCode: number;

  constructor(code: OfficialCampaignCopyErrorCode, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

const rewritePath = (value: string | undefined, sourceId: string, nextId: string): string => {
  const current = String(value || "").trim();
  if (!current) return current;
  return current.split(sourceId).join(nextId);
};

export function isOfficialCampaignIntake(intake: WabaCampaignIntake | null | undefined): boolean {
  if (!intake) return false;
  return resolveIntakeApiKindFromIntake(intake) === "oficial";
}

export function canDuplicateOfficialCampaign(
  intake: WabaCampaignIntake | null | undefined,
  ownerEmail: string,
): boolean {
  if (!intake) return false;
  if (intake.ownerEmail !== ownerEmail.trim().toLowerCase()) return false;
  if (!isOfficialCampaignIntake(intake)) return false;
  const status = normalizeCampaignIntakeStatus(intake.status);
  return status === "generated" || status === "error_reported";
}

export function canEditOfficialCampaign(
  intake: WabaCampaignIntake | null | undefined,
  ownerEmail: string,
): boolean {
  if (!intake) return false;
  if (intake.ownerEmail !== ownerEmail.trim().toLowerCase()) return false;
  if (!isOfficialCampaignIntake(intake)) return false;
  return normalizeCampaignIntakeStatus(intake.status) === "generated";
}

export function assertCanDuplicateOfficialCampaign(
  intake: WabaCampaignIntake | null | undefined,
  ownerEmail: string,
): WabaCampaignIntake {
  if (!intake) {
    throw new OfficialCampaignCopyError("not_found", "Campanha não encontrada.", 404);
  }
  if (intake.ownerEmail !== ownerEmail.trim().toLowerCase()) {
    throw new OfficialCampaignCopyError("forbidden", "Campanha não encontrada.", 404);
  }
  if (!isOfficialCampaignIntake(intake)) {
    throw new OfficialCampaignCopyError(
      "not_oficial",
      "Só é possível duplicar campanhas da API Oficial.",
    );
  }
  if (!canDuplicateOfficialCampaign(intake, ownerEmail)) {
    throw new OfficialCampaignCopyError(
      "status_blocked",
      "Só é possível duplicar campanhas com status Gerada ou Erro Reportado.",
    );
  }
  return intake;
}

export function assertCanEditOfficialCampaign(
  intake: WabaCampaignIntake | null | undefined,
  ownerEmail: string,
): WabaCampaignIntake {
  if (!intake) {
    throw new OfficialCampaignCopyError("not_found", "Campanha não encontrada.", 404);
  }
  if (intake.ownerEmail !== ownerEmail.trim().toLowerCase()) {
    throw new OfficialCampaignCopyError("forbidden", "Campanha não encontrada.", 404);
  }
  if (!isOfficialCampaignIntake(intake)) {
    throw new OfficialCampaignCopyError(
      "not_oficial",
      "Só é possível editar campanhas da API Oficial.",
    );
  }
  if (!canEditOfficialCampaign(intake, ownerEmail)) {
    throw new OfficialCampaignCopyError(
      "status_blocked",
      "Só é possível editar campanhas com status Gerada.",
    );
  }
  return intake;
}

export function buildOfficialCampaignCopyName(name: string): string {
  const base = String(name || "").trim() || "Campanha";
  const match = base.match(/^(.*)\s+\(c[oó]pia(?:\s+(\d+))?\)$/i);
  if (!match) return `${base} (cópia)`;
  const stem = String(match[1] || "").trim() || "Campanha";
  const next = match[2] ? Number(match[2]) + 1 : 2;
  return `${stem} (cópia ${Number.isFinite(next) ? next : 2})`;
}

export function copyOfficialCampaignIntakeFiles(
  source: WabaCampaignIntake,
  nextId: string,
): Pick<
  WabaCampaignIntake,
  | "imageStoredPath"
  | "whatsappLogoStoredPath"
  | "spreadsheetStoredPath"
  | "spreadsheetTrimmedPath"
> {
  const dataDir = resolveDataDir();
  const srcDir = path.join(dataDir, "campaign-intakes", source.id);
  const destDir = path.join(dataDir, "campaign-intakes", nextId);
  mkdirSync(destDir, { recursive: true });
  if (existsSync(srcDir)) {
    for (const name of readdirSync(srcDir)) {
      const from = path.join(srcDir, name);
      if (statSync(from).isFile()) copyFileSync(from, path.join(destDir, name));
    }
  }

  const copyIfOutside = (value: string | undefined): string => {
    const current = String(value || "").trim();
    if (!current || !existsSync(current)) return rewritePath(current, source.id, nextId);
    const rewritten = rewritePath(current, source.id, nextId);
    if (rewritten && rewritten !== current) {
      mkdirSync(path.dirname(rewritten), { recursive: true });
      if (!existsSync(rewritten)) copyFileSync(current, rewritten);
      return rewritten;
    }
    return current;
  };

  return {
    imageStoredPath: copyIfOutside(source.imageStoredPath),
    whatsappLogoStoredPath: copyIfOutside(source.whatsappLogoStoredPath),
    spreadsheetStoredPath: copyIfOutside(source.spreadsheetStoredPath),
    spreadsheetTrimmedPath: copyIfOutside(source.spreadsheetTrimmedPath),
  };
}

export function buildOfficialCampaignDuplicate(
  source: WabaCampaignIntake,
  options: { now?: Date; nextId?: string } = {},
): WabaCampaignIntake {
  const now = (options.now || new Date()).toISOString();
  const nextId = options.nextId || randomUUID();
  const files = copyOfficialCampaignIntakeFiles(source, nextId);
  const clone: WabaCampaignIntake = {
    ...source,
    id: nextId,
    campaignName: buildOfficialCampaignCopyName(source.campaignName),
    imageStoredPath: files.imageStoredPath,
    whatsappLogoStoredPath: files.whatsappLogoStoredPath,
    spreadsheetStoredPath: files.spreadsheetStoredPath,
    spreadsheetTrimmedPath: files.spreadsheetTrimmedPath,
    apiKind: "oficial" as WabaDispatchesApiKind,
    status: "generated",
    clientRequestId: `duplicate:${source.id}:${nextId}`,
    submissionFingerprint: `duplicate:${source.id}:${nextId}`,
    createdAt: now,
    updatedAt: now,
  };
  delete clone.startedAt;
  delete clone.startedByEmail;
  delete clone.performanceReport;
  delete clone.errorReport;
  delete clone.operacionalNotifyAudit;
  delete clone.assignedOperacionalEmail;
  delete clone.assignedSupplierId;
  delete clone.assignedAt;
  delete clone.assignmentHistory;
  delete clone.masterOverdueAlertSentAt;
  delete clone.supplierPayoutSettlementId;
  delete clone.bmInoperanteRegisteredAt;
  delete clone.responseShortUrl;
  delete clone.responseShortSlug;
  return clone;
}

export function toOfficialCampaignEditDetail(intake: WabaCampaignIntake) {
  return {
    id: intake.id,
    name: intake.campaignName,
    campaignName: intake.campaignName,
    regionDdd: intake.regionDdd,
    whatsappName: intake.whatsappName || "",
    textOptions: intake.textOptions,
    responseLink: intake.responseLink || "",
    campaignMediaKind: intake.campaignMediaKind === "video" ? "video" : "image",
    imageFileName: intake.imageFileName || "",
    whatsappLogoFileName: intake.whatsappLogoFileName || "",
    spreadsheetFileName: intake.spreadsheetFileName || "",
    importedLineCount: Math.max(0, Math.round(Number(intake.importedLineCount || 0))),
    plannedSendCount: Math.max(0, Math.round(Number(intake.plannedSendCount || 0))),
    scheduledSendAt: intake.scheduledSendAt || "",
    status: normalizeCampaignIntakeStatus(intake.status),
    apiKind: resolveIntakeApiKindFromIntake(intake),
    canEdit: canEditOfficialCampaign(intake, intake.ownerEmail),
    canDuplicate: canDuplicateOfficialCampaign(intake, intake.ownerEmail),
  };
}
