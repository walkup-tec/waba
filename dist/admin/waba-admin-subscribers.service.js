"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminSubscribersService = void 0;
const waba_disparos_credits_service_1 = require("../billing/waba-disparos-credits.service");
const waba_campaign_intake_repository_1 = require("../disparos/waba-campaign-intake.repository");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const normalizeEmail = (value) => value.trim().toLowerCase();
const formatCpfCnpj = (raw) => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (digits.length === 11) {
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (digits.length === 14) {
        return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return digits || "—";
};
const formatCreatedAtLabel = (iso) => {
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
const formatMoneyFromCents = (cents) => {
    const value = Number(cents || 0) / 100;
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
const normalizeIntakeStatus = (status) => String(status || "")
    .trim()
    .toLowerCase();
const isCampaignAwaiting = (intake) => {
    const status = normalizeIntakeStatus(intake.status);
    return status === "generated" || status === "pending_review" || status === "in_progress";
};
const isCampaignCompleted = (intake) => normalizeIntakeStatus(intake.status) === "completed";
class WabaAdminSubscribersService {
    constructor(subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository(), creditsService = new waba_disparos_credits_service_1.WabaDisparosCreditsService(), intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository()) {
        this.subscriberRepository = subscriberRepository;
        this.creditsService = creditsService;
        this.intakeRepository = intakeRepository;
    }
    listSubscribers() {
        const intakesByEmail = new Map();
        for (const intake of this.intakeRepository.listAll()) {
            const email = normalizeEmail(intake.ownerEmail);
            if (!email)
                continue;
            const bucket = intakesByEmail.get(email) ?? [];
            bucket.push(intake);
            intakesByEmail.set(email, bucket);
        }
        return this.subscriberRepository
            .list()
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((subscriber) => {
            const email = normalizeEmail(subscriber.email);
            const credits = this.creditsService.getCreditsSummary(email);
            const intakes = intakesByEmail.get(email) ?? [];
            return {
                id: subscriber.id,
                email,
                fullName: subscriber.fullName,
                cpfCnpj: subscriber.cpfCnpj,
                cpfCnpjFormatted: formatCpfCnpj(subscriber.cpfCnpj),
                createdAt: subscriber.createdAt,
                createdAtLabel: formatCreatedAtLabel(subscriber.createdAt),
                creditsValueCents: credits.contractedValueCents,
                creditsValueLabel: formatMoneyFromCents(credits.contractedValueCents),
                contractedShipments: credits.contractedShipments,
                campaignsAwaiting: intakes.filter(isCampaignAwaiting).length,
                campaignsCompleted: intakes.filter(isCampaignCompleted).length,
            };
        });
    }
}
exports.WabaAdminSubscribersService = WabaAdminSubscribersService;
