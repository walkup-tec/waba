import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  readWabaSessionCookie,
  resolveSessionRole,
  verifyWabaSessionToken,
} from "../auth/waba-auth.service";
import { WabaDisparosCreditsService } from "../billing/waba-disparos-credits.service";
import { WabaMasterDisparosPolicyService } from "../users/waba-master-disparos-policy.service";
import { isBetsSubscriberEmail } from "../subscribers/waba-subscriber-segment";
import {
  resolveCampaignIntakeStorageDir,
  WabaCampaignIntakeRepository,
  type WabaCampaignIntake,
} from "./waba-campaign-intake.repository";
import {
  normalizeDispatchesApiKind,
  resolveIntakeApiKindFromIntake,
  WABA_DISPATCHES_API_LABELS,
  type WabaDispatchesApiKind,
} from "./waba-dispatches-api-kind";
import {
  parseOfficialCampaignLeadsUnique,
  writeOfficialCampaignLeadsFile,
} from "./waba-campaign-intake-oficial-dedupe";
import {
  countLeadsImportedRows,
  isCampaignLeadsFileName,
  isCampaignLeadsTxtFileName,
  trimLeadsBufferToRowCount,
} from "./waba-campaign-spreadsheet.util";
import {
  applyCampaignReportReadOverride,
  campaignReportHidesClicks,
  campaignReportShowsClicks,
  campaignHoldsSubscriberInProgress,
  resolveOverriddenCampaignStatus,
} from "./waba-campaign-report-read-overrides";
import { campaignAttendedByLaboratorioStaff } from "./waba-campaign-laboratorio-attended";
import {
  findBroadcastProgressByIntakeCampaignId,
  indexBroadcastProgressByIntakeId,
  type CloudBroadcastProgressHint,
} from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import { computeCampaignPerformanceMetrics } from "./waba-campaign-performance-metrics";
import { collectIntakeReportTimeline } from "./waba-campaign-report-timeline";
import { WABA_CAMPAIGN_WHATSAPP_DISPLAY_NAME } from "./waba-campaign-whatsapp-display-name";
import {
  scheduleOperacionalStaffNotifyOnCampaignAssigned,
  type OperacionalNotifyResult,
} from "../mail/waba-operacional-campaign-notify.service";
import { WabaCampaignSupplierAssignmentService } from "../services/waba-campaign-supplier-assignment.service";
import { buildDisparosDashboardOverview, buildMasterSubscribersDisparosDashboardOverview } from "./waba-disparos-dashboard.service";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import {
  campaignIntakeDisplayOptionsFromBroadcast,
  normalizeCampaignIntakeStatus,
  toCampaignIntakeDisplayStatus,
} from "./waba-campaign-intake-status";
import {
  buildCampaignIntakeSubmissionFingerprint,
  resolveCampaignIntakeDuplicateWindowMs,
  withCampaignIntakeSubmissionLock,
} from "./waba-campaign-intake-idempotency";
import { campaignMinPlannedSendCountForEmail } from "./waba-campaign-intake.constants";
import {
  parseCampaignMediaKind,
  validateCampaignIntakeMedia,
} from "./waba-campaign-intake-media";
import { formatScheduledSendLabel, parseScheduledSendAt } from "./waba-campaign-schedule";
import { publicBaseHintsFromExpressRequest } from "../lib/waba-public-base-url";
import {
  createCampaignIntakeTrackedShortUrl,
  shouldCreateIntakeTrackedShortUrl,
} from "./waba-campaign-intake-short-url";
import {
  OfficialCampaignCopyError,
  assertCanDuplicateOfficialCampaign,
  assertCanEditOfficialCampaign,
  buildOfficialCampaignDuplicate,
  canDuplicateOfficialCampaign,
  canEditOfficialCampaign,
  toOfficialCampaignEditDetail,
} from "./waba-campaign-intake-oficial-copy";

const intakeRepository = new WabaCampaignIntakeRepository();
const disparosCreditsService = new WabaDisparosCreditsService();
const masterPolicyService = new WabaMasterDisparosPolicyService();
const subscriberRepository = new WabaSubscriberRepository();

const UPLOAD_MAX_BYTES = Math.max(5, Number(process.env.CAMPAIGN_UPLOAD_MAX_MB || 100)) * 1024 * 1024;

const uploadIntake = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES },
});

const resolveRequestAuth = (req: Request) => {
  const token = readWabaSessionCookie(req.headers.cookie);
  const session = verifyWabaSessionToken(token);
  if (!session) return { email: "", role: "guest" as const };
  return {
    email: session.email.trim().toLowerCase(),
    role: resolveSessionRole(session),
  };
};

const normalizeDdd = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 2) return "";
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 11 || n > 99) return "";
  return digits;
};

const normalizeStoredStatus = (status: string): WabaCampaignIntake["status"] =>
  normalizeCampaignIntakeStatus(status);

const toDisplayStatus = (
  status: WabaCampaignIntake["status"],
  laboratorioAttended = false,
  broadcastProgress?: CloudBroadcastProgressHint | null,
  scheduledSendAt?: string | null,
): string =>
  toCampaignIntakeDisplayStatus(status, "subscriber", {
    ...campaignIntakeDisplayOptionsFromBroadcast(laboratorioAttended, broadcastProgress),
    scheduledSendAt: scheduledSendAt || broadcastProgress?.scheduledSendAt || null,
  });

const parseRequestedPlannedSendCount = (body: Record<string, unknown>): number | null => {
  const raw = body.plannedSendCount;
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
};

