import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { WabaBillingOrderRepository } from "../billing/waba-billing-order.repository";
import { WabaDisparosBonusService } from "../billing/waba-disparos-bonus.service";
import {
  resolveIntakeApiKindFromIntake,
  resolveSubscriberDispatchesApiKindFromOrdersAt,
  WABA_DISPATCHES_API_LABELS,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";
import {
  trimSpreadsheetBufferToRowCount,
} from "../disparos/waba-campaign-spreadsheet.util";
import { isWabaMasterEmail } from "../auth/waba-auth.service";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import type { WabaSystemUserOperacionalSegment } from "../users/waba-system-user.repository";
import {
  WabaCampaignIntakeRepository,
  type WabaCampaignIntake,
  type WabaCampaignIntakeStatus,
  type WabaCampaignPerformanceReport,
  type WabaCampaignErrorReport,
} from "../disparos/waba-campaign-intake.repository";
import {
  normalizeCampaignIntakeStatus,
  toCampaignIntakeDisplayStatus,
} from "../disparos/waba-campaign-intake-status";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";
import { WabaDisparosCreditsService } from "../billing/waba-disparos-credits.service";
import { notifyCampaignCompletedEmail, notifyCampaignErrorReportedEmail } from "../mail/waba-mail-delivery";
import {
  notifyOperacionalStaffOnCampaignCreated,
  type OperacionalNotifyResult,
} from "../mail/waba-operacional-campaign-notify.service";

export const CAMPAIGN_START_DEADLINE_MS = 6 * 60 * 60 * 1000;

export type OperacionalCampaignListItem = {
  id: string;
  subscriberId: string;
  subscriberEmail: string;
  subscriberName: string;
  planTypeLabel: string;
  apiKind: WabaDispatchesApiKind;
  campaignName: string;
  plannedSendCount: number;
  importedLineCount: number;
  status: WabaCampaignIntakeStatus;
  displayStatus: string;
  needsConfiguration: boolean;
  canStartCampaign: boolean;
  canFillReport: boolean;
  canReportError: boolean;
  isStartOverdue: boolean;
  startDeadlineAt: string;
  createdAt: string;
  createdAtLabel: string;
};

export type OperacionalCampaignReportInput = {
  totalLeads: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

export type OperacionalCampaignDetail = OperacionalCampaignListItem & {
  regionDdd: string;
  textOptions: [string, string, string];
  responseLink: string;
  imageFileName: string;
  spreadsheetFileName: string;
  spreadsheetTrimmedFileName: string;
  updatedAt: string;
  updatedAtLabel: string;
  performanceReport: WabaCampaignPerformanceReport | null;
  errorReport: WabaCampaignErrorReport | null;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const formatDateLabel = (iso: string): string => {
  const value = String(iso ?? "").trim();
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeStoredStatus = (status: string): WabaCampaignIntakeStatus =>
  normalizeCampaignIntakeStatus(status);

const toDisplayStatus = (status: WabaCampaignIntakeStatus): string =>
  toCampaignIntakeDisplayStatus(status, "operacional");

const isCampaignAwaitingConfiguration = (status: WabaCampaignIntakeStatus): boolean =>
  status === "generated" || status === "in_progress";

const parseNonNegativeInt = (value: unknown): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return -1;
  return parsed;
};

const toPerformanceReportMetricsInput = (
  body: Record<string, unknown>,
): Omit<OperacionalCampaignReportInput, "totalLeads"> | null => {
  const sent = parseNonNegativeInt(body.sent);
  const delivered = parseNonNegativeInt(body.delivered);
  const read = parseNonNegativeInt(body.read);
  const failed = parseNonNegativeInt(body.failed);
  if ([sent, delivered, read, failed].some((value) => value < 0)) {
    return null;
  }
  return { sent, delivered, read, failed };
};

const resolveIntakeApiKind = (
  intake: WabaCampaignIntake,
  orderRepository: WabaBillingOrderRepository,
): WabaDispatchesApiKind => {
  if (intake.apiKind === "oficial" || intake.apiKind === "alternativa") {
    return intake.apiKind;
  }
  return resolveSubscriberDispatchesApiKindFromOrdersAt(
    intake.ownerEmail,
    intake.createdAt,
    orderRepository,
  );
};

const resolveIntakeApiKindForBonus = (intake: WabaCampaignIntake): WabaDispatchesApiKind =>
  resolveIntakeApiKindFromIntake(intake);

const resolvePlanTypeLabel = (
  intake: WabaCampaignIntake,
  orderRepository: WabaBillingOrderRepository,
): string => {
  const apiKind = resolveIntakeApiKind(intake, orderRepository);
  return `Disparo ${WABA_DISPATCHES_API_LABELS[apiKind]}`;
};

const resolvePlannedSendCount = (intake: WabaCampaignIntake): number => {
  const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
  if (planned > 0) return planned;
  return Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
};

const resolveCampaignStartDeadlineAt = (createdAt: string): string => {
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return "";
  return new Date(createdMs + CAMPAIGN_START_DEADLINE_MS).toISOString();
};

const isCampaignStartOverdue = (intake: WabaCampaignIntake): boolean => {
  const status = normalizeStoredStatus(intake.status);
  if (status === "completed" || status === "cancelled" || status === "error_reported") return false;

  const createdMs = new Date(intake.createdAt).getTime();
  if (Number.isNaN(createdMs)) return false;
  const deadlineMs = createdMs + CAMPAIGN_START_DEADLINE_MS;

  if (status === "generated") {
    return Date.now() > deadlineMs;
  }

  if (status === "in_progress") {
    const startedMs = new Date(String(intake.startedAt ?? "")).getTime();
    if (!Number.isNaN(startedMs)) {
      return startedMs > deadlineMs;
    }
    return Date.now() > deadlineMs;
  }

  return false;
};

export type OperacionalCampanhasStaffContext = {
  email: string;
  role: string;
};

export class WabaOperacionalCampanhasService {
  constructor(
    private readonly intakeRepository = new WabaCampaignIntakeRepository(),
    private readonly subscriberRepository = new WabaSubscriberRepository(),
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly bonusService = new WabaDisparosBonusService(),
    private readonly creditsService = new WabaDisparosCreditsService(),
    private readonly systemUserService = new WabaSystemUserService(),
  ) {}

  private resolveStaffApiFilter(
    staff: OperacionalCampanhasStaffContext,
  ): WabaDispatchesApiKind | null | "unassigned" {
    if (staff.role === "master" || isWabaMasterEmail(staff.email)) return null;
    if (staff.role === "suporte") return null;
    if (staff.role !== "operacional") return null;
    const apiKind = this.systemUserService.getOperacionalDispatchesApiForEmail(staff.email);
    return apiKind ?? "unassigned";
  }

  private resolveStaffSegmentFilter(
    staff: OperacionalCampanhasStaffContext,
  ): WabaSubscriberSegment | null | "unassigned" {
    if (staff.role === "master" || isWabaMasterEmail(staff.email)) return null;
    if (staff.role === "suporte") return null;
    if (staff.role !== "operacional") return null;
    const segment = this.systemUserService.getOperacionalSegmentForEmail(staff.email);
    return segment ?? "unassigned";
  }

  private resolveSubscriberSegmentForIntake(intake: WabaCampaignIntake): WabaSubscriberSegment {
    const email = normalizeEmail(intake.ownerEmail);
    const subscriber = this.subscriberRepository.getByEmail(email);
    return subscriber?.segment ?? "outros";
  }

  private matchesStaffApiFilter(
    intake: WabaCampaignIntake,
    staff: OperacionalCampanhasStaffContext,
  ): boolean {
    const filter = this.resolveStaffApiFilter(staff);
    if (filter === null) return true;
    if (filter === "unassigned") return false;
    return resolveIntakeApiKind(intake, this.orderRepository) === filter;
  }

  private matchesStaffSegmentFilter(
    intake: WabaCampaignIntake,
    staff: OperacionalCampanhasStaffContext,
  ): boolean {
    const filter = this.resolveStaffSegmentFilter(staff);
    if (filter === null) return true;
    if (filter === "unassigned") return false;
    return this.resolveSubscriberSegmentForIntake(intake) === filter;
  }

  private matchesStaffCampaignFilter(
    intake: WabaCampaignIntake,
    staff: OperacionalCampanhasStaffContext,
  ): boolean {
    return (
      this.matchesStaffApiFilter(intake, staff) && this.matchesStaffSegmentFilter(intake, staff)
    );
  }

  private getIntakeForStaffOrThrow(
    campaignId: string,
    staff: OperacionalCampanhasStaffContext,
  ): WabaCampaignIntake {
    const intake = this.intakeRepository.getById(campaignId);
    if (!intake) throw new Error("Campanha não encontrada.");
    if (!this.matchesStaffCampaignFilter(intake, staff)) {
      throw new Error("Campanha não disponível para o seu tipo de operação.");
    }
    return intake;
  }

  private toListItem(intake: WabaCampaignIntake): OperacionalCampaignListItem {
    const email = normalizeEmail(intake.ownerEmail);
    const subscriber = this.subscriberRepository.getByEmail(email);
    const status = normalizeStoredStatus(intake.status);
    const importedLineCount = Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
    const plannedSendCount = resolvePlannedSendCount(intake);
    const apiKind = resolveIntakeApiKind(intake, this.orderRepository);

    return {
      id: intake.id,
      subscriberId: subscriber?.id ?? "—",
      subscriberEmail: email,
      subscriberName: subscriber?.fullName ?? "—",
      planTypeLabel: resolvePlanTypeLabel(intake, this.orderRepository),
      apiKind,
      campaignName: intake.campaignName,
      plannedSendCount,
      importedLineCount,
      status,
      displayStatus: toDisplayStatus(status),
      needsConfiguration: isCampaignAwaitingConfiguration(status),
      canStartCampaign: status === "generated",
      canFillReport: status === "in_progress" || status === "completed",
      canReportError: status === "generated" || status === "in_progress",
      isStartOverdue: isCampaignStartOverdue(intake),
      startDeadlineAt: resolveCampaignStartDeadlineAt(intake.createdAt),
      createdAt: intake.createdAt,
      createdAtLabel: formatDateLabel(intake.createdAt),
    };
  }

  listCampaigns(staff: OperacionalCampanhasStaffContext): OperacionalCampaignListItem[] {
    return this.intakeRepository
      .listAll()
      .filter((intake) => this.matchesStaffCampaignFilter(intake, staff))
      .map((intake) => this.toListItem(intake))
      .sort((a, b) => {
        if (a.needsConfiguration !== b.needsConfiguration) {
          return a.needsConfiguration ? -1 : 1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  getCampaignDetail(
    campaignId: string,
    staff: OperacionalCampanhasStaffContext,
  ): OperacionalCampaignDetail | null {
    const intake = this.intakeRepository.getById(campaignId);
    if (!intake || !this.matchesStaffCampaignFilter(intake, staff)) return null;

    const base = this.toListItem(intake);
    const plannedSendCount = base.plannedSendCount;
    const trimmedName =
      intake.spreadsheetTrimmedFileName ||
      `leads-${plannedSendCount}-envios.xlsx`;

    return {
      ...base,
      regionDdd: intake.regionDdd,
      textOptions: intake.textOptions,
      responseLink: String(intake.responseLink ?? "").trim(),
      imageFileName: intake.imageFileName,
      spreadsheetFileName: intake.spreadsheetFileName,
      spreadsheetTrimmedFileName: trimmedName,
      updatedAt: intake.updatedAt,
      updatedAtLabel: formatDateLabel(intake.updatedAt),
      performanceReport: intake.performanceReport ?? null,
      errorReport: intake.errorReport ?? null,
    };
  }

  markCampaignStarted(
    campaignId: string,
    staff: OperacionalCampanhasStaffContext,
  ): OperacionalCampaignDetail {
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);
    const status = normalizeStoredStatus(intake.status);
    if (status !== "generated") {
      throw new Error("Somente campanhas aguardando configuração podem ser iniciadas.");
    }

    const now = new Date().toISOString();
    const updated = this.intakeRepository.updateById(campaignId, {
      status: "in_progress",
      startedAt: now,
      startedByEmail: normalizeEmail(staff.email),
      updatedAt: now,
    });
    if (!updated) throw new Error("Não foi possível atualizar a campanha.");

    const detail = this.getCampaignDetail(campaignId, staff);
    if (!detail) throw new Error("Campanha não encontrada.");
    return detail;
  }

  getCampaignReport(
    campaignId: string,
    staff: OperacionalCampanhasStaffContext,
  ): {
    campaignId: string;
    campaignName: string;
    status: WabaCampaignIntakeStatus;
    displayStatus: string;
    plannedSendCount: number;
    totalLeads: number;
    isReadOnly: boolean;
    report: OperacionalCampaignReportInput | null;
  } {
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);

    const status = normalizeStoredStatus(intake.status);
    if (status !== "in_progress" && status !== "completed" && status !== "error_reported") {
      throw new Error("O relatório fica disponível após iniciar a campanha.");
    }

    const totalLeads = resolvePlannedSendCount(intake);
    const report = intake.performanceReport;
    return {
      campaignId: intake.id,
      campaignName: intake.campaignName,
      status,
      displayStatus: toDisplayStatus(status),
      plannedSendCount: totalLeads,
      totalLeads,
      isReadOnly: status === "completed" || status === "error_reported",
      report: report
        ? {
            totalLeads,
            sent: report.sent,
            delivered: report.delivered,
            read: report.read,
            failed: report.failed,
          }
        : null,
    };
  }

  saveCampaignReport(
    campaignId: string,
    body: Record<string, unknown>,
    staff: OperacionalCampanhasStaffContext,
  ): OperacionalCampaignDetail {
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);

    const status = normalizeStoredStatus(intake.status);
    if (status === "completed" || status === "error_reported") {
      throw new Error("Esta campanha já foi finalizada.");
    }
    if (status === "cancelled") {
      throw new Error("Esta campanha foi cancelada e não pode receber relatório.");
    }
    if (status !== "in_progress") {
      throw new Error("Inicie a campanha (Campanha Iniciada) antes de finalizar com o relatório.");
    }

    const parsed = toPerformanceReportMetricsInput(body);
    if (!parsed) {
      throw new Error("Informe valores numéricos válidos (zero ou maior) em todos os campos.");
    }

    const totalLeads = resolvePlannedSendCount(intake);
    const now = new Date().toISOString();
    const performanceReport: WabaCampaignPerformanceReport = {
      totalLeads,
      ...parsed,
      filledAt: now,
      filledByEmail: normalizeEmail(staff.email),
    };

    const bonusShipments = Math.max(0, totalLeads - parsed.sent);
    const updated = this.intakeRepository.updateById(campaignId, {
      performanceReport,
      status: "completed",
      updatedAt: now,
    });
    if (!updated) throw new Error("Não foi possível salvar o relatório.");

    if (bonusShipments > 0) {
      this.bonusService.grantCampaignBonus(
        intake.ownerEmail,
        campaignId,
        bonusShipments,
        resolveIntakeApiKindForBonus(intake),
      );
    }

    notifyCampaignCompletedEmail({
      ownerEmail: intake.ownerEmail,
      campaignId,
      campaignName: intake.campaignName,
    });

    const detail = this.getCampaignDetail(campaignId, staff);
    if (!detail) throw new Error("Campanha não encontrada.");
    return detail;
  }

  reportCampaignError(
    campaignId: string,
    justificationRaw: string,
    staff: OperacionalCampanhasStaffContext,
  ): OperacionalCampaignDetail {
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);
    const status = normalizeStoredStatus(intake.status);
    if (status === "completed" || status === "error_reported") {
      throw new Error("Esta campanha já foi finalizada.");
    }
    if (status === "cancelled") {
      throw new Error("Esta campanha foi cancelada.");
    }
    if (status !== "generated" && status !== "in_progress") {
      throw new Error("Somente campanhas aguardando configuração ou em andamento podem ter erro reportado.");
    }

    const justification = String(justificationRaw || "").trim();
    if (justification.length < 8) {
      throw new Error("Informe a justificativa do erro (mínimo 8 caracteres).");
    }

    const now = new Date().toISOString();
    const errorReport: WabaCampaignErrorReport = {
      justification,
      reportedAt: now,
      reportedByEmail: normalizeEmail(staff.email),
    };

    const updated = this.intakeRepository.updateById(campaignId, {
      status: "error_reported",
      errorReport,
      updatedAt: now,
    });
    if (!updated) throw new Error("Não foi possível registrar o erro da campanha.");

    this.creditsService.refreshConsumedFromIntakes(intake.ownerEmail);

    notifyCampaignErrorReportedEmail({
      ownerEmail: intake.ownerEmail,
      campaignId,
      campaignName: intake.campaignName,
    });

    const detail = this.getCampaignDetail(campaignId, staff);
    if (!detail) throw new Error("Campanha não encontrada.");
    return detail;
  }

  resolveImageDownload(
    intakeId: string,
    staff: OperacionalCampanhasStaffContext,
  ): { filePath: string; fileName: string } | null {
    const intake = this.intakeRepository.getById(intakeId);
    if (!intake || !this.matchesStaffCampaignFilter(intake, staff)) return null;
    if (!intake.imageStoredPath || !existsSync(intake.imageStoredPath)) {
      return null;
    }
    return {
      filePath: intake.imageStoredPath,
      fileName: intake.imageFileName || path.basename(intake.imageStoredPath),
    };
  }

  resolveSpreadsheetDownload(
    intakeId: string,
    staff: OperacionalCampanhasStaffContext,
  ): { buffer: Buffer; fileName: string } | null {
    const intake = this.intakeRepository.getById(intakeId);
    if (!intake || !this.matchesStaffCampaignFilter(intake, staff)) return null;

    const plannedSendCount = resolvePlannedSendCount(intake);
    const trimmedFileName =
      intake.spreadsheetTrimmedFileName ||
      `leads-${plannedSendCount}-envios.xlsx`;

    if (intake.spreadsheetTrimmedPath && existsSync(intake.spreadsheetTrimmedPath)) {
      return {
        buffer: readFileSync(intake.spreadsheetTrimmedPath),
        fileName: trimmedFileName,
      };
    }

    if (!intake.spreadsheetStoredPath || !existsSync(intake.spreadsheetStoredPath)) {
      return null;
    }

    const originalBuffer = readFileSync(intake.spreadsheetStoredPath);
    return {
      buffer: trimSpreadsheetBufferToRowCount(originalBuffer, plannedSendCount),
      fileName: trimmedFileName,
    };
  }

  async resendOperacionalNotifyEmail(
    campaignId: string,
    staff: OperacionalCampanhasStaffContext,
  ): Promise<OperacionalNotifyResult> {
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);
    const result = await notifyOperacionalStaffOnCampaignCreated(intake);
    this.intakeRepository.updateById(intake.id, {
      updatedAt: new Date().toISOString(),
      operacionalNotifyAudit: result,
    });
    const anySent = result.recipients.some((item) => item.status === "sent");
    if (!result.recipients.length) {
      throw new Error(
        `Nenhum operacional designado para ${result.apiKindLabel}. Ajuste em Admin · Usuários.`,
      );
    }
    if (!anySent) {
      throw new Error(
        result.recipients.map((item) => `${item.email}: ${item.message}`).join(" | ") ||
          "Falha ao enviar e-mail operacional.",
      );
    }
    return result;
  }
}
