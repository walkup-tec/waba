import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WABA_ENV } from "../load-env";
import {
  resolveCampaignIntakeStorageDir,
  WabaCampaignIntakeRepository,
  type WabaCampaignIntake,
} from "./waba-campaign-intake.repository";
import { dedupeOfficialCampaignLeadsFile } from "./waba-campaign-intake-oficial-dedupe";
import { findBroadcastByIntakeCampaignId, voidBroadcastCampaignForRetry } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import { WabaFinanceiroSplitService } from "../billing/waba-financeiro-split.service";

export const PELLI_REOPEN_CAMPAIGN_NAME = "Primeiro disparo - agenda pessoal Pelli";
export const PELLI_REOPEN_OPERACIONAL_EMAIL = "aifocusdev@gmail.com";
export const PELLI_REOPEN_LEADS_FILE_NAME = "leads-9088-envios.xlsx";

export const PELLI_REOPEN_TEXT = `Olá!
Trazendo atualizações importantes: 
Nessa reta final está liberado o seu pedido de voto para todo mundo que conhece e acredita nesse projeto para o Rio!
Falta pouco para o grande dia, e cada conversa agora define o nosso futuro.
Pense em dez pessoas agora e compartilhe nossos materiais para elas. É de conversa em conversa que a nossa força se multiplica.
No dia 04/10, digite 40004 para confirmar esse projeto de renovação, educação e compromisso com o Rio! 🚀

Vamos juntos!
Renato Pellizzari | 40004

Clique em "Mais Informações" e verifique as atualizações aqui na nossa comunidade.`;

const normalizeName = (value: string): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

export function isPelliAgendaPessoalCampaignName(campaignName: string): boolean {
  return normalizeName(campaignName) === normalizeName(PELLI_REOPEN_CAMPAIGN_NAME);
}

export function resolvePelliReopenLeadsPath(): string {
  const fileName = "pelli-leads-9088-envios.xlsx";
  const candidates = [
    path.join(__dirname, "assets", fileName),
    path.join(process.cwd(), "src", "disparos", "assets", fileName),
    path.join(process.cwd(), "dist", "disparos", "assets", fileName),
  ];
  return candidates.find((item) => existsSync(item)) || candidates[0];
}

export type PelliReopenOneshotResult = {
  ok: boolean;
  skipped?: boolean;
  applied?: boolean;
  campaignId?: string;
  uniqueCount?: number;
  plannedSendCount?: number;
  message: string;
};

export type PelliReopenOneshotDeps = {
  forceLocal?: boolean;
  leadsPath?: string;
  intakeRepository?: WabaCampaignIntakeRepository;
  systemUserService?: WabaSystemUserService;
  now?: () => string;
  voidBroadcast?: boolean;
};

function findPelliIntake(repository: WabaCampaignIntakeRepository): WabaCampaignIntake | null {
  const named = repository.listAll().filter((row) => isPelliAgendaPessoalCampaignName(row.campaignName));
  if (!named.length) return null;
  named.sort(
    (a, b) =>
      Date.parse(String(b.updatedAt || b.createdAt || "")) -
      Date.parse(String(a.updatedAt || a.createdAt || "")),
  );
  return named[0] || null;
}

function alreadyReopened(intake: WabaCampaignIntake, uniqueCount: number, text: string): boolean {
  const assigned = normalizeEmail(intake.assignedOperacionalEmail || "");
  const status = String(intake.status || "").trim();
  const firstText = String(intake.textOptions?.[0] || "");
  if (assigned !== PELLI_REOPEN_OPERACIONAL_EMAIL) return false;
  if (status !== "generated") return false;
  if (intake.performanceReport) return false;
  if (intake.startedAt) return false;
  if (firstText !== text) return false;
  if (Math.round(Number(intake.plannedSendCount || 0)) !== uniqueCount) return false;
  return true;
}

function resolveSupplierId(intake: WabaCampaignIntake, operacionalEmail: string): string {
  const apiKind = String(intake.apiKind || "oficial").trim() || "oficial";
  try {
    const split = new WabaFinanceiroSplitService();
    const suppliers = Array.isArray(split.getConfig().suppliers) ? split.getConfig().suppliers : [];
    const hit =
      suppliers.find(
        (row) =>
          normalizeEmail(row.systemUserEmail) === operacionalEmail &&
          String(row.apiKind || "") === apiKind,
      ) || suppliers.find((row) => normalizeEmail(row.systemUserEmail) === operacionalEmail);
    if (hit?.id) return String(hit.id);
  } catch {
    /* config ausente no teste local */
  }
  return `manual-aifocusdev-gmail-com-${apiKind}-outros`;
}