const resolvePlannedSendCount = (
  ownerEmail: string,
  importedLineCount: number,
  requestedSendCount: number | null,
  apiKind: WabaDispatchesApiKind,
): { plannedSendCount: number; isMaster: boolean; error?: string } => {
  const unlimitedCredits = masterPolicyService.hasUnlimitedCredits(ownerEmail);
  if (requestedSendCount === null) {
    return {
      plannedSendCount: 0,
      isMaster: unlimitedCredits,
      error: "Informe a quantidade de envios desejada.",
    };
  }
  const minPlanned = campaignMinPlannedSendCountForEmail(ownerEmail, apiKind);
  if (requestedSendCount < minPlanned) {
    return {
      plannedSendCount: 0,
      isMaster: unlimitedCredits,
      error: `A campanha deve ter no mínimo ${minPlanned} envios.`,
    };
  }
  if (requestedSendCount > importedLineCount) {
    return {
      plannedSendCount: 0,
      isMaster: unlimitedCredits,
      error: `O arquivo contém apenas ${importedLineCount} linha(s). Reduza a quantidade ou importe mais contatos.`,
    };
  }
  if (unlimitedCredits) {
    return { plannedSendCount: requestedSendCount, isMaster: true };
  }
  const remaining = disparosCreditsService.getRemainingShipmentsForApi(ownerEmail, apiKind);
  const apiLabel = apiKind === "alternativa" ? "API Alternativa" : "API Oficial";
  if (remaining < 1) {
    return {
      plannedSendCount: 0,
      isMaster: false,
      error: `Você não possui envios disponíveis no plano ${apiLabel}. Contrate um pacote antes de gerar a campanha.`,
    };
  }
  if (requestedSendCount > remaining) {
    return {
      plannedSendCount: 0,
      isMaster: false,
      error: `No plano ${apiLabel}, você possui apenas ${remaining} envio(s) disponível(is).`,
    };
  }
  return { plannedSendCount: requestedSendCount, isMaster: false };
};

const resolveReportedSentCount = (intake: WabaCampaignIntake): number => {
  const status = resolveOverriddenCampaignStatus(
    intake.campaignName,
    intake.createdAt,
    intake.status,
    intake.id,
  );
  if (status !== "completed") return 0;
  const report = applyCampaignReportReadOverride(
    intake.campaignName,
    intake.createdAt,
    intake.performanceReport,
  );
  if (!report) return 0;
  const sent = Math.round(Number(report.sent ?? NaN));
  if (!Number.isFinite(sent) || sent < 0) return 0;
  return sent;
};

const toPublicIntake = (
  intake: WabaCampaignIntake,
  broadcastProgress?: CloudBroadcastProgressHint | null,
) => {
  const holdInProgress = campaignHoldsSubscriberInProgress(
    intake.campaignName,
    intake.createdAt,
    intake.id,
  );
  const status = resolveOverriddenCampaignStatus(
    intake.campaignName,
    intake.createdAt,
    intake.status,
    intake.id,
  );
  const importedLineCount = Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
  const plannedSendCount = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
  const apiKind = resolveIntakeApiKindFromIntake(intake);
  const laboratorioAttended = campaignAttendedByLaboratorioStaff(intake);
  const labDisplay = laboratorioAttended && !holdInProgress;
  return {
    id: intake.id,
    name: intake.campaignName,
    campaignName: intake.campaignName,
    createdAt: intake.createdAt,
    updatedAt: intake.updatedAt,
    status,
    displayStatus: toDisplayStatus(
      status,
      labDisplay,
      labDisplay ? broadcastProgress : null,
      intake.scheduledSendAt || broadcastProgress?.scheduledSendAt,
    ),
    regionDdd: intake.regionDdd,
    importedLineCount,
    plannedSendCount,
    apiKind,
    planTypeLabel: WABA_DISPATCHES_API_LABELS[apiKind],
    scheduledSendAt: intake.scheduledSendAt || "",
    scheduledSendLabel: formatScheduledSendLabel(intake.scheduledSendAt),
    /** Envios confirmados no relatório do operacional (somente campanhas finalizadas). */
    sentCount: holdInProgress ? 0 : resolveReportedSentCount(intake),
    hasErrorReport: status === "error_reported",
    laboratorioAttended,
    reportSource: holdInProgress ? null : intake.performanceReport?.source || null,
    source: "intake" as const,
    canDuplicate: canDuplicateOfficialCampaign({ ...intake, status }, intake.ownerEmail),
    canEdit: canEditOfficialCampaign({ ...intake, status }, intake.ownerEmail),
  };
};

const parseClientRequestId = (body: Record<string, unknown>): string => {
  const raw = String(body.clientRequestId ?? body.idempotencyKey ?? "").trim();
  if (!raw || raw.length > 128) return "";
  if (!/^[a-zA-Z0-9:_-]+$/.test(raw)) return "";
  return raw;
};

const findDuplicateCampaignIntake = (
  ownerEmail: string,
  clientRequestId: string,
  submissionFingerprint: string,
  withinMs: number,
): WabaCampaignIntake | null => {
  if (clientRequestId) {
    const byRequestId = intakeRepository.findByOwnerAndClientRequestId(ownerEmail, clientRequestId);
    if (byRequestId) return byRequestId;
  }
  if (submissionFingerprint) {
    const byFingerprint = intakeRepository.findRecentByOwnerAndSubmissionFingerprint(
      ownerEmail,
      submissionFingerprint,
      withinMs,
    );
    if (byFingerprint) return byFingerprint;
  }
  return null;
};

const buildIntakeSuccessPayload = (
  intake: WabaCampaignIntake,
  options: {
    deduplicated?: boolean;
    operacionalNotify?: OperacionalNotifyResult;
    duplicatesRemoved?: number;
  } = {},
) => {
  const plannedSendCount = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
  const importedLineCount = Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
  const duplicatesRemoved = Math.max(0, Math.round(Number(options.duplicatesRemoved || 0)));
  const importedLabel = duplicatesRemoved > 0 ? "contatos únicos" : "linhas importadas";
  let importSummary =
    plannedSendCount < importedLineCount
      ? `Quantidade de ${importedLabel}: ${importedLineCount}. Quantidade de envios: ${plannedSendCount} envios (limite do seu pacote contratado).`
      : `Quantidade de ${importedLabel}: ${importedLineCount}. Quantidade de envios: ${plannedSendCount} envios.`;
  if (duplicatesRemoved > 0) {
    importSummary += ` ${duplicatesRemoved} telefone(s) duplicado(s) foram excluídos (1 envio por número).`;
  }
  const scheduledLabel = formatScheduledSendLabel(intake.scheduledSendAt);
  if (scheduledLabel) {
    importSummary += ` Disparo agendado para ${scheduledLabel}.`;
  }

  return {
    ok: true,
    deduplicated: Boolean(options.deduplicated),
    ...toPublicIntake(intake),
    duplicatesRemoved,
    operacionalNotify: options.operacionalNotify,
    message:
      options.deduplicated
        ? "Campanha já havia sido registrada. Não foi criada duplicata."
        : scheduledLabel
          ? `Campanha gerada. O disparo está agendado para ${scheduledLabel}.`
          : "Nosso time está trabalhando em sua campanha, em breve retornaremos com os indicadores de performance.",
    importSummary,
  };
};

