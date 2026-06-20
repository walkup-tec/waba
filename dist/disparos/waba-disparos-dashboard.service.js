"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterIntakesBySubscriberEmails = exports.buildMasterSubscribersDisparosDashboardOverview = exports.buildDisparosDashboardOverview = exports.buildCompareSubscribersFromIntakes = exports.buildCampaignComparisonFromIntakes = void 0;
const waba_dispatches_api_kind_1 = require("./waba-dispatches-api-kind");
const waba_campaign_intake_status_1 = require("./waba-campaign-intake-status");
const normalizeStoredStatus = (status) => (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(status);
const roundMetric = (value) => {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0)
        return 0;
    return parsed;
};
const roundRate = (value) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
const computeRatesFromReport = (report) => {
    const totalLeads = roundMetric(report.totalLeads);
    const enviados = roundMetric(report.sent);
    const entregues = roundMetric(report.delivered);
    const lidos = roundMetric(report.read);
    const falhados = roundMetric(report.failed);
    return {
        totalLeads,
        enviados,
        entregues,
        lidos,
        falhados,
        deliveryRate: roundRate(enviados > 0 ? (entregues / enviados) * 100 : 0),
        readRate: roundRate(entregues > 0 ? (lidos / entregues) * 100 : 0),
        failureRate: roundRate(totalLeads > 0 ? (falhados / totalLeads) * 100 : 0),
    };
};
const buildCampaignComparisonFromIntakes = (intakes, options) => {
    return intakes
        .filter((intake) => {
        const status = normalizeStoredStatus(intake.status);
        return status === "completed" && Boolean(intake.performanceReport);
    })
        .map((intake) => {
        const report = intake.performanceReport;
        const apiKind = (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
        const rates = computeRatesFromReport(report);
        return {
            id: intake.id,
            campaignName: intake.campaignName,
            apiKind,
            planTypeLabel: waba_dispatches_api_kind_1.WABA_DISPATCHES_API_LABELS[apiKind],
            completedAt: intake.updatedAt,
            ...(options?.includeOwnerEmail ? { ownerEmail: intake.ownerEmail } : {}),
            ...rates,
        };
    })
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
};
exports.buildCampaignComparisonFromIntakes = buildCampaignComparisonFromIntakes;
const buildCompareSubscribersFromIntakes = (intakes, subscribers) => {
    const comparison = (0, exports.buildCampaignComparisonFromIntakes)(intakes, { includeOwnerEmail: true });
    const emailsWithCampaigns = new Set();
    for (const item of comparison) {
        const email = String(item.ownerEmail || "").trim().toLowerCase();
        if (email)
            emailsWithCampaigns.add(email);
    }
    const nameByEmail = new Map(subscribers.map((subscriber) => [
        subscriber.email.trim().toLowerCase(),
        subscriber.fullName.trim() || subscriber.email,
    ]));
    return [...emailsWithCampaigns]
        .map((email) => ({
        email,
        fullName: nameByEmail.get(email) || email,
    }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR", { sensitivity: "base" }));
};
exports.buildCompareSubscribersFromIntakes = buildCompareSubscribersFromIntakes;
const listAvailableApiKinds = (items) => {
    const kinds = new Set();
    for (const item of items) {
        kinds.add(item.apiKind);
    }
    const ordered = [];
    if (kinds.has("oficial"))
        ordered.push("oficial");
    if (kinds.has("alternativa"))
        ordered.push("alternativa");
    return ordered;
};
const aggregateDisparosDashboardFromIntakes = (intakes, comparisonOptions) => {
    let completed = 0;
    let inProgress = 0;
    let awaiting = 0;
    let withReport = 0;
    const indicators = {
        totalLeads: 0,
        enviados: 0,
        entregues: 0,
        lidos: 0,
        falhados: 0,
    };
    for (const intake of intakes) {
        const status = normalizeStoredStatus(intake.status);
        if (status === "completed" || status === "error_reported")
            completed += 1;
        else if (status === "in_progress")
            inProgress += 1;
        else if (status === "generated")
            awaiting += 1;
        if (status !== "completed" || !intake.performanceReport)
            continue;
        withReport += 1;
        const report = intake.performanceReport;
        indicators.totalLeads += roundMetric(report.totalLeads);
        indicators.enviados += roundMetric(report.sent);
        indicators.entregues += roundMetric(report.delivered);
        indicators.lidos += roundMetric(report.read);
        indicators.falhados += roundMetric(report.failed);
    }
    const campaignComparison = (0, exports.buildCampaignComparisonFromIntakes)(intakes, comparisonOptions);
    const hasPartialReports = completed > withReport;
    const allCampaignsFinalized = intakes.length > 0 && inProgress === 0 && awaiting === 0;
    return {
        campaigns: {
            total: intakes.length,
            completed,
            inProgress,
            awaiting,
            withReport,
        },
        indicators,
        campaignComparison,
        availableApiKinds: listAvailableApiKinds(campaignComparison),
        hasPartialReports,
        allCampaignsFinalized,
    };
};
const buildOwnerDashboardMessage = (aggregated) => {
    const { campaigns } = aggregated;
    const withReport = campaigns.withReport;
    if (campaigns.total === 0) {
        return "Você ainda não possui campanhas. Crie a primeira em Campanhas.";
    }
    if (withReport === 0) {
        return "Os indicadores consolidados aparecem quando suas campanhas forem finalizadas e o relatório estiver disponível.";
    }
    if (aggregated.hasPartialReports) {
        return `Consolidado de ${withReport} campanha(s) com relatório. ${campaigns.completed - withReport} finalizada(s) aguardam consolidação.`;
    }
    return `Consolidado de ${withReport} campanha(s) finalizada(s).`;
};
const buildMasterSubscribersDashboardMessage = (subscriberCount, aggregated) => {
    const { campaigns } = aggregated;
    const subscriberLabel = subscriberCount === 1 ? "1 assinante" : `${subscriberCount} assinantes`;
    if (subscriberCount === 0) {
        return "Nenhum assinante cadastrado no momento.";
    }
    if (campaigns.total === 0) {
        return `Visão global dos assinantes (${subscriberLabel}). Ainda não há campanhas registradas.`;
    }
    if (campaigns.withReport === 0) {
        return `Visão global dos assinantes (${subscriberLabel}). Os indicadores aparecem quando as campanhas forem finalizadas e consolidadas.`;
    }
    if (aggregated.hasPartialReports) {
        return `Consolidado de ${campaigns.withReport} campanha(s) com relatório entre ${subscriberLabel}. ${campaigns.completed - campaigns.withReport} finalizada(s) aguardam consolidação.`;
    }
    return `Consolidado de ${campaigns.withReport} campanha(s) finalizada(s) entre ${subscriberLabel}.`;
};
const buildDisparosDashboardOverview = (ownerEmail, intakes) => {
    const normalizedOwner = ownerEmail.trim().toLowerCase();
    const ownedIntakes = intakes.filter((item) => item.ownerEmail.trim().toLowerCase() === normalizedOwner);
    const aggregated = aggregateDisparosDashboardFromIntakes(ownedIntakes);
    return {
        scope: "owner",
        ownerEmail: normalizedOwner,
        compareSubscribers: [],
        ...aggregated,
        message: buildOwnerDashboardMessage(aggregated),
    };
};
exports.buildDisparosDashboardOverview = buildDisparosDashboardOverview;
const buildMasterSubscribersDisparosDashboardOverview = (masterEmail, intakes, subscribers) => {
    const subscriberEmailSet = new Set(subscribers.map((subscriber) => subscriber.email.trim().toLowerCase()).filter(Boolean));
    const subscriberIntakes = intakes.filter((item) => subscriberEmailSet.has(item.ownerEmail.trim().toLowerCase()));
    const aggregated = aggregateDisparosDashboardFromIntakes(subscriberIntakes, {
        includeOwnerEmail: true,
    });
    const compareSubscribers = (0, exports.buildCompareSubscribersFromIntakes)(subscriberIntakes, subscribers);
    return {
        scope: "master_subscribers",
        ownerEmail: masterEmail.trim().toLowerCase(),
        subscriberCount: subscriberEmailSet.size,
        compareSubscribers,
        ...aggregated,
        message: buildMasterSubscribersDashboardMessage(subscriberEmailSet.size, aggregated),
    };
};
exports.buildMasterSubscribersDisparosDashboardOverview = buildMasterSubscribersDisparosDashboardOverview;
const filterIntakesBySubscriberEmails = (intakes, subscriberEmails) => {
    const subscriberEmailSet = new Set(subscriberEmails.map((email) => email.trim().toLowerCase()).filter(Boolean));
    return intakes.filter((item) => subscriberEmailSet.has(item.ownerEmail.trim().toLowerCase()));
};
exports.filterIntakesBySubscriberEmails = filterIntakesBySubscriberEmails;
