import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../data-path";
import { WABA_ENV } from "../load-env";
import { trimLeadsBufferToRowCount } from "./waba-campaign-spreadsheet.util";
import {
  WabaCampaignIntakeRepository,
  type WabaCampaignIntake,
} from "./waba-campaign-intake.repository";

export const OPT_IN_PTX_CLONE_REQUEST_ID = "opt-in-ptx-1000-20260909";
export const OPT_IN_PTX_SOURCE_ID = "66c69911-9c2f-42a2-7aeab1b15466";

const normalizeName = (value: string): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const rewritePath = (value: string | undefined, sourceId: string, nextId: string): string => {
  const current = String(value || "").trim();
  if (!current) return current;
  return current.split(sourceId).join(nextId);
};

const findSourceIntake = (
  repository: WabaCampaignIntakeRepository,
  sourceId: string,
  campaignName: string,
): WabaCampaignIntake | null => {
  const byId = sourceId ? repository.getById(sourceId) : null;
  if (byId) return byId;
  const target = normalizeName(campaignName);
  if (!target) return null;
  const named = repository.listAll().filter((row) => {
    const name = normalizeName(row.campaignName);
    return name === target || name.includes(target);
  });
  const withCount = named.filter((row) => Math.round(Number(row.plannedSendCount || 0)) === 2996);
  return withCount[0] || named[0] || null;
};

export function cloneCampaignIntakeWithPlannedSends(input: {
  sourceId?: string;
  campaignName?: string;
  plannedSendCount: number;
  requestId: string;
}): { ok: true; skipped: boolean; intake: WabaCampaignIntake } {
  const repository = new WabaCampaignIntakeRepository();
  const requestId = String(input.requestId || "").trim();
  const planned = Math.max(1, Math.round(Number(input.plannedSendCount || 0)));
  if (!requestId) throw new Error("requestId obrigatório para clonar campanha.");
  const existing = repository.listAll().find(
    (row) => String(row.clientRequestId || "").trim() === `clone:${requestId}`,
  );
  if (existing) {
    return { ok: true, skipped: true, intake: existing };
  }

  const source = findSourceIntake(
    repository,
    String(input.sourceId || "").trim(),
    String(input.campaignName || "").trim(),
  );
  if (!source) {
    throw new Error("Campanha origem não encontrada para clonar.");
  }

  const newId = randomUUID();
  const dataDir = resolveDataDir();
  const srcDir = path.join(dataDir, "campaign-intakes", source.id);
  const destDir = path.join(dataDir, "campaign-intakes", newId);
  mkdirSync(destDir, { recursive: true });
  if (existsSync(srcDir)) {
    for (const name of readdirSync(srcDir)) {
      const from = path.join(srcDir, name);
      if (statSync(from).isFile()) copyFileSync(from, path.join(destDir, name));
    }
  }

  const leadsSrc =
    source.spreadsheetStoredPath && existsSync(source.spreadsheetStoredPath)
      ? source.spreadsheetStoredPath
      : source.spreadsheetTrimmedPath && existsSync(source.spreadsheetTrimmedPath)
        ? source.spreadsheetTrimmedPath
        : "";
  const sourceLeadsName = String(source.spreadsheetFileName || leadsSrc || "leads.xlsx");
  const trimmedExt = sourceLeadsName.toLowerCase().endsWith(".txt") ? "txt" : "xlsx";
  const spreadsheetTrimmedFileName = `leads-${planned}-envios.${trimmedExt}`;
  const spreadsheetTrimmedPath = path.join(destDir, spreadsheetTrimmedFileName);
  if (leadsSrc) {
    const buffer = readFileSync(leadsSrc);
    writeFileSync(spreadsheetTrimmedPath, trimLeadsBufferToRowCount(buffer, planned, sourceLeadsName));
  }

  const now = new Date().toISOString();
  const clone: WabaCampaignIntake = {
    ...source,
    id: newId,
    plannedSendCount: planned,
    importedLineCount: planned,
    spreadsheetStoredPath: rewritePath(source.spreadsheetStoredPath, source.id, newId),
    spreadsheetTrimmedPath,
    spreadsheetTrimmedFileName,
    imageStoredPath: rewritePath(source.imageStoredPath, source.id, newId),
    whatsappLogoStoredPath: rewritePath(source.whatsappLogoStoredPath, source.id, newId),
    status: "generated",
    creditFunding: { fromPaid: planned, fromBonus: 0 },
    clientRequestId: `clone:${requestId}`,
    submissionFingerprint: `clone:${requestId}:${planned}`,
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
  delete clone.scheduledSendAt;

  repository.create(clone);
  return { ok: true, skipped: false, intake: clone };
}

export function runOptInPtx1000CloneOneshot(): {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  message: string;
} {
  const env = String(WABA_ENV || process.env.WABA_ENV || "").trim().toLowerCase();
  if (env === "v01" || env === "v02" || env === "v03") {
    return { ok: true, skipped: true, message: "oneshot ignorado em ambiente local" };
  }
  try {
    const result = cloneCampaignIntakeWithPlannedSends({
      sourceId: OPT_IN_PTX_SOURCE_ID,
      campaignName: "Opt in PTX",
      plannedSendCount: 1000,
      requestId: OPT_IN_PTX_CLONE_REQUEST_ID,
    });
    return {
      ok: true,
      skipped: result.skipped,
      id: result.intake.id,
      message: result.skipped
        ? `Opt in PTX 1000 já existia (${result.intake.id})`
        : `Opt in PTX clonada com 1000 envios (${result.intake.id})`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Falha ao clonar Opt in PTX",
    };
  }
}
