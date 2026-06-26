"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaOperacionalCampanhasService = exports.CAMPAIGN_START_DEADLINE_MS = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const waba_billing_order_repository_1 = require("../billing/waba-billing-order.repository");
const waba_disparos_bonus_service_1 = require("../billing/waba-disparos-bonus.service");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_campaign_spreadsheet_util_1 = require("../disparos/waba-campaign-spreadsheet.util");
const waba_auth_service_1 = require("../auth/waba-auth.service");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_campaign_intake_repository_1 = require("../disparos/waba-campaign-intake.repository");
const waba_campaign_intake_status_1 = require("../disparos/waba-campaign-intake-status");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_disparos_credits_service_1 = require("../billing/waba-disparos-credits.service");
const waba_mail_delivery_1 = require("../mail/waba-mail-delivery");
const waba_operacional_campaign_notify_service_1 = require("../mail/waba-operacional-campaign-notify.service");
exports.CAMPAIGN_START_DEADLINE_MS = 6 * 60 * 60 * 1000;
const normalizeEmail = (value) => value.trim().toLowerCase();
const formatDateLabel = (iso) => {
    const value = String(iso ?? "").trim();
    if (!value)
        return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "—";
    return date.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};
const normalizeStoredStatus = (status) => (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(status);
const toDisplayStatus = (status) => (0, waba_campaign_intake_status_1.toCampaignIntakeDisplayStatus)(status, "operacional");
const isCampaignAwaitingConfiguration = (status) => status === "generated" || status === "in_progress";
const parseNonNegativeInt = (value) => {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0)
        return -1;
    return parsed;
};
const toPerformanceReportMetricsInput = (body) => {
    const sent = parseNonNegativeInt(body.sent);
    const delivered = parseNonNegativeInt(body.delivered);
    const read = parseNonNegativeInt(body.read);
    const failed = parseNonNegativeInt(body.failed);
    if ([sent, delivered, read, failed].some((value) => value < 0)) {
        return null;
    }
    return { sent, delivered, read, failed };
};
const resolveIntakeApiKind = (intake, orderRepository) => {
    if (intake.apiKind === "oficial" || intake.apiKind === "alternativa") {
        return intake.apiKind;
    }
    return (0, waba_dispatches_api_kind_1.resolveSubscriberDispatchesApiKindFromOrdersAt)(intake.ownerEmail, intake.createdAt, orderRepository);
};
const resolveIntakeApiKindForBonus = (intake) => (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
const resolvePlanTypeLabel = (intake, orderRepository) => {
    const apiKind = resolveIntakeApiKind(intake, orderRepository);
    return `Disparo ${waba_dispatches_api_kind_1.WABA_DISPATCHES_API_LABELS[apiKind]}`;
};
const resolvePlannedSendCount = (intake) => {
    const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
    if (planned > 0)
        return planned;
    return Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
};
const resolveCampaignStartDeadlineAt = (createdAt) => {
    const createdMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdMs))
        return "";
    return new Date(createdMs + exports.CAMPAIGN_START_DEADLINE_MS).toISOString();
};
const isCampaignStartOverdue = (intake) => {
    const status = normalizeStoredStatus(intake.status);
    if (status === "completed" || status === "cancelled" || status === "error_reported")
        return false;
    const createdMs = new Date(intake.createdAt).getTime();
    if (Number.isNaN(createdMs))
        return false;
    const deadlineMs = createdMs + exports.CAMPAIGN_START_DEADLINE_MS;
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
class WabaOperacionalCampanhasService {
    constructor(intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository(), subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository(), orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), bonusService = new waba_disparos_bonus_service_1.WabaDisparosBonusService(), creditsService = new waba_disparos_credits_service_1.WabaDisparosCreditsService(), systemUserService = new waba_system_user_service_1.WabaSystemUserService()) {
        this.intakeRepository = intakeRepository;
        this.subscriberRepository = subscriberRepository;
        this.orderRepository = orderRepository;
        this.bonusService = bonusService;
        this.creditsService = creditsService;
        this.systemUserService = systemUserService;
    }
    resolveStaffApiFilter(staff) {
        if (staff.role === "master" || (0, waba_auth_service_1.isWabaMasterEmail)(staff.email))
            return null;
        if (staff.role === "suporte")
            return null;
        if (staff.role !== "operacional")
            return null;
        const apiKind = this.systemUserService.getOperacionalDispatchesApiForEmail(staff.email);
        return apiKind ?? "unassigned";
    }
    matchesStaffApiFilter(intake, staff) {
        const filter = this.resolveStaffApiFilter(staff);
        if (filter === null)
            return true;
        if (filter === "unassigned")
            return false;
        return resolveIntakeApiKind(intake, this.orderRepository) === filter;
    }
    getIntakeForStaffOrThrow(campaignId, staff) {
        const intake = this.intakeRepository.getById(campaignId);
        if (!intake)
            throw new Error("Campanha não encontrada.");
        if (!this.matchesStaffApiFilter(intake, staff)) {
            throw new Error("Campanha não disponível para o seu tipo de operação.");
        }
        return intake;
    }
    toListItem(intake) {
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
    listCampaigns(staff) {
        return this.intakeRepository
            .listAll()
            .filter((intake) => this.matchesStaffApiFilter(intake, staff))
            .map((intake) => this.toListItem(intake))
            .sort((a, b) => {
            if (a.needsConfiguration !== b.needsConfiguration) {
                return a.needsConfiguration ? -1 : 1;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }
    getCampaignDetail(campaignId, staff) {
        const intake = this.intakeRepository.getById(campaignId);
        if (!intake || !this.matchesStaffApiFilter(intake, staff))
            return null;
        const base = this.toListItem(intake);
        const plannedSendCount = base.plannedSendCount;
        const trimmedName = intake.spreadsheetTrimmedFileName ||
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
    markCampaignStarted(campaignId, staff) {
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
        if (!updated)
            throw new Error("Não foi possível atualizar a campanha.");
        const detail = this.getCampaignDetail(campaignId, staff);
        if (!detail)
            throw new Error("Campanha não encontrada.");
        return detail;
    }
    getCampaignReport(campaignId, staff) {
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
    saveCampaignReport(campaignId, body, staff) {
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
        const performanceReport = {
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
        if (!updated)
            throw new Error("Não foi possível salvar o relatório.");
        if (bonusShipments > 0) {
            this.bonusService.grantCampaignBonus(intake.ownerEmail, campaignId, bonusShipments, resolveIntakeApiKindForBonus(intake));
        }
        (0, waba_mail_delivery_1.notifyCampaignCompletedEmail)({
            ownerEmail: intake.ownerEmail,
            campaignId,
            campaignName: intake.campaignName,
        });
        const detail = this.getCampaignDetail(campaignId, staff);
        if (!detail)
            throw new Error("Campanha não encontrada.");
        return detail;
    }
    reportCampaignError(campaignId, justificationRaw, staff) {
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
        const errorReport = {
            justification,
            reportedAt: now,
            reportedByEmail: normalizeEmail(staff.email),
        };
        const updated = this.intakeRepository.updateById(campaignId, {
            status: "error_reported",
            errorReport,
            updatedAt: now,
        });
        if (!updated)
            throw new Error("Não foi possível registrar o erro da campanha.");
        this.creditsService.refreshConsumedFromIntakes(intake.ownerEmail);
        (0, waba_mail_delivery_1.notifyCampaignErrorReportedEmail)({
            ownerEmail: intake.ownerEmail,
            campaignId,
            campaignName: intake.campaignName,
        });
        const detail = this.getCampaignDetail(campaignId, staff);
        if (!detail)
            throw new Error("Campanha não encontrada.");
        return detail;
    }
    resolveImageDownload(intakeId, staff) {
        const intake = this.intakeRepository.getById(intakeId);
        if (!intake || !this.matchesStaffApiFilter(intake, staff))
            return null;
        if (!intake.imageStoredPath || !(0, node_fs_1.existsSync)(intake.imageStoredPath)) {
            return null;
        }
        return {
            filePath: intake.imageStoredPath,
            fileName: intake.imageFileName || node_path_1.default.basename(intake.imageStoredPath),
        };
    }
    resolveSpreadsheetDownload(intakeId, staff) {
        const intake = this.intakeRepository.getById(intakeId);
        if (!intake || !this.matchesStaffApiFilter(intake, staff))
            return null;
        const plannedSendCount = resolvePlannedSendCount(intake);
        const trimmedFileName = intake.spreadsheetTrimmedFileName ||
            `leads-${plannedSendCount}-envios.xlsx`;
        if (intake.spreadsheetTrimmedPath && (0, node_fs_1.existsSync)(intake.spreadsheetTrimmedPath)) {
            return {
                buffer: (0, node_fs_1.readFileSync)(intake.spreadsheetTrimmedPath),
                fileName: trimmedFileName,
            };
        }
        if (!intake.spreadsheetStoredPath || !(0, node_fs_1.existsSync)(intake.spreadsheetStoredPath)) {
            return null;
        }
        const originalBuffer = (0, node_fs_1.readFileSync)(intake.spreadsheetStoredPath);
        return {
            buffer: (0, waba_campaign_spreadsheet_util_1.trimSpreadsheetBufferToRowCount)(originalBuffer, plannedSendCount),
            fileName: trimmedFileName,
        };
    }
    async resendOperacionalNotifyEmail(campaignId, staff) {
        const intake = this.getIntakeForStaffOrThrow(campaignId, staff);
        const result = await (0, waba_operacional_campaign_notify_service_1.notifyOperacionalStaffOnCampaignCreated)(intake);
        this.intakeRepository.updateById(intake.id, {
            updatedAt: new Date().toISOString(),
            operacionalNotifyAudit: result,
        });
        const anySent = result.recipients.some((item) => item.status === "sent");
        if (!result.recipients.length) {
            throw new Error(`Nenhum operacional designado para ${result.apiKindLabel}. Ajuste em Admin · Usuários.`);
        }
        if (!anySent) {
            throw new Error(result.recipients.map((item) => `${item.email}: ${item.message}`).join(" | ") ||
                "Falha ao enviar e-mail operacional.");
        }
        return result;
    }
}
exports.WabaOperacionalCampanhasService = WabaOperacionalCampanhasService;
