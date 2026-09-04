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
  isCampaignLeadsTxtFileName,
  trimLeadsBufferToRowCount,
} from "../disparos/waba-campaign-spreadsheet.util";
import { isWabaMasterEmail } from "../auth/waba-auth.service";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import type { WabaSystemUserOperacionalSegment } from "../users/waba-system-user.repository";
import {
  formatOperacionalSegmentsLabel,
  resolveOperacionalSegments,
} from "../users/waba-operacional-segments";
import {
  WabaCampaignIntakeRepository,
  type WabaCampaignIntake,
  type WabaCampaignIntakeStatus,
  type WabaCampaignPerformanceReport,
  type WabaCampaignErrorReport,
} from "../disparos/waba-campaign-intake.repository";
import {
  applyCampaignReportReadOverride,
  campaignReportHidesClicks,
} from "../disparos/waba-campaign-report-read-overrides";
import { collectIntakeReportTimeline } from "../disparos/waba-campaign-report-timeline";
import { campaignAttendedByLaboratorioStaff } from "../disparos/waba-campaign-laboratorio-attended";
import { finalizeIntakePerformanceReport } from "../disparos/waba-campaign-report-finalize.service";
import {
  normalizeCampaignIntakeStatus,
  toCampaignIntakeDisplayStatus,
} from "../disparos/waba-campaign-intake-status";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";
import { operacionalCanServeSubscriberCampaign } from "../services/waba-campaign-operacional-segment-rules";
import { WABA_SUBSCRIBER_SEGMENT_LABELS } from "../subscribers/waba-subscriber-segment";
import { WabaDisparosCreditsService } from "../billing/waba-disparos-credits.service";
import { notifyCampaignErrorReportedEmail } from "../mail/waba-mail-delivery";
import {
  notifyOperacionalStaffOnCampaignCreated,
  notifyOperacionalStaffOnCampaignAssigned,
  scheduleMastersBmInoperanteNotify,
  type OperacionalNotifyResult,
} from "../mail/waba-operacional-campaign-notify.service";
import { WabaFinanceiroSplitService } from "../billing/waba-financeiro-split.service";
import {
  CAMPAIGN_START_OVERDUE_MS,
  WabaCampaignSupplierAssignmentService,
} from "../services/waba-campaign-supplier-assignment.service";
import { findBroadcastByIntakeCampaignId } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import { summarizeBroadcastSendIssues } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast-send-issues";
import { computeMetaLabCampaignMetrics } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast-report";

/** @deprecated use CAMPAIGN_START_OVERDUE_MS — mantido para imports legados. */
export const CAMPAIGN_START_DEADLINE_MS = CAMPAIGN_START_OVERDUE_MS;

export type OperacionalCampaignListItem = {
  id: string;
  subscriberId: string;
  subscriberEmail: string;
  subscriberName: string;
  planTypeLabel: string;
  apiKind: WabaDispatchesApiKind;
  subscriberSegment: WabaSubscriberSegment;
  subscriberSegmentLabel: string;
  campaignName: string;
  plannedSendCount: number;
  importedLineCount: number;
  status: WabaCampaignIntakeStatus;
  displayStatus: string;
  needsConfiguration: boolean;
  canStartCampaign: boolean;
  canFillReport: boolean;
  canReportError: boolean;
  canBmInoperante: boolean;
  bmInoperanteRegistered: boolean;
  laboratorioAttended: boolean;
  isStartOverdue: boolean;
  startDeadlineAt: string;
  assignedOperacionalEmail: string;
  assignedOperacionalName: string;
  canTransferOperacional: boolean;
  createdAt: string;
  createdAtLabel: string;
};

export type OperacionalCampaignReportInput = {
  totalLeads: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  clicks?: number;
};

export type OperacionalBmInoperanteResult = {
  campaign?: OperacionalCampaignDetail | null;
  reassigned: boolean;
  exhausted: boolean;
  message: string;
};