const finalizeIntakeAfterCreate = (intake: WabaCampaignIntake): WabaCampaignIntake => {
  const current = new WabaCampaignSupplierAssignmentService().ensureInitialAssignment(intake);
  scheduleOperacionalStaffNotifyOnCampaignAssigned(current);
  return current;
};

const parseResponseLink = (body: Record<string, unknown>): string | null => {
  const raw = String(body.responseLink ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

const listAvailableApiKindsForEmail = (ownerEmail: string): WabaDispatchesApiKind[] => {
  const email = ownerEmail.trim().toLowerCase();
  const kinds: WabaDispatchesApiKind[] = [];
  const betsOnlyOficial = isBetsSubscriberEmail(email);
  for (const kind of ["oficial", "alternativa"] as const) {
    if (betsOnlyOficial && kind === "alternativa") continue;
    if (disparosCreditsService.getRemainingShipmentsForApi(email, kind) > 0) {
      kinds.push(kind);
    }
  }
  return kinds;
};

const parseRequestedApiKind = (
  body: Record<string, unknown>,
  ownerEmail: string,
): { apiKind: WabaDispatchesApiKind; error?: string } => {
  const email = ownerEmail.trim().toLowerCase();
  const requested = normalizeDispatchesApiKind(body.apiKind);

  if (isBetsSubscriberEmail(email) && requested === "alternativa") {
    return {
      apiKind: "oficial",
      error: "Assinantes do segmento Black geram campanhas apenas na API Oficial.",
    };
  }

  if (masterPolicyService.hasUnlimitedCredits(email)) {
    return { apiKind: requested === "alternativa" ? "alternativa" : "oficial" };
  }

  const available = listAvailableApiKindsForEmail(email);
  if (!available.length) {
    return {
      apiKind: requested === "alternativa" ? "alternativa" : "oficial",
      error: "Você não possui saldo em nenhum plano. Contrate envios antes de gerar a campanha.",
    };
  }

  // Plano explícito no wizard (ex.: API Oficial) — honra quando há saldo nesse plano.
  if (requested && available.includes(requested)) {
    return { apiKind: requested };
  }

  if (available.length === 1) {
    return { apiKind: available[0] };
  }

  if (requested && !available.includes(requested)) {
    const apiLabel = requested === "alternativa" ? "API Alternativa" : "API Oficial";
    return {
      apiKind: requested,
      error: `Você não possui envios disponíveis no plano ${apiLabel}. Contrate um pacote antes de gerar a campanha.`,
    };
  }

  return {
    apiKind: available[0],
    error: "Selecione o plano de envio (API Oficial ou API Alternativa).",
  };
};

const parseTextOptions = (body: Record<string, unknown>): [string, string, string] | null => {
  const options = [
    String(body.textOption1 ?? "").trim(),
    String(body.textOption2 ?? "").trim(),
    String(body.textOption3 ?? "").trim(),
  ];
  if (options.some((text) => text.length < 8)) return null;
  return options as [string, string, string];
};

const parseWhatsappName = (_body?: Record<string, unknown>): string =>
  WABA_CAMPAIGN_WHATSAPP_DISPLAY_NAME;

const handleCampaignIntakeUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadIntake.fields([
    { name: "image", maxCount: 1 },
    { name: "whatsappLogo", maxCount: 1 },
    { name: "spreadsheet", maxCount: 1 },
  ])(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    const limitErr = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
    const msg = limitErr
      ? `Arquivo acima do limite de ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)}MB.`
      : (err as Error).message || "Falha no upload dos arquivos da campanha.";
    return res.status(400).json({ error: msg });
  });
};

