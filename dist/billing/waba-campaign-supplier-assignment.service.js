"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaCampaignSupplierAssignmentService = void 0;
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_campaign_intake_repository_1 = require("../disparos/waba-campaign-intake.repository");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_subscriber_segment_1 = require("../subscribers/waba-subscriber-segment");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_master_system_alert_service_1 = require("../push/waba-master-system-alert.service");
const waba_operacional_campaign_notify_service_1 = require("../mail/waba-operacional-campaign-notify.service");
const waba_financeiro_split_repository_1 = require("./waba-financeiro-split.repository");
const waba_supplier_segment_util_1 = require("./waba-supplier-segment.util");
const normalizeEmail = (value) => value.trim().toLowerCase();
const compareSuppliers = (a, b) => {
    if (a.priority !== b.priority)
        return a.priority - b.priority;
    if (a.costPerShipmentCents !== b.costPerShipmentCents) {
        return a.costPerShipmentCents - b.costPerShipmentCents;
    }
    return a.operatorEmail.localeCompare(b.operatorEmail);
};
class WabaCampaignSupplierAssignmentService {
    constructor(splitRepository = new waba_financeiro_split_repository_1.WabaFinanceiroSplitRepository(), intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository(), subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository(), systemUserService = new waba_system_user_service_1.WabaSystemUserService()) {
        this.splitRepository = splitRepository;
        this.intakeRepository = intakeRepository;
        this.subscriberRepository = subscriberRepository;
        this.systemUserService = systemUserService;
    }
    resolveCampaignSegment(intake) {
        const subscriber = this.subscriberRepository.getByEmail(intake.ownerEmail);
        return (0, waba_subscriber_segment_1.parseWabaSubscriberSegment)(subscriber?.segment, { defaultValue: "outros" });
    }
    listEligibleSuppliers(intake, excludedOperatorEmails = []) {
        const apiKind = (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
        const campaignSegment = this.resolveCampaignSegment(intake);
        const excluded = new Set(excludedOperatorEmails.map(normalizeEmail).filter(Boolean));
        const config = this.splitRepository.get();
        return config.suppliers
            .filter((supplier) => supplier.active && supplier.apiKind === apiKind)
            .filter((supplier) => {
            const email = normalizeEmail(supplier.operatorEmail);
            if (!email || excluded.has(email))
                return false;
            const supplierSegment = (0, waba_supplier_segment_util_1.normalizeWabaSupplierSegment)(supplier.segment);
            if (!supplierSegment)
                return false;
            return (0, waba_supplier_segment_util_1.supplierCoversCampaignSegment)(supplierSegment, campaignSegment);
        })
            .slice()
            .sort(compareSuppliers);
    }
    electNextSupplier(intake, excludedOperatorEmails = []) {
        const eligible = this.listEligibleSuppliers(intake, excludedOperatorEmails);
        return eligible[0] ?? null;
    }
    buildAttempts(intake, operatorEmail) {
        const current = Array.isArray(intake.supplierAssignmentAttempts)
            ? intake.supplierAssignmentAttempts.map(normalizeEmail).filter(Boolean)
            : [];
        const next = normalizeEmail(operatorEmail);
        if (!next)
            return current;
        if (current.includes(next))
            return current;
        return [...current, next];
    }
    async assignAndNotify(intakeId, supplier) {
        const intake = this.intakeRepository.getById(intakeId);
        if (!intake)
            throw new Error("Campanha não encontrada.");
        const now = new Date().toISOString();
        const operatorEmail = normalizeEmail(supplier.operatorEmail);
        const attempts = this.buildAttempts(intake, operatorEmail);
        const updated = this.intakeRepository.updateById(intakeId, {
            assignedOperatorEmail: operatorEmail,
            assignedSupplierId: supplier.id,
            supplierAssignedAt: now,
            supplierAssignmentAttempts: attempts,
            supplierExhausted: false,
            updatedAt: now,
        }) ?? intake;
        const notify = await (0, waba_operacional_campaign_notify_service_1.notifyOperacionalStaffOnCampaignCreated)(updated, operatorEmail);
        this.intakeRepository.updateById(intakeId, {
            operacionalNotifyAudit: notify,
            updatedAt: new Date().toISOString(),
        });
        return { intake: updated, notify };
    }
    async electAndAssignInitial(intakeId) {
        const intake = this.intakeRepository.getById(intakeId);
        if (!intake)
            throw new Error("Campanha não encontrada.");
        const supplier = this.electNextSupplier(intake, []);
        if (!supplier) {
            await this.markSupplierExhausted(intakeId);
            return null;
        }
        await this.assignAndNotify(intakeId, supplier);
        return { supplier, operatorEmail: normalizeEmail(supplier.operatorEmail), reassigned: false };
    }
    async reassignAfterFailure(intakeId, reason, reportedByEmail) {
        const intake = this.intakeRepository.getById(intakeId);
        if (!intake)
            throw new Error("Campanha não encontrada.");
        const status = String(intake.status ?? "").trim();
        if (status === "completed" || status === "cancelled" || status === "error_reported") {
            return null;
        }
        const excluded = Array.isArray(intake.supplierAssignmentAttempts)
            ? intake.supplierAssignmentAttempts.map(normalizeEmail).filter(Boolean)
            : [];
        const current = normalizeEmail(intake.assignedOperatorEmail ?? "");
        if (current && !excluded.includes(current))
            excluded.push(current);
        const patch = { updatedAt: new Date().toISOString() };
        if (reason === "bm_inoperante") {
            patch.bmInoperanteAt = new Date().toISOString();
            patch.bmInoperanteByEmail = normalizeEmail(reportedByEmail ?? "");
        }
        this.intakeRepository.updateById(intakeId, patch);
        const nextSupplier = this.electNextSupplier(intake, excluded);
        if (!nextSupplier) {
            await this.markSupplierExhausted(intakeId);
            return null;
        }
        await this.assignAndNotify(intakeId, nextSupplier);
        return {
            supplier: nextSupplier,
            operatorEmail: normalizeEmail(nextSupplier.operatorEmail),
            reassigned: true,
        };
    }
    async markSupplierExhausted(intakeId) {
        const intake = this.intakeRepository.getById(intakeId);
        if (!intake)
            return null;
        if (intake.supplierExhausted && intake.supplierExhaustAlertId)
            return intake;
        const now = new Date().toISOString();
        const lastOperator = normalizeEmail(intake.assignedOperatorEmail ?? "");
        const alertId = (0, waba_master_system_alert_service_1.createMasterInAppAlert)({
            title: "Campanha sem atendimento",
            message: `A campanha "${intake.campaignName}" passou por todos os fornecedores elegíveis sem atendimento.` +
                (lastOperator ? ` Último fornecedor: ${lastOperator}.` : "") +
                " Entre em contato com o fornecedor.",
            createdByEmail: "system@waba.local",
        });
        return this.intakeRepository.updateById(intakeId, {
            supplierExhausted: true,
            supplierExhaustedAt: now,
            supplierExhaustAlertId: alertId,
            updatedAt: now,
        });
    }
    countUnreadExhaustedAlertsForMaster(masterEmail) {
        const email = normalizeEmail(masterEmail);
        if (!email.includes("@"))
            return 0;
        return this.intakeRepository
            .listAll()
            .filter((item) => item.supplierExhausted === true && item.supplierExhaustAlertId)
            .filter((item) => !(0, waba_master_system_alert_service_1.isMasterAlertDismissedByEmail)(String(item.supplierExhaustAlertId), email))
            .length;
    }
}
exports.WabaCampaignSupplierAssignmentService = WabaCampaignSupplierAssignmentService;