export function applyPelliReopenToAifocus(deps: PelliReopenOneshotDeps = {}): PelliReopenOneshotResult {
  const repository = deps.intakeRepository || new WabaCampaignIntakeRepository();
  const systemUserService = deps.systemUserService || new WabaSystemUserService();
  const now = deps.now || (() => new Date().toISOString());
  const leadsPath = String(deps.leadsPath || resolvePelliReopenLeadsPath()).trim();
  const text = PELLI_REOPEN_TEXT;
  const textOptions: [string, string, string] = [text, text, text];

  const intake = findPelliIntake(repository);
  if (!intake) {
    return { ok: false, message: "Campanha Primeiro disparo - agenda pessoal Pelli não encontrada." };
  }

  const operacional = systemUserService.getByEmail(PELLI_REOPEN_OPERACIONAL_EMAIL);
  if (!operacional || operacional.role !== "operacional") {
    return {
      ok: false,
      campaignId: intake.id,
      message: `Operacional ${PELLI_REOPEN_OPERACIONAL_EMAIL} não encontrado.`,
    };
  }

  if (!existsSync(leadsPath)) {
    return { ok: false, campaignId: intake.id, message: `Planilha da Pelli ausente: ${leadsPath}` };
  }

  const originalBuffer = readFileSync(leadsPath);
  const deduped = dedupeOfficialCampaignLeadsFile(originalBuffer, PELLI_REOPEN_LEADS_FILE_NAME);
  const uniqueCount = Math.max(0, Math.round(Number(deduped.uniqueCount || 0)));
  if (uniqueCount < 1) {
    return { ok: false, campaignId: intake.id, message: "A planilha da Pelli não tem telefones únicos." };
  }

  if (alreadyReopened(intake, uniqueCount, text)) {
    return {
      ok: true,
      skipped: true,
      campaignId: intake.id,
      uniqueCount,
      plannedSendCount: uniqueCount,
      message: `Pelli já está na fila de ${PELLI_REOPEN_OPERACIONAL_EMAIL} aguardando configuração (${intake.id})`,
    };
  }

  const storageDir = resolveCampaignIntakeStorageDir(intake.id);
  mkdirSync(storageDir, { recursive: true });
  const spreadsheetStoredPath = path.join(storageDir, PELLI_REOPEN_LEADS_FILE_NAME);
  const trimmedName = `leads-${uniqueCount}-envios.xlsx`;
  const spreadsheetTrimmedPath = path.join(storageDir, trimmedName);
  copyFileSync(leadsPath, spreadsheetStoredPath);
  writeFileSync(spreadsheetTrimmedPath, deduped.buffer);

  const assignedAt = now();
  const supplierId = resolveSupplierId(intake, PELLI_REOPEN_OPERACIONAL_EMAIL);
  const history = Array.isArray(intake.assignmentHistory) ? intake.assignmentHistory.slice() : [];
  history.push({
    at: assignedAt,
    supplierId,
    operacionalEmail: PELLI_REOPEN_OPERACIONAL_EMAIL,
    reason: "manual_master",
  });

  const patch: Partial<WabaCampaignIntake> = {
    status: "generated",
    assignedOperacionalEmail: PELLI_REOPEN_OPERACIONAL_EMAIL,
    assignedSupplierId: supplierId,
    assignedAt,
    assignmentHistory: history,
    textOptions,
    spreadsheetFileName: PELLI_REOPEN_LEADS_FILE_NAME,
    spreadsheetStoredPath,
    spreadsheetTrimmedFileName: trimmedName,
    spreadsheetTrimmedPath,
    importedLineCount: uniqueCount,
    plannedSendCount: uniqueCount,
    updatedAt: assignedAt,
    performanceReport: undefined,
    startedAt: undefined,
    startedByEmail: undefined,
    errorReport: undefined,
    payoutApproval: undefined,
    bmInoperanteRegisteredAt: undefined,
    masterOverdueAlertSentAt: undefined,
    scheduledSendAt: undefined,
  };
  const updated = repository.updateById(intake.id, patch);
  if (!updated) {
    return { ok: false, campaignId: intake.id, message: "Não foi possível gravar a campanha Pelli." };
  }

  if (deps.voidBroadcast !== false) {
    try {
      const broadcast = findBroadcastByIntakeCampaignId(intake.id);
      if (broadcast?.id) voidBroadcastCampaignForRetry(broadcast.id);
    } catch {
      /* disparo Cloud ausente não bloqueia a fila */
    }
  }

  return {
    ok: true,
    applied: true,
    campaignId: intake.id,
    uniqueCount,
    plannedSendCount: uniqueCount,
    message: `Pelli reaberta na fila de ${PELLI_REOPEN_OPERACIONAL_EMAIL} com ${uniqueCount} envios (${intake.id})`,
  };
}

export function runPelliReopenAifocusOneshot(deps: PelliReopenOneshotDeps = {}): PelliReopenOneshotResult {
  const env = String(process.env.WABA_ENV || WABA_ENV || "").trim().toLowerCase();
  if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
    return { ok: true, skipped: true, message: "oneshot ignorado em ambiente local" };
  }
  try {
    return applyPelliReopenToAifocus(deps);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Falha ao reabrir a campanha Pelli",
    };
  }
}