export const registerWabaCampaignIntakeRoutes = (app: Express) => {
  app.post("/disparos/campanhas/intake", handleCampaignIntakeUpload, async (req, res) => {
    try {
      const auth = resolveRequestAuth(req);
      if (!auth.email) {
        return res.status(401).json({ error: "Faça login para enviar a campanha." });
      }

      const body = req.body as Record<string, unknown>;
      const clientRequestId = parseClientRequestId(body);

      const campaignName = String(body.campaignName ?? "").trim();
      const regionDdd = normalizeDdd(String(body.regionDdd ?? ""));
      const whatsappName = parseWhatsappName(body);
      const textOptions = parseTextOptions(body);
      const responseLink = parseResponseLink(body);

      if (campaignName.length < 2) {
        return res.status(400).json({ error: "Informe o nome da campanha." });
      }
      if (!regionDdd) {
        return res.status(400).json({ error: "Informe um DDD válido (2 dígitos)." });
      }
      if (!textOptions) {
        return res.status(400).json({ error: "Preencha as 3 opções de texto (mínimo 8 caracteres cada)." });
      }
      if (!responseLink) {
        return res.status(400).json({ error: "Informe um link de resposta válido (http ou https)." });
      }

      const files = req.files as {
        image?: Express.Multer.File[];
        whatsappLogo?: Express.Multer.File[];
        spreadsheet?: Express.Multer.File[];
      };
      const imageFile = files?.image?.[0];
      const whatsappLogoFile = files?.whatsappLogo?.[0];
      const spreadsheetFile = files?.spreadsheet?.[0];

      if (!imageFile) {
        return res.status(400).json({
          error: "Envie a imagem (PNG ou JPG, 1200×628) ou o vídeo MP4 da campanha.",
        });
      }
      if (!whatsappLogoFile) {
        return res.status(400).json({ error: "Envie a logo do WhatsApp (500×500 px)." });
      }
      if (!spreadsheetFile) {
        return res.status(400).json({ error: "Envie o arquivo Excel ou TXT com a lista de leads." });
      }

      const mediaKind = parseCampaignMediaKind(body.mediaKind);
      const mediaCheck = validateCampaignIntakeMedia({
        kind: mediaKind,
        buffer: imageFile.buffer,
        mime: imageFile.mimetype,
        fileName: imageFile.originalname,
      });
      if (!mediaCheck.ok) {
        return res.status(400).json({ error: mediaCheck.error });
      }
      const logoMime = String(whatsappLogoFile.mimetype || "").toLowerCase();
      if (!logoMime.startsWith("image/")) {
        return res.status(400).json({ error: "A logo do WhatsApp deve ser PNG ou JPG." });
      }

      const sheetName = String(spreadsheetFile.originalname || "").toLowerCase();
      if (!isCampaignLeadsFileName(sheetName)) {
        return res.status(400).json({
          error: "A lista de clientes deve ser Excel (.xlsx ou .xls), CSV (.csv) ou TXT (.txt).",
        });
      }

      const { apiKind, error: apiKindError } = parseRequestedApiKind(body, auth.email);
      if (apiKindError) {
        return res.status(400).json({ error: apiKindError });
      }

      let scheduledSendAt = "";
      try {
        scheduledSendAt =
          apiKind === "oficial" ? parseScheduledSendAt(body.scheduledSendAt, { requireFuture: true }) : "";
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Data de agendamento inválida.",
        });
      }

      let importedLineCount = 0;
      let leadsBufferForTrim = spreadsheetFile.buffer;
      let phoneDuplicatesRemoved = 0;
      let officialUniqueSheet: ReturnType<typeof parseOfficialCampaignLeadsUnique>["sheet"] | null =
        null;
      try {
        if (apiKind === "oficial") {
          const deduped = parseOfficialCampaignLeadsUnique(spreadsheetFile.buffer, sheetName);
          importedLineCount = deduped.uniqueCount;
          officialUniqueSheet = deduped.sheet;
          phoneDuplicatesRemoved = deduped.duplicatesRemoved;
        } else {
          importedLineCount = countLeadsImportedRows(spreadsheetFile.buffer, sheetName);
        }
      } catch {
        return res.status(400).json({ error: "Não foi possível ler o arquivo de leads." });
      }
      if (importedLineCount < 1) {
        return res.status(400).json({ error: "O arquivo não contém linhas de leads." });
      }
      const minPlanned = campaignMinPlannedSendCountForEmail(auth.email, apiKind);
      if (importedLineCount < minPlanned) {
        return res.status(400).json({
          error:
            apiKind === "oficial"
              ? `O arquivo precisa ter no mínimo ${minPlanned} contatos únicos para gerar a campanha.`
              : `O arquivo precisa ter no mínimo ${minPlanned} contatos para gerar a campanha.`,
        });
      }

      const requestedSendCount = parseRequestedPlannedSendCount(body);
      const { plannedSendCount, isMaster, error: plannedSendError } = resolvePlannedSendCount(
        auth.email,
        importedLineCount,
        requestedSendCount,
        apiKind,
      );
      if (plannedSendError) {
        return res.status(400).json({ error: plannedSendError });
      }

      const submissionFingerprint = buildCampaignIntakeSubmissionFingerprint({
        campaignName,
        regionDdd,
        whatsappName,
        plannedSendCount,
        apiKind,
        scheduledSendAt,
        imageByteLength: imageFile.buffer.length,
        whatsappLogoByteLength: whatsappLogoFile.buffer.length,
        spreadsheetByteLength: spreadsheetFile.buffer.length,
      });
      const duplicateWindowMs = resolveCampaignIntakeDuplicateWindowMs();
      const submissionLockKey = clientRequestId
        ? `${auth.email}:${clientRequestId}`
        : `${auth.email}:fp:${submissionFingerprint}`;

      let trimmedSpreadsheetBuffer: Buffer;
      try {
        trimmedSpreadsheetBuffer = officialUniqueSheet
          ? writeOfficialCampaignLeadsFile(officialUniqueSheet, sheetName, plannedSendCount)
          : trimLeadsBufferToRowCount(leadsBufferForTrim, plannedSendCount, sheetName);
      } catch {
        return res.status(400).json({ error: "Não foi possível preparar o arquivo de leads para envio." });
      }

      const intakeResult = await withCampaignIntakeSubmissionLock(submissionLockKey, async () => {
        const duplicate = findDuplicateCampaignIntake(
          auth.email,
          clientRequestId,
          submissionFingerprint,
          duplicateWindowMs,
        );
        if (duplicate) {
          return { deduplicated: true as const, intake: duplicate };
        }

        const now = new Date().toISOString();
        const intakeId = randomUUID();
        let responseShortUrl = "";
        let responseShortSlug = "";
        if (shouldCreateIntakeTrackedShortUrl(apiKind)) {
          const tracked = await createCampaignIntakeTrackedShortUrl({
            destinationUrl: responseLink,
            campaignId: intakeId,
            ownerEmail: auth.email,
            publicBaseHints: publicBaseHintsFromExpressRequest(req),
          });
          responseShortUrl = tracked.shortUrl;
          responseShortSlug = tracked.shortSlug;
        }
        const storageDir = resolveCampaignIntakeStorageDir(intakeId);
        const imageExt = mediaCheck.extension;
        const logoExt = logoMime.includes("png") ? ".png" : ".jpg";
        const imageStoredPath = path.join(
          storageDir,
          mediaKind === "video" ? `campaign-media${imageExt}` : `campaign-image${imageExt}`,
        );
        const whatsappLogoStoredPath = path.join(storageDir, `whatsapp-logo${logoExt}`);
        const originalLeadsName =
          spreadsheetFile.originalname ||
          (isCampaignLeadsTxtFileName(sheetName) ? "leads.txt" : "leads.xlsx");
        const spreadsheetStoredPath = path.join(storageDir, originalLeadsName);
        const trimmedExt = isCampaignLeadsTxtFileName(sheetName) ? "txt" : "xlsx";
        const spreadsheetTrimmedFileName = `leads-${plannedSendCount}-envios.${trimmedExt}`;
        const spreadsheetTrimmedPath = path.join(storageDir, spreadsheetTrimmedFileName);

        try {
          writeFileSync(imageStoredPath, imageFile.buffer);
          writeFileSync(whatsappLogoStoredPath, whatsappLogoFile.buffer);
          writeFileSync(spreadsheetStoredPath, spreadsheetFile.buffer);
          writeFileSync(spreadsheetTrimmedPath, trimmedSpreadsheetBuffer);
        } catch {
          throw Object.assign(new Error("Não foi possível gravar os arquivos da campanha no servidor. Tente novamente."), {
            statusCode: 500,
          });
        }

        const intake = intakeRepository.create({
          id: intakeId,
          ownerEmail: auth.email,
          campaignName,
          regionDdd,
          whatsappName,
          whatsappLogoFileName: whatsappLogoFile.originalname || `whatsapp-logo${logoExt}`,
          whatsappLogoStoredPath,
          textOptions,
          responseLink,
          ...(responseShortUrl ? { responseShortUrl } : {}),
          ...(responseShortSlug ? { responseShortSlug } : {}),
          campaignMediaKind: mediaKind,
          imageFileName: imageFile.originalname || `campaign-media${imageExt}`,
          imageStoredPath,
          spreadsheetFileName: spreadsheetFile.originalname || originalLeadsName,
          spreadsheetStoredPath,
          spreadsheetTrimmedPath,
          spreadsheetTrimmedFileName,
          importedLineCount,
          plannedSendCount,
          apiKind,
          status: "generated",
          clientRequestId: clientRequestId || undefined,
          submissionFingerprint,
          ...(scheduledSendAt ? { scheduledSendAt } : {}),
          createdAt: now,
          updatedAt: now,
        });

        let persisted = intake;
        if (!isMaster && plannedSendCount > 0) {
          const creditFunding = disparosCreditsService.consumeShipments(
            auth.email,
            plannedSendCount,
            apiKind,
          );
          persisted =
            intakeRepository.updateById(intake.id, {
              creditFunding,
              updatedAt: new Date().toISOString(),
            }) ?? intake;
        }

        const finalized = finalizeIntakeAfterCreate(persisted);
        return { deduplicated: false as const, intake: finalized };
      });

      if (intakeResult.deduplicated) {
        console.info(
          `[disparos/campanhas/intake] dedupe ${auth.email} ` +
            `(clientRequestId=${clientRequestId || "-"}, intake=${intakeResult.intake.id}).`,
        );
        return res
          .status(200)
          .json(
            buildIntakeSuccessPayload(intakeResult.intake, {
              deduplicated: true,
              duplicatesRemoved: phoneDuplicatesRemoved,
            }),
          );
      }

      return res.status(201).json(
        buildIntakeSuccessPayload(intakeResult.intake, { duplicatesRemoved: phoneDuplicatesRemoved }),
      );
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
      if (statusCode >= 400 && statusCode < 600) {
        return res.status(statusCode).json({ error: (error as Error).message });
      }
      console.error("[disparos/campanhas/intake] erro:", error);
      return res.status(500).json({
        error: "Erro interno ao processar a campanha. Tente novamente em instantes.",
      });
    }
  });

  app.get("/disparos/campanhas/intake", (req, res) => {
    try {
      const auth = resolveRequestAuth(req);
      if (!auth.email) {
        return res.status(401).json({ error: "Faça login para listar suas campanhas." });
      }
      const progressByIntake = indexBroadcastProgressByIntakeId();
      const items = intakeRepository
        .listByEmail(auth.email)
        .map((intake) => toPublicIntake(intake, progressByIntake.get(intake.id) || null));
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ items });
    } catch (error) {
      console.error("[disparos/campanhas/intake] list erro:", error);
      return res.status(500).json({ error: "Erro ao carregar campanhas geradas. Tente novamente." });
    }
  });

  app.get("/disparos/campanhas/intake/:id/relatorio", (req, res) => {
    const auth = resolveRequestAuth(req);
    if (!auth.email) {
      return res.status(401).json({ error: "Faça login para ver o relatório." });
    }
    const intake = intakeRepository.getById(req.params.id);
    if (!intake || intake.ownerEmail !== auth.email) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }
    const status = resolveOverriddenCampaignStatus(
      intake.campaignName,
      intake.createdAt,
      intake.status,
      intake.id,
    );
    if (status === "error_reported") {
      return res.status(400).json({
        error: "Esta campanha foi finalizada com erro reportado. Consulte o motivo na lista de campanhas.",
      });
    }
    if (status !== "completed") {
      return res.status(400).json({
        error: "O relatório fica disponível quando a campanha estiver com status Finalizado.",
      });
    }

    const report = applyCampaignReportReadOverride(
      intake.campaignName,
      intake.createdAt,
      intake.performanceReport,
    );
    const showClicks =
      campaignReportShowsClicks(intake.campaignName, intake.createdAt, report) ||
      (campaignAttendedByLaboratorioStaff(intake) &&
        report?.source === "meta_lab" &&
        !campaignReportHidesClicks(intake.campaignName, intake.createdAt, report));
    const metrics = report
      ? computeCampaignPerformanceMetrics({
          totalLeads: report.totalLeads,
          sent: report.sent,
          delivered: report.delivered,
          read: report.read,
          failed: report.failed,
          clicks: showClicks ? report.clicks : 0,
        })
      : null;
    const indicators = report
      ? {
          totalLeads: report.totalLeads,
          enviados: report.sent,
          entregues: report.delivered,
          lidos: report.read,
          falhados: report.failed,
          ...(showClicks
            ? {
                cliques: metrics?.clicks ?? 0,
                taxaCliques: metrics?.clickRate ?? 0,
              }
            : {}),
        }
      : {
          totalLeads: 0,
          enviados: 0,
          entregues: 0,
          lidos: 0,
          falhados: 0,
        };

    return res.status(200).json({
      campaignName: intake.campaignName,
      createdAt: intake.createdAt,
      completedAt: intake.updatedAt,
      displayStatus: toDisplayStatus(status, campaignAttendedByLaboratorioStaff(intake)),
      regionDdd: intake.regionDdd,
      source: report?.source || "manual",
      showClicks,
      timeline: collectIntakeReportTimeline(intake),
      indicators,
      message: report
        ? showClicks
          ? "Indicadores gerados automaticamente com dados da Meta."
          : "Indicadores de performance da campanha."
        : "Indicadores de performance serão atualizados pela equipe assim que a consolidação estiver concluída.",
    });
  });

  app.get("/disparos/campanhas/intake/:id/erro", (req, res) => {
    const auth = resolveRequestAuth(req);
    if (!auth.email) {
      return res.status(401).json({ error: "Faça login para ver o motivo do erro." });
    }
    const intake = intakeRepository.getById(req.params.id);
    if (!intake || intake.ownerEmail !== auth.email) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }
    const status = normalizeStoredStatus(intake.status);
    if (status !== "error_reported" || !intake.errorReport) {
      return res.status(400).json({ error: "Esta campanha não possui erro reportado." });
    }
    return res.status(200).json({
      campaignId: intake.id,
      campaignName: intake.campaignName,
      displayStatus: toDisplayStatus(status),
      justification: intake.errorReport.justification,
      reportedAt: intake.errorReport.reportedAt,
    });
  });

  app.post("/disparos/campanhas/intake/:id/duplicar", async (req, res) => {
    try {
      const auth = resolveRequestAuth(req);
      if (!auth.email) {
        return res.status(401).json({ error: "Faça login para duplicar a campanha." });
      }
      const source = assertCanDuplicateOfficialCampaign(
        intakeRepository.getById(req.params.id),
        auth.email,
      );
      const { plannedSendCount, isMaster, error: plannedSendError } = resolvePlannedSendCount(
        auth.email,
        Math.max(0, Math.round(Number(source.importedLineCount || 0))),
        Math.max(0, Math.round(Number(source.plannedSendCount || 0))),
        "oficial",
      );
      if (plannedSendError) {
        return res.status(400).json({ error: plannedSendError });
      }

      const clone = buildOfficialCampaignDuplicate(source);
      clone.plannedSendCount = plannedSendCount;
      if (source.responseLink && shouldCreateIntakeTrackedShortUrl("oficial")) {
        try {
          const tracked = await createCampaignIntakeTrackedShortUrl({
            destinationUrl: source.responseLink,
            campaignId: clone.id,
            ownerEmail: auth.email,
            publicBaseHints: publicBaseHintsFromExpressRequest(req),
          });
          clone.responseShortUrl = tracked.shortUrl;
          clone.responseShortSlug = tracked.shortSlug;
        } catch (error) {
          console.warn("[disparos/campanhas/intake] short url na cópia:", error);
        }
      }

      const created = intakeRepository.create(clone);
      let persisted = created;
      if (!isMaster && plannedSendCount > 0) {
        const creditFunding = disparosCreditsService.consumeShipments(
          auth.email,
          plannedSendCount,
          "oficial",
        );
        persisted =
          intakeRepository.updateById(created.id, {
            creditFunding,
            updatedAt: new Date().toISOString(),
          }) ?? created;
      }
      const finalized = finalizeIntakeAfterCreate(persisted);
      return res.status(201).json(buildIntakeSuccessPayload(finalized));
    } catch (error) {
      if (error instanceof OfficialCampaignCopyError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error("[disparos/campanhas/intake] duplicar erro:", error);
      return res.status(500).json({ error: "Não foi possível duplicar a campanha. Tente novamente." });
    }
  });

  app.get("/disparos/campanhas/intake/:id/arquivo/:kind", (req, res) => {
    const auth = resolveRequestAuth(req);
    if (!auth.email) {
      return res.status(401).json({ error: "Faça login para ver o arquivo." });
    }
    const intake = intakeRepository.getById(req.params.id);
    if (!intake || intake.ownerEmail !== auth.email) {
      return res.status(404).json({ error: "Arquivo não encontrado." });
    }
    const kind = String(req.params.kind || "").trim().toLowerCase();
    const filePath =
      kind === "logo"
        ? String(intake.whatsappLogoStoredPath || "").trim()
        : kind === "spreadsheet"
          ? String(intake.spreadsheetStoredPath || intake.spreadsheetTrimmedPath || "").trim()
          : String(intake.imageStoredPath || "").trim();
    if (!filePath || !existsSync(filePath)) {
      return res.status(404).json({ error: "Arquivo não encontrado." });
    }
    return res.sendFile(path.resolve(filePath));
  });

  app.get("/disparos/campanhas/intake/:id", (req, res) => {
    const auth = resolveRequestAuth(req);
    if (!auth.email) {
      return res.status(401).json({ error: "Faça login para ver a campanha." });
    }
    const intake = intakeRepository.getById(req.params.id);
    if (!intake || intake.ownerEmail !== auth.email) {
      return res.status(404).json({ error: "Campanha não encontrada." });
    }
    return res.status(200).json(toOfficialCampaignEditDetail(intake));
  });

  app.put("/disparos/campanhas/intake/:id", handleCampaignIntakeUpload, async (req, res) => {
    try {
      const auth = resolveRequestAuth(req);
      if (!auth.email) {
        return res.status(401).json({ error: "Faça login para editar a campanha." });
      }
      const current = assertCanEditOfficialCampaign(
        intakeRepository.getById(req.params.id),
        auth.email,
      );

      const body = req.body as Record<string, unknown>;
      const campaignName = String(body.campaignName ?? current.campaignName).trim();
      const regionDdd = normalizeDdd(String(body.regionDdd ?? current.regionDdd));
      const whatsappName = parseWhatsappName(body);
      const hasTextBody = [1, 2, 3].some((n) => String(body[`textOption${n}`] ?? "").trim());
      const textOptions = hasTextBody ? parseTextOptions(body) : current.textOptions;
      const responseLink = parseResponseLink(body) || current.responseLink || "";

      if (campaignName.length < 2) {
        return res.status(400).json({ error: "Informe o nome da campanha." });
      }
      if (!regionDdd) {
        return res.status(400).json({ error: "Informe um DDD válido (2 dígitos)." });
      }
      if (!textOptions || textOptions.some((text) => text.length < 8)) {
        return res.status(400).json({ error: "Preencha as 3 opções de texto (mínimo 8 caracteres cada)." });
      }
      if (!responseLink) {
        return res.status(400).json({ error: "Informe um link de resposta válido (http ou https)." });
      }

      const files = req.files as {
        image?: Express.Multer.File[];
        whatsappLogo?: Express.Multer.File[];
        spreadsheet?: Express.Multer.File[];
      };
      const imageFile = files?.image?.[0];
      const whatsappLogoFile = files?.whatsappLogo?.[0];
      const spreadsheetFile = files?.spreadsheet?.[0];
      const storageDir = resolveCampaignIntakeStorageDir(current.id);

      const mediaKind = Object.prototype.hasOwnProperty.call(body, "mediaKind")
        ? parseCampaignMediaKind(body.mediaKind)
        : current.campaignMediaKind === "video"
          ? "video"
          : "image";
      let imageStoredPath = current.imageStoredPath;
      let imageFileName = current.imageFileName;
      if (imageFile) {
        const mediaCheck = validateCampaignIntakeMedia({
          kind: mediaKind,
          buffer: imageFile.buffer,
          mime: imageFile.mimetype,
          fileName: imageFile.originalname,
        });
        if (!mediaCheck.ok) {
          return res.status(400).json({ error: mediaCheck.error });
        }
        imageStoredPath = path.join(
          storageDir,
          mediaKind === "video" ? `campaign-media${mediaCheck.extension}` : `campaign-image${mediaCheck.extension}`,
        );
        imageFileName = imageFile.originalname || path.basename(imageStoredPath);
        writeFileSync(imageStoredPath, imageFile.buffer);
      } else if (!imageStoredPath || !existsSync(imageStoredPath)) {
        return res.status(400).json({
          error: "Envie a imagem (PNG ou JPG, 1200×628) ou o vídeo MP4 da campanha.",
        });
      }

      let whatsappLogoStoredPath = current.whatsappLogoStoredPath;
      let whatsappLogoFileName = current.whatsappLogoFileName;
      if (whatsappLogoFile) {
        const logoMime = String(whatsappLogoFile.mimetype || "").toLowerCase();
        if (!logoMime.startsWith("image/")) {
          return res.status(400).json({ error: "A logo do WhatsApp deve ser PNG ou JPG." });
        }
        const logoExt = logoMime.includes("png") ? ".png" : ".jpg";
        whatsappLogoStoredPath = path.join(storageDir, `whatsapp-logo${logoExt}`);
        whatsappLogoFileName = whatsappLogoFile.originalname || `whatsapp-logo${logoExt}`;
        writeFileSync(whatsappLogoStoredPath, whatsappLogoFile.buffer);
      } else if (!whatsappLogoStoredPath || !existsSync(whatsappLogoStoredPath)) {
        return res.status(400).json({ error: "Envie a logo do WhatsApp (500×500 px)." });
      }

      let importedLineCount = Math.max(0, Math.round(Number(current.importedLineCount || 0)));
      let spreadsheetStoredPath = current.spreadsheetStoredPath;
      let spreadsheetFileName = current.spreadsheetFileName;
      let spreadsheetBuffer: Buffer | null = null;
      let sheetName = String(spreadsheetFileName || "").toLowerCase();
      let officialUniqueSheet: ReturnType<typeof parseOfficialCampaignLeadsUnique>["sheet"] | null =
        null;
      let phoneDuplicatesRemoved = 0;

      if (spreadsheetFile) {
        sheetName = String(spreadsheetFile.originalname || "").toLowerCase();
        if (!isCampaignLeadsFileName(sheetName)) {
          return res.status(400).json({
            error: "A lista de clientes deve ser Excel (.xlsx ou .xls), CSV (.csv) ou TXT (.txt).",
          });
        }
        try {
          const deduped = parseOfficialCampaignLeadsUnique(spreadsheetFile.buffer, sheetName);
          importedLineCount = deduped.uniqueCount;
          officialUniqueSheet = deduped.sheet;
          phoneDuplicatesRemoved = deduped.duplicatesRemoved;
          spreadsheetBuffer = spreadsheetFile.buffer;
          spreadsheetFileName = spreadsheetFile.originalname || spreadsheetFileName;
        } catch {
          return res.status(400).json({ error: "Não foi possível ler o arquivo de leads." });
        }
      } else if (spreadsheetStoredPath && existsSync(spreadsheetStoredPath)) {
        spreadsheetBuffer = readFileSync(spreadsheetStoredPath);
      }

      if (importedLineCount < 1) {
        return res.status(400).json({ error: "O arquivo não contém linhas de leads." });
      }

      const currentPlanned = Math.max(0, Math.round(Number(current.plannedSendCount || 0)));
      const remaining = disparosCreditsService.getRemainingShipmentsForApi(auth.email, "oficial");
      const unlimitedCredits = masterPolicyService.hasUnlimitedCredits(auth.email);
      const requestedSendCount = parseRequestedPlannedSendCount(body);
      const availableForEdit = unlimitedCredits
        ? Number.MAX_SAFE_INTEGER
        : remaining + currentPlanned;
      const { isMaster, error: plannedSendError } = resolvePlannedSendCount(
        auth.email,
        importedLineCount,
        requestedSendCount,
        "oficial",
      );
      if (plannedSendError && requestedSendCount != null && requestedSendCount > importedLineCount) {
        return res.status(400).json({ error: plannedSendError });
      }
      if (requestedSendCount == null) {
        return res.status(400).json({ error: "Informe a quantidade de envios desejada." });
      }
      const minPlanned = campaignMinPlannedSendCountForEmail(auth.email, "oficial");
      if (requestedSendCount < minPlanned) {
        return res.status(400).json({ error: `A campanha deve ter no mínimo ${minPlanned} envios.` });
      }
      if (!unlimitedCredits && requestedSendCount > availableForEdit) {
        return res.status(400).json({
          error: `No plano API Oficial, você possui apenas ${availableForEdit} envio(s) disponível(is).`,
        });
      }
      const nextPlanned = unlimitedCredits || isMaster ? requestedSendCount : requestedSendCount;

      let spreadsheetTrimmedPath = current.spreadsheetTrimmedPath;
      let spreadsheetTrimmedFileName = current.spreadsheetTrimmedFileName;
      if (spreadsheetBuffer) {
        const originalLeadsName =
          spreadsheetFileName ||
          (isCampaignLeadsTxtFileName(sheetName) ? "leads.txt" : "leads.xlsx");
        spreadsheetStoredPath = path.join(storageDir, path.basename(originalLeadsName));
        const trimmedExt = isCampaignLeadsTxtFileName(sheetName) ? "txt" : "xlsx";
        spreadsheetTrimmedFileName = `leads-${nextPlanned}-envios.${trimmedExt}`;
        spreadsheetTrimmedPath = path.join(storageDir, spreadsheetTrimmedFileName);
        try {
          const trimmedSpreadsheetBuffer = officialUniqueSheet
            ? writeOfficialCampaignLeadsFile(officialUniqueSheet, sheetName, nextPlanned)
            : trimLeadsBufferToRowCount(spreadsheetBuffer, nextPlanned, sheetName);
          writeFileSync(spreadsheetStoredPath, spreadsheetBuffer);
          writeFileSync(spreadsheetTrimmedPath, trimmedSpreadsheetBuffer);
        } catch {
          return res.status(400).json({ error: "Não foi possível preparar o arquivo de leads para envio." });
        }
      }

      let scheduledSendAt = current.scheduledSendAt || "";
      if (Object.prototype.hasOwnProperty.call(body, "scheduledSendAt")) {
        try {
          scheduledSendAt = parseScheduledSendAt(body.scheduledSendAt, { requireFuture: true });
        } catch (error) {
          return res.status(400).json({
            error: error instanceof Error ? error.message : "Data de agendamento inválida.",
          });
        }
      }

      let responseShortUrl = current.responseShortUrl || "";
      let responseShortSlug = current.responseShortSlug || "";
      if (responseLink !== (current.responseLink || "") || !responseShortUrl) {
        try {
          const tracked = await createCampaignIntakeTrackedShortUrl({
            destinationUrl: responseLink,
            campaignId: current.id,
            ownerEmail: auth.email,
            publicBaseHints: publicBaseHintsFromExpressRequest(req),
          });
          responseShortUrl = tracked.shortUrl;
          responseShortSlug = tracked.shortSlug;
        } catch (error) {
          console.warn("[disparos/campanhas/intake] short url na edição:", error);
        }
      }

      const now = new Date().toISOString();
      const patch: Partial<WabaCampaignIntake> = {
        campaignName,
        regionDdd,
        whatsappName,
        textOptions,
        responseLink,
        campaignMediaKind: mediaKind,
        imageFileName,
        imageStoredPath,
        whatsappLogoFileName,
        whatsappLogoStoredPath,
        spreadsheetFileName,
        spreadsheetStoredPath,
        spreadsheetTrimmedPath,
        spreadsheetTrimmedFileName,
        importedLineCount,
        plannedSendCount: nextPlanned,
        status: "generated",
        updatedAt: now,
      };
      if (responseShortUrl) patch.responseShortUrl = responseShortUrl;
      if (responseShortSlug) patch.responseShortSlug = responseShortSlug;
      if (scheduledSendAt) patch.scheduledSendAt = scheduledSendAt;
      else if (Object.prototype.hasOwnProperty.call(body, "scheduledSendAt")) {
        delete current.scheduledSendAt;
        patch.scheduledSendAt = "";
      }

      const updated = intakeRepository.updateById(current.id, patch);
      if (!updated) {
        return res.status(404).json({ error: "Campanha não encontrada." });
      }
      if (!unlimitedCredits) {
        disparosCreditsService.refreshConsumedFromIntakes(auth.email);
      }
      return res.status(200).json(
        buildIntakeSuccessPayload(updated, { duplicatesRemoved: phoneDuplicatesRemoved }),
      );
    } catch (error) {
      if (error instanceof OfficialCampaignCopyError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error("[disparos/campanhas/intake] editar erro:", error);
      return res.status(500).json({ error: "Não foi possível salvar a campanha. Tente novamente." });
    }
  });

  app.get("/disparos/dashboard/overview", (req, res) => {
    const auth = resolveRequestAuth(req);
    if (!auth.email) {
      return res.status(401).json({ error: "Faça login para ver seu dashboard de disparos." });
    }

    const overview =
      auth.role === "master"
        ? buildMasterSubscribersDisparosDashboardOverview(
            auth.email,
            intakeRepository.listAll(),
            subscriberRepository.list().map((subscriber) => ({
              email: subscriber.email,
              fullName: subscriber.fullName,
            })),
          )
        : buildDisparosDashboardOverview(
            auth.email,
            intakeRepository.listByEmail(auth.email),
          );

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(overview);
  });
};