export type OperacionalCampaignDetail = OperacionalCampaignListItem & {
  regionDdd: string;
  whatsappName: string;
  whatsappLogoFileName: string;
  hasWhatsappLogo: boolean;
  textOptions: [string, string, string];
  responseLink: string;
  imageFileName: string;
  mediaKind: "image" | "video";
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

const toDisplayStatus = (
  status: WabaCampaignIntakeStatus,
  laboratorioAttended = false,
): string => toCampaignIntakeDisplayStatus(status, "operacional", { laboratorioAttended });

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

const resolveCampaignStartDeadlineAt = (intake: WabaCampaignIntake): string => {
  const anchor = String(intake.assignedAt || intake.createdAt || "").trim();
  const anchorMs = new Date(anchor).getTime();
  if (Number.isNaN(anchorMs)) return "";
  return new Date(anchorMs + CAMPAIGN_START_OVERDUE_MS).toISOString();
};

const isCampaignStartOverdue = (
  intake: WabaCampaignIntake,
  assignmentService: WabaCampaignSupplierAssignmentService,
): boolean => assignmentService.isStartOverdue(intake);

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
    private readonly assignmentService = new WabaCampaignSupplierAssignmentService(),
    private readonly splitService = new WabaFinanceiroSplitService(),
  ) {}

  private resolveStaffApiFilter(
    staff: OperacionalCampanhasStaffContext,
  ): WabaDispatchesApiKind[] | null | "unassigned" {
    if (staff.role === "master" || isWabaMasterEmail(staff.email)) return null;
    if (staff.role === "suporte") return null;
    if (staff.role !== "operacional") return null;
    const apis = this.systemUserService.getOperacionalDispatchesApisForEmail(staff.email);
    return apis.length ? apis : "unassigned";
  }

  private resolveStaffSegmentFilter(
    staff: OperacionalCampanhasStaffContext,
  ): WabaSystemUserOperacionalSegment[] | null | "unassigned" {
    if (staff.role === "master" || isWabaMasterEmail(staff.email)) return null;
    if (staff.role === "suporte") return null;
    if (staff.role !== "operacional") return null;
    const segments = this.systemUserService.getOperacionalSegmentsForEmail(staff.email);
    return segments.length ? segments : "unassigned";
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
    return filter.includes(resolveIntakeApiKind(intake, this.orderRepository));
  }

  private matchesStaffSegmentFilter(
    intake: WabaCampaignIntake,
    staff: OperacionalCampanhasStaffContext,
  ): boolean {
    const filter = this.resolveStaffSegmentFilter(staff);
    if (filter === null) return true;
    if (filter === "unassigned") return false;
    return operacionalCanServeSubscriberCampaign(
      this.resolveSubscriberSegmentForIntake(intake),
      filter,
    );
  }

  private matchesStaffCampaignFilter(
    intake: WabaCampaignIntake,
    staff: OperacionalCampanhasStaffContext,
  ): boolean {
    if (!this.matchesStaffApiFilter(intake, staff)) return false;
    if (!this.matchesStaffSegmentFilter(intake, staff)) return false;
    if (staff.role === "master" || isWabaMasterEmail(staff.email) || staff.role === "suporte") {
      return true;
    }
    if (staff.role === "operacional") {
      return this.assignmentService.matchesAssignedOperacional(intake, staff.email);
    }
    return true;
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

  private toListItem(
    intake: WabaCampaignIntake,
    staff?: OperacionalCampanhasStaffContext,
  ): OperacionalCampaignListItem {
    const email = normalizeEmail(intake.ownerEmail);
    const subscriber = this.subscriberRepository.getByEmail(email);
    const status = normalizeStoredStatus(intake.status);
    const importedLineCount = Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
    const plannedSendCount = resolvePlannedSendCount(intake);
    const apiKind = resolveIntakeApiKind(intake, this.orderRepository);
    const subscriberSegment = this.resolveSubscriberSegmentForIntake(intake);
    const assignedOperacionalEmail = normalizeEmail(intake.assignedOperacionalEmail ?? "");
    const assignedUser = assignedOperacionalEmail
      ? this.systemUserService.getByEmail(assignedOperacionalEmail)
      : null;
    const assignedOperacionalName = String(
      assignedUser?.fullName || assignedOperacionalEmail || "",
    ).trim();
    const laboratorioAttended = campaignAttendedByLaboratorioStaff(intake);
    const isMaster =
      Boolean(staff) &&
      (staff!.role === "master" || isWabaMasterEmail(staff!.email));
    const canTransferOperacional =
      isMaster && (status === "generated" || status === "in_progress");

    return {
      id: intake.id,
      subscriberId: subscriber?.id ?? "—",
      subscriberEmail: email,
      subscriberName: subscriber?.fullName ?? "—",
      planTypeLabel: resolvePlanTypeLabel(intake, this.orderRepository),
      apiKind,
      subscriberSegment,
      subscriberSegmentLabel: WABA_SUBSCRIBER_SEGMENT_LABELS[subscriberSegment],
      campaignName: intake.campaignName,
      plannedSendCount,
      importedLineCount,
      status,
      displayStatus: toDisplayStatus(status, laboratorioAttended),
      needsConfiguration: isCampaignAwaitingConfiguration(status),
      canStartCampaign: status === "generated",
      canFillReport: !laboratorioAttended && (status === "in_progress" || status === "completed"),
      canReportError: status === "generated" || status === "in_progress",
      canBmInoperante: status === "generated" && !String(intake.bmInoperanteRegisteredAt || "").trim(),
      bmInoperanteRegistered: Boolean(String(intake.bmInoperanteRegisteredAt || "").trim()),
      laboratorioAttended,
      isStartOverdue: isCampaignStartOverdue(intake, this.assignmentService),
      startDeadlineAt: resolveCampaignStartDeadlineAt(intake),
      assignedOperacionalEmail,
      assignedOperacionalName: assignedOperacionalName || "—",
      canTransferOperacional,
      createdAt: intake.createdAt,
      createdAtLabel: formatDateLabel(intake.createdAt),
    };
  }

  listCampaigns(staff: OperacionalCampanhasStaffContext): OperacionalCampaignListItem[] {
    this.intakeRepository.backfillBonusFundingForOpenCampaigns();
    return this.intakeRepository
      .listAll()
      .map((intake) => {
        if (normalizeEmail(intake.assignedOperacionalEmail ?? "")) return intake;
        return this.assignmentService.ensureInitialAssignment(intake);
      })
      .filter((intake) => this.matchesStaffCampaignFilter(intake, staff))
      .map((intake) => this.toListItem(intake, staff))
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

    const base = this.toListItem(intake, staff);
    const plannedSendCount = base.plannedSendCount;
    const trimmedName =
      intake.spreadsheetTrimmedFileName ||
      `leads-${plannedSendCount}-envios.xlsx`;

    const whatsappLogoStoredPath = String(intake.whatsappLogoStoredPath ?? "").trim();
    const hasWhatsappLogo = Boolean(
      whatsappLogoStoredPath && existsSync(whatsappLogoStoredPath),
    );

    return {
      ...base,
      regionDdd: intake.regionDdd,
      whatsappName: String(intake.whatsappName ?? "").trim(),
      whatsappLogoFileName: String(intake.whatsappLogoFileName ?? "").trim(),
      hasWhatsappLogo,
      textOptions: intake.textOptions,
      responseLink: String(intake.responseLink ?? "").trim(),
      imageFileName: intake.imageFileName,
      mediaKind: intake.campaignMediaKind === "video" ? "video" : "image",
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
  ): OperacionalCampaignListItem {
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);
    const status = normalizeStoredStatus(intake.status);
    if (status !== "generated") {
      throw new Error("Somente campanhas aguardando configuração podem ser iniciadas.");
    }
    if (
      staff.role === "operacional" &&
      !this.assignmentService.matchesAssignedOperacional(intake, staff.email)
    ) {
      throw new Error("Esta campanha está atribuída a outro operacional.");
    }

    const now = new Date().toISOString();
    const updated = this.intakeRepository.updateById(campaignId, {
      status: "in_progress",
      startedAt: now,
      startedByEmail: normalizeEmail(staff.email),
      updatedAt: now,
    });
    if (!updated) throw new Error("Não foi possível atualizar a campanha.");

    return this.toListItem(updated, staff);
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
    laboratorioAttended: boolean;
    showClicks: boolean;
    source: "manual" | "meta_lab" | null;
    liveFromMeta: boolean;
    report: OperacionalCampaignReportInput | null;
    sendIssues: ReturnType<typeof summarizeBroadcastSendIssues> | null;
    timeline: ReturnType<typeof collectIntakeReportTimeline>;
  } {
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);

    const status = normalizeStoredStatus(intake.status);
    if (status !== "in_progress" && status !== "completed" && status !== "error_reported") {
      throw new Error("O relatório fica disponível após iniciar a campanha.");
    }

    const totalLeads = resolvePlannedSendCount(intake);
    const laboratorioAttended = campaignAttendedByLaboratorioStaff(intake);
    const stored = applyCampaignReportReadOverride(
      intake.campaignName,
      intake.createdAt,
      intake.performanceReport,
    );
    let report = stored;
    let liveFromMeta = false;
    const broadcast = findBroadcastByIntakeCampaignId(intake.id);
    if (laboratorioAttended && status === "in_progress" && broadcast) {
      const live = computeMetaLabCampaignMetrics(broadcast, totalLeads);
      report = {
        totalLeads: live.totalLeads,
        sent: live.sent,
        delivered: live.delivered,
        read: live.read,
        failed: live.failed,
        clicks: live.clicks,
        source: "meta_lab",
        filledAt: "",
        filledByEmail: "",
      };
      liveFromMeta = true;
    }
    const hideClicks = campaignReportHidesClicks(
      intake.campaignName,
      intake.createdAt,
      report || stored,
    );
    const showClicks = (laboratorioAttended || stored?.source === "meta_lab") && !hideClicks;
    const sendIssues =
      laboratorioAttended || stored?.source === "meta_lab"
        ? summarizeBroadcastSendIssues(broadcast)
        : null;
    return {
      campaignId: intake.id,
      campaignName: intake.campaignName,
      status,
      displayStatus: toDisplayStatus(status, laboratorioAttended),
      plannedSendCount: totalLeads,
      totalLeads,
      isReadOnly: laboratorioAttended || status === "completed" || status === "error_reported",
      laboratorioAttended,
      showClicks,
      source: report?.source || (laboratorioAttended ? "meta_lab" : null),
      liveFromMeta,
      report: report
        ? {
            totalLeads,
            sent: report.sent,
            delivered: report.delivered,
            read: report.read,
            failed: report.failed,
            ...(showClicks ? { clicks: Math.max(0, Math.round(Number(report.clicks || 0))) } : {}),
          }
        : null,
      sendIssues,
      // Mesma linha do tempo do relatório do assinante (criação → atendimento → template → disparo).
      timeline: collectIntakeReportTimeline(intake),
    };
  }

  saveCampaignReport(
    campaignId: string,
    body: Record<string, unknown>,
    staff: OperacionalCampanhasStaffContext,
  ): OperacionalCampaignDetail {
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);
    if (campaignAttendedByLaboratorioStaff(intake)) {
      throw new Error(
        "Esta campanha é atendida pelo Laboratório. Os indicadores vêm da Meta automaticamente.",
      );
    }

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

    const updated = finalizeIntakePerformanceReport({
      campaignId,
      metrics: parsed,
      filledByEmail: staff.email,
      source: "manual",
      intakeRepository: this.intakeRepository,
      bonusService: this.bonusService,
      splitService: this.splitService,
    });
    const detail = this.getCampaignDetail(updated.id, staff);
    if (!detail) throw new Error("Não foi possível salvar o relatório.");
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
    const storedName = path.basename(intake.imageStoredPath);
    const originalName = String(intake.imageFileName || storedName).trim() || storedName;
    const isVideo = intake.campaignMediaKind === "video";
    const fileName =
      isVideo && !originalName.toLowerCase().endsWith(".mp4") ? storedName : originalName;
    return {
      filePath: intake.imageStoredPath,
      fileName,
    };
  }

  resolveWhatsappLogoDownload(
    intakeId: string,
    staff: OperacionalCampanhasStaffContext,
  ): { filePath: string; fileName: string } | null {
    const intake = this.intakeRepository.getById(intakeId);
    if (!intake || !this.matchesStaffCampaignFilter(intake, staff)) return null;
    const logoPath = String(intake.whatsappLogoStoredPath ?? "").trim();
    if (!logoPath || !existsSync(logoPath)) {
      return null;
    }
    return {
      filePath: logoPath,
      fileName:
        String(intake.whatsappLogoFileName || "").trim() || path.basename(logoPath),
    };
  }

  resolveSpreadsheetDownload(
    intakeId: string,
    staff: OperacionalCampanhasStaffContext,
  ): { buffer: Buffer; fileName: string } | null {
    const intake = this.intakeRepository.getById(intakeId);
    if (!intake || !this.matchesStaffCampaignFilter(intake, staff)) return null;

    const plannedSendCount = resolvePlannedSendCount(intake);
    const sourceName =
      intake.spreadsheetTrimmedFileName ||
      intake.spreadsheetFileName ||
      intake.spreadsheetStoredPath ||
      "";
    const isTxt = isCampaignLeadsTxtFileName(sourceName);
    const trimmedFileName =
      intake.spreadsheetTrimmedFileName ||
      `leads-${plannedSendCount}-envios.${isTxt ? "txt" : "xlsx"}`;

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
      buffer: trimLeadsBufferToRowCount(
        originalBuffer,
        plannedSendCount,
        intake.spreadsheetFileName || intake.spreadsheetStoredPath,
      ),
      fileName: trimmedFileName,
    };
  }

  async markBmInoperante(
    campaignId: string,
    staff: OperacionalCampanhasStaffContext,
  ): Promise<OperacionalBmInoperanteResult> {
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);
    const status = normalizeStoredStatus(intake.status);
    if (status !== "generated") {
      throw new Error("BM inoperante só está disponível antes de iniciar a campanha.");
    }
    if (String(intake.bmInoperanteRegisteredAt || "").trim()) {
      throw new Error("BM inoperante já foi registrada para esta campanha.");
    }
    if (
      staff.role === "operacional" &&
      !this.assignmentService.matchesAssignedOperacional(intake, staff.email)
    ) {
      throw new Error("Esta campanha está atribuída a outro operacional.");
    }

    const result = await this.assignmentService.reassignCampaign(campaignId, "bm_inoperante");
    if (!result.reassigned) {
      if (!result.exhausted) {
        throw new Error("Não foi possível registrar BM inoperante.");
      }
      const now = new Date().toISOString();
      this.intakeRepository.updateById(campaignId, {
        bmInoperanteRegisteredAt: now,
        updatedAt: now,
      });
      scheduleMastersBmInoperanteNotify(campaignId);
      // Campanha permanece com este operacional; alerta master após 30h via processDueReassignments.
      const detail = this.getCampaignDetail(campaignId, staff);
      if (!detail) {
        throw new Error("BM inoperante registrada, mas não foi possível carregar os detalhes.");
      }
      return {
        campaign: detail,
        reassigned: false,
        exhausted: true,
        message: "Ok, aguardaremos até que a BM volte",
      };
    }

    return {
      reassigned: true,
      exhausted: false,
      message: "Campanha reatribuída ao próximo da fila de prioridade.",
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
        "Campanha sem operacional atribuído ou sem destinatários para notificar. Verifique a atribuição da campanha.",
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

  async assignCampaignToOperacional(
    campaignId: string,
    operacionalEmail: string,
    staff: OperacionalCampanhasStaffContext,
  ): Promise<OperacionalCampaignDetail> {
    if (staff.role !== "master" && !isWabaMasterEmail(staff.email)) {
      throw new Error("Somente master pode atribuir campanha a um operacional.");
    }
    await this.assignmentService.forceAssignToOperacionalEmail(campaignId, operacionalEmail);
    const detail = this.getCampaignDetail(campaignId, staff);
    if (!detail) {
      throw new Error("Campanha atribuída, mas não foi possível carregar os detalhes.");
    }
    return detail;
  }

  listTransferOperacionais(
    campaignId: string,
    staff: OperacionalCampanhasStaffContext,
  ): Array<{ email: string; fullName: string; segment: string; segmentLabel: string }> {
    if (staff.role !== "master" && !isWabaMasterEmail(staff.email)) {
      throw new Error("Somente master pode listar operacionais para transferência.");
    }
    const intake = this.getIntakeForStaffOrThrow(campaignId, staff);
    const status = normalizeStoredStatus(intake.status);
    if (status !== "generated" && status !== "in_progress") {
      throw new Error("Somente campanhas em aberto podem ser transferidas.");
    }
    const apiKind = resolveIntakeApiKind(intake, this.orderRepository);
    const subscriberSegment = this.resolveSubscriberSegmentForIntake(intake);
    const current = normalizeEmail(intake.assignedOperacionalEmail ?? "");
    return this.systemUserService
      .listOperacionalUsersForCampaign(apiKind, subscriberSegment)
      .filter((user) => normalizeEmail(user.email) !== current)
      .map((user) => {
        const segments = resolveOperacionalSegments(user);
        return {
          email: normalizeEmail(user.email),
          fullName: String(user.fullName || user.email).trim() || user.email,
          segment: segments[0] ?? "outros",
          segmentLabel: formatOperacionalSegmentsLabel(segments),
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  }
}
