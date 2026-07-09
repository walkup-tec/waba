import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
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
  countSpreadsheetImportedRows,
  trimSpreadsheetBufferToRowCount,
} from "./waba-campaign-spreadsheet.util";
import { notifyOperacionalStaffOnCampaignAssigned } from "../mail/waba-operacional-campaign-notify.service";
import { WabaCampaignSupplierAssignmentService } from "../services/waba-campaign-supplier-assignment.service";
import { buildDisparosDashboardOverview, buildMasterSubscribersDisparosDashboardOverview } from "./waba-disparos-dashboard.service";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import {
  normalizeCampaignIntakeStatus,
  toCampaignIntakeDisplayStatus,
} from "./waba-campaign-intake-status";

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

const toDisplayStatus = (status: WabaCampaignIntake["status"]): string =>
  toCampaignIntakeDisplayStatus(status, "subscriber");

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
  if (requestedSendCount > importedLineCount) {
    return {
      plannedSendCount: 0,
      isMaster: unlimitedCredits,
      error: `A planilha contém apenas ${importedLineCount} linha(s). Reduza a quantidade ou importe mais contatos.`,
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
  const status = normalizeStoredStatus(intake.status);
  if (status !== "completed" || !intake.performanceReport) return 0;
  const sent = Math.round(Number(intake.performanceReport.sent ?? NaN));
  if (!Number.isFinite(sent) || sent < 0) return 0;
  return sent;
};

const toPublicIntake = (intake: WabaCampaignIntake) => {
  const status = normalizeStoredStatus(intake.status);
  const importedLineCount = Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
  const plannedSendCount = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
  const apiKind = resolveIntakeApiKindFromIntake(intake);
  return {
    id: intake.id,
    name: intake.campaignName,
    campaignName: intake.campaignName,
    createdAt: intake.createdAt,
    updatedAt: intake.updatedAt,
    status,
    displayStatus: toDisplayStatus(status),
    regionDdd: intake.regionDdd,
    importedLineCount,
    plannedSendCount,
    apiKind,
    planTypeLabel: WABA_DISPATCHES_API_LABELS[apiKind],
    /** Envios confirmados no relatório do operacional (somente campanhas finalizadas). */
    sentCount: resolveReportedSentCount(intake),
    hasErrorReport: status === "error_reported",
    source: "intake" as const,
  };
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
      error: "Assinantes do segmento Bets geram campanhas apenas na API Oficial.",
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

const handleCampaignIntakeUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadIntake.fields([
    { name: "image", maxCount: 1 },
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
      const campaignName = String(body.campaignName ?? "").trim();
      const regionDdd = normalizeDdd(String(body.regionDdd ?? ""));
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
        spreadsheet?: Express.Multer.File[];
      };
      const imageFile = files?.image?.[0];
      const spreadsheetFile = files?.spreadsheet?.[0];

      if (!imageFile) {
        return res.status(400).json({ error: "Envie a imagem da campanha (1080×1080 px)." });
      }
      if (!spreadsheetFile) {
        return res.status(400).json({ error: "Envie a planilha Excel com a lista de leads." });
      }

      const imageMime = String(imageFile.mimetype || "").toLowerCase();
      if (!imageMime.startsWith("image/")) {
        return res.status(400).json({ error: "A imagem deve ser PNG ou JPG." });
      }

      const sheetName = String(spreadsheetFile.originalname || "").toLowerCase();
      if (!sheetName.endsWith(".xlsx") && !sheetName.endsWith(".xls")) {
        return res.status(400).json({ error: "A lista de clientes deve ser um arquivo Excel (.xlsx ou .xls)." });
      }

      let importedLineCount = 0;
      try {
        importedLineCount = countSpreadsheetImportedRows(spreadsheetFile.buffer);
      } catch {
        return res.status(400).json({ error: "Não foi possível ler a planilha Excel." });
      }
      if (importedLineCount < 1) {
        return res.status(400).json({ error: "A planilha não contém linhas de leads." });
      }

      const { apiKind, error: apiKindError } = parseRequestedApiKind(body, auth.email);
      if (apiKindError) {
        return res.status(400).json({ error: apiKindError });
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

      const now = new Date().toISOString();
      const intakeId = randomUUID();
      const storageDir = resolveCampaignIntakeStorageDir(intakeId);
      const imageExt = imageMime.includes("png") ? ".png" : ".jpg";
      const imageStoredPath = path.join(storageDir, `campaign-image${imageExt}`);
      const spreadsheetStoredPath = path.join(storageDir, spreadsheetFile.originalname || "leads.xlsx");
      const spreadsheetTrimmedFileName = `leads-${plannedSendCount}-envios.xlsx`;
      const spreadsheetTrimmedPath = path.join(storageDir, spreadsheetTrimmedFileName);
      let trimmedSpreadsheetBuffer: Buffer;
      try {
        trimmedSpreadsheetBuffer = trimSpreadsheetBufferToRowCount(
          spreadsheetFile.buffer,
          plannedSendCount,
        );
      } catch {
        return res.status(400).json({ error: "Não foi possível preparar a planilha para envio." });
      }

      try {
        writeFileSync(imageStoredPath, imageFile.buffer);
        writeFileSync(spreadsheetStoredPath, spreadsheetFile.buffer);
        writeFileSync(spreadsheetTrimmedPath, trimmedSpreadsheetBuffer);
      } catch {
        return res.status(500).json({
          error: "Não foi possível gravar os arquivos da campanha no servidor. Tente novamente.",
        });
      }

      let intake = intakeRepository.create({
        id: intakeId,
        ownerEmail: auth.email,
        campaignName,
        regionDdd,
        textOptions,
        responseLink,
        imageFileName: imageFile.originalname || `campaign-image${imageExt}`,
        imageStoredPath,
        spreadsheetFileName: spreadsheetFile.originalname || "leads.xlsx",
        spreadsheetStoredPath,
        spreadsheetTrimmedPath,
        spreadsheetTrimmedFileName,
        importedLineCount,
        plannedSendCount,
        apiKind,
        status: "generated",
        createdAt: now,
        updatedAt: now,
      });

      if (!isMaster && plannedSendCount > 0) {
        disparosCreditsService.recordShipmentConsumed(auth.email, plannedSendCount, apiKind);
      }

      intake = new WabaCampaignSupplierAssignmentService().ensureInitialAssignment(intake);
      const operacionalNotify = await notifyOperacionalStaffOnCampaignAssigned(intake);
      intakeRepository.updateById(intake.id, {
        updatedAt: new Date().toISOString(),
        operacionalNotifyAudit: operacionalNotify,
      });

      const importSummary =
        plannedSendCount < importedLineCount
          ? `Quantidade de linhas importadas: ${importedLineCount}. Quantidade de envios: ${plannedSendCount} envios (limite do seu pacote contratado).`
          : `Quantidade de linhas importadas: ${importedLineCount}. Quantidade de envios: ${plannedSendCount} envios.`;

      return res.status(201).json({
        ok: true,
        ...toPublicIntake(intake),
        operacionalNotify,
        message:
          "Nosso time está trabalhando em sua campanha, em breve retornaremos com os indicadores de performance.",
        importSummary,
      });
    } catch (error) {
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
      const items = intakeRepository.listByEmail(auth.email).map(toPublicIntake);
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
    const status = normalizeStoredStatus(intake.status);
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

    const report = intake.performanceReport;
    const indicators = report
      ? {
          totalLeads: report.totalLeads,
          enviados: report.sent,
          entregues: report.delivered,
          lidos: report.read,
          falhados: report.failed,
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
      displayStatus: toDisplayStatus(status),
      regionDdd: intake.regionDdd,
      indicators,
      message: report
        ? "Indicadores de performance da campanha."
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
