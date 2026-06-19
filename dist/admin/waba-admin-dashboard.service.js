"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminDashboardService = void 0;
const asaas_client_1 = require("../billing/asaas.client");
const waba_billing_order_repository_1 = require("../billing/waba-billing-order.repository");
const waba_financeiro_split_service_1 = require("../billing/waba-financeiro-split.service");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_menu_permissions_service_1 = require("../menus/waba-menu-permissions.service");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_admin_financeiro_service_1 = require("./waba-admin-financeiro.service");
const waba_admin_subscribers_service_1 = require("./waba-admin-subscribers.service");
const waba_admin_users_service_1 = require("./waba-admin-users.service");
const waba_operacional_campanhas_service_1 = require("./waba-operacional-campanhas.service");
const TREND_DAYS = 30;
const GROWTH_DAYS = 30;
const RECENT_ACTIVITY_LIMIT = 20;
const normalizeStatusKey = (status) => String(status || "")
    .trim()
    .toLowerCase();
const buildDayKeys = (days) => {
    const keys = [];
    const now = new Date();
    for (let index = days - 1; index >= 0; index -= 1) {
        const date = new Date(now);
        date.setDate(date.getDate() - index);
        keys.push(date.toISOString().slice(0, 10));
    }
    return keys;
};
const resolveEventDayKey = (iso) => {
    const value = String(iso || "").trim();
    if (!value)
        return "";
    return value.slice(0, 10);
};
const buildSubscriberRevenueGrowth = (subscribers, orders) => {
    const dayKeys = buildDayKeys(GROWTH_DAYS);
    const firstDay = dayKeys[0] ?? "";
    const dailyNewSubscribers = new Map(dayKeys.map((day) => [day, 0]));
    for (const subscriber of subscribers) {
        const key = resolveEventDayKey(subscriber.createdAt);
        if (!dailyNewSubscribers.has(key))
            continue;
        dailyNewSubscribers.set(key, (dailyNewSubscribers.get(key) ?? 0) + 1);
    }
    let subscribersBeforePeriod = 0;
    for (const subscriber of subscribers) {
        const key = resolveEventDayKey(subscriber.createdAt);
        if (!key || key >= firstDay)
            continue;
        subscribersBeforePeriod += 1;
    }
    const dailyRevenueCents = new Map(dayKeys.map((day) => [day, 0]));
    let revenueBeforePeriodCents = 0;
    for (const order of orders) {
        if (order.status !== "paid")
            continue;
        const key = resolveEventDayKey(String(order.paidAt || order.updatedAt || order.createdAt || ""));
        if (!key)
            continue;
        const valueCents = Number(order.valueCents || 0);
        if (dailyRevenueCents.has(key)) {
            dailyRevenueCents.set(key, (dailyRevenueCents.get(key) ?? 0) + valueCents);
        }
        else if (key < firstDay) {
            revenueBeforePeriodCents += valueCents;
        }
    }
    let cumulativeSubscribers = subscribersBeforePeriod;
    let cumulativeRevenueCents = revenueBeforePeriodCents;
    const series = dayKeys.map((date) => {
        cumulativeSubscribers += dailyNewSubscribers.get(date) ?? 0;
        cumulativeRevenueCents += dailyRevenueCents.get(date) ?? 0;
        const revenuePerUserCents = cumulativeSubscribers > 0 ? Math.round(cumulativeRevenueCents / cumulativeSubscribers) : 0;
        return {
            date,
            newSubscribers: dailyNewSubscribers.get(date) ?? 0,
            dailyRevenueCents: dailyRevenueCents.get(date) ?? 0,
            cumulativeSubscribers,
            cumulativeRevenueCents,
            revenuePerUserCents,
            subscriberGrowthIndex: 100,
            revenueGrowthIndex: 100,
        };
    });
    const baseSubscribers = series[0]?.cumulativeSubscribers ?? 0;
    const baseRevenueCents = series[0]?.cumulativeRevenueCents ?? 0;
    for (const point of series) {
        point.subscriberGrowthIndex =
            baseSubscribers > 0 ? (point.cumulativeSubscribers / baseSubscribers) * 100 : 100;
        point.revenueGrowthIndex =
            baseRevenueCents > 0 ? (point.cumulativeRevenueCents / baseRevenueCents) * 100 : 100;
    }
    const last = series[series.length - 1];
    const subscribersAtPeriodStart = subscribersBeforePeriod;
    const revenueAtPeriodStartCents = revenueBeforePeriodCents;
    const revenuePerUserAtPeriodStartCents = subscribersAtPeriodStart > 0
        ? Math.round(revenueAtPeriodStartCents / subscribersAtPeriodStart)
        : 0;
    const newSubscribersInPeriod = series.reduce((sum, point) => sum + point.newSubscribers, 0);
    const revenueInPeriodCents = series.reduce((sum, point) => sum + point.dailyRevenueCents, 0);
    const subscriberGrowthPct = subscribersAtPeriodStart > 0
        ? ((last.cumulativeSubscribers - subscribersAtPeriodStart) / subscribersAtPeriodStart) * 100
        : last.cumulativeSubscribers > 0
            ? 100
            : 0;
    const revenueGrowthPct = revenueAtPeriodStartCents > 0
        ? ((last.cumulativeRevenueCents - revenueAtPeriodStartCents) / revenueAtPeriodStartCents) *
            100
        : last.cumulativeRevenueCents > 0
            ? 100
            : 0;
    const revenuePerUserGrowthPct = revenuePerUserAtPeriodStartCents > 0
        ? ((last.revenuePerUserCents - revenuePerUserAtPeriodStartCents) /
            revenuePerUserAtPeriodStartCents) *
            100
        : last.revenuePerUserCents > 0
            ? 100
            : 0;
    const growthRatio = subscriberGrowthPct > 0 ? Math.round((revenueGrowthPct / subscriberGrowthPct) * 100) / 100 : null;
    return {
        periodDays: GROWTH_DAYS,
        summary: {
            subscribersAtPeriodStart,
            revenueAtPeriodStartCents,
            revenuePerUserAtPeriodStartCents,
            currentSubscribers: last?.cumulativeSubscribers ?? 0,
            newSubscribersInPeriod,
            revenueInPeriodCents,
            currentRevenueCents: last?.cumulativeRevenueCents ?? 0,
            revenuePerUserCents: last?.revenuePerUserCents ?? 0,
            subscriberGrowthPct,
            revenueGrowthPct,
            revenuePerUserGrowthPct,
            growthRatio,
        },
        series,
    };
};
const buildTrendSeries = (orders) => {
    const buckets = new Map();
    const dayKeys = buildDayKeys(TREND_DAYS);
    for (const day of dayKeys) {
        buckets.set(day, 0);
    }
    for (const order of orders) {
        if (order.status !== "paid")
            continue;
        const paidAt = String(order.paidAt || order.updatedAt || order.createdAt || "").trim();
        if (!paidAt)
            continue;
        const key = paidAt.slice(0, 10);
        if (!buckets.has(key))
            continue;
        buckets.set(key, (buckets.get(key) ?? 0) + Number(order.valueCents || 0));
    }
    return Array.from(buckets.entries()).map(([date, revenueCents]) => ({
        date,
        revenueCents,
    }));
};
class WabaAdminDashboardService {
    constructor(financeiroService = new waba_admin_financeiro_service_1.WabaAdminFinanceiroService(), subscribersService = new waba_admin_subscribers_service_1.WabaAdminSubscribersService(), usersService = new waba_admin_users_service_1.WabaAdminUsersService(), campanhasService = new waba_operacional_campanhas_service_1.WabaOperacionalCampanhasService(), orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), splitService = new waba_financeiro_split_service_1.WabaFinanceiroSplitService(), systemUserService = new waba_system_user_service_1.WabaSystemUserService()) {
        this.financeiroService = financeiroService;
        this.subscribersService = subscribersService;
        this.usersService = usersService;
        this.campanhasService = campanhasService;
        this.orderRepository = orderRepository;
        this.splitService = splitService;
        this.systemUserService = systemUserService;
    }
    resolveCapabilities(auth) {
        const isMaster = auth.role === "master";
        const user = isMaster ? null : this.systemUserService.getByEmail(auth.email);
        const canCampanhas = isMaster || Boolean(user && (0, waba_menu_permissions_service_1.isMenuAllowedForUser)(user, "admin-campanhas"));
        return {
            finance: isMaster,
            subscribers: isMaster,
            users: isMaster,
            campanhas: canCampanhas,
        };
    }
    buildRecentActivity(orders, subscribers, campaigns, capabilities) {
        const events = [];
        if (capabilities.finance) {
            for (const order of orders.slice(0, 40)) {
                if (order.product !== "waba-disparos")
                    continue;
                events.push({
                    at: String(order.paidAt || order.updatedAt || order.createdAt || ""),
                    type: "order",
                    label: String(order.customerName || order.ownerEmail || "Pedido"),
                    detail: `${Number(order.shipmentCount || 0).toLocaleString("pt-BR")} envios`,
                    apiKind: (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order),
                    amountCents: Number(order.valueCents || 0),
                    status: normalizeStatusKey(order.status),
                });
            }
        }
        if (capabilities.subscribers) {
            for (const subscriber of subscribers.slice(0, 20)) {
                events.push({
                    at: subscriber.createdAt,
                    type: "subscriber",
                    label: subscriber.fullName || subscriber.email,
                    detail: subscriber.email,
                    apiKind: "",
                    amountCents: subscriber.creditsValueCents,
                    status: "active",
                });
            }
        }
        if (capabilities.campanhas) {
            for (const campaign of campaigns.slice(0, 30)) {
                events.push({
                    at: campaign.createdAt,
                    type: "campaign",
                    label: campaign.campaignName,
                    detail: campaign.subscriberEmail,
                    apiKind: campaign.apiKind,
                    amountCents: null,
                    status: normalizeStatusKey(campaign.status),
                });
            }
        }
        return events
            .filter((event) => event.at)
            .sort((left, right) => String(right.at).localeCompare(String(left.at)))
            .slice(0, RECENT_ACTIVITY_LIMIT);
    }
    async getOverview(auth) {
        const capabilities = this.resolveCapabilities(auth);
        const staff = { email: auth.email, role: auth.role };
        const disparosOrders = this.orderRepository
            .list()
            .filter((order) => order.product === "waba-disparos")
            .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
        const subscribers = capabilities.subscribers ? this.subscribersService.listSubscribers() : [];
        const campaigns = capabilities.campanhas
            ? this.campanhasService.listCampaigns(staff)
            : [];
        const users = capabilities.users ? this.usersService.listUsers() : [];
        let financeOverview = null;
        if (capabilities.finance) {
            financeOverview = await this.financeiroService.getOverview();
        }
        const productMetrics = financeOverview?.productMetrics ?? null;
        const oficial = productMetrics?.oficial;
        const alternativa = productMetrics?.alternativa;
        const revenueCents = Number(oficial?.contractedValueCents || 0) + Number(alternativa?.contractedValueCents || 0);
        const costCents = Number(oficial?.totalCostCents || 0) + Number(alternativa?.totalCostCents || 0);
        const profitCents = Number(oficial?.grossProfitCents || 0) + Number(alternativa?.grossProfitCents || 0);
        const marginPct = revenueCents > 0 ? (profitCents / revenueCents) * 100 : 0;
        const settlements = capabilities.finance ? this.splitService.listSettlements(100) : [];
        let splitPayoutPending = 0;
        let splitPayoutFailed = 0;
        for (const settlement of settlements) {
            const status = normalizeStatusKey(settlement.payoutStatus);
            if (status === "pending" || status === "processing")
                splitPayoutPending += 1;
            if (status === "failed" || status === "partial")
                splitPayoutFailed += 1;
        }
        const usersByRole = { master: 0, operacional: 0, suporte: 0, other: 0 };
        for (const user of users) {
            const role = normalizeStatusKey(user.role);
            if (role in usersByRole) {
                usersByRole[role] += 1;
            }
            else {
                usersByRole.other += 1;
            }
        }
        let campaignsOpen = 0;
        let campaignsOverdue = 0;
        let campaignsCompleted = 0;
        let plannedSendCount = 0;
        const campaignsByApi = { oficial: 0, alternativa: 0 };
        for (const campaign of campaigns) {
            const status = normalizeStatusKey(campaign.status);
            if (status === "completed")
                campaignsCompleted += 1;
            else
                campaignsOpen += 1;
            if (campaign.isStartOverdue)
                campaignsOverdue += 1;
            plannedSendCount += Number(campaign.plannedSendCount || 0);
            if (campaign.apiKind === "oficial")
                campaignsByApi.oficial += 1;
            if (campaign.apiKind === "alternativa")
                campaignsByApi.alternativa += 1;
        }
        const subscriberTotals = subscribers.reduce((accumulator, subscriber) => {
            accumulator.creditsValueCents += Number(subscriber.creditsValueCents || 0);
            accumulator.contractedShipments += Number(subscriber.contractedShipments || 0);
            accumulator.campaignsAwaiting += Number(subscriber.campaignsAwaiting || 0);
            accumulator.campaignsCompleted += Number(subscriber.campaignsCompleted || 0);
            return accumulator;
        }, {
            creditsValueCents: 0,
            contractedShipments: 0,
            campaignsAwaiting: 0,
            campaignsCompleted: 0,
        });
        return {
            generatedAt: new Date().toISOString(),
            capabilities,
            primary: capabilities.finance
                ? {
                    revenueCents,
                    costCents,
                    profitCents,
                    marginPct,
                    paidOrderCount: financeOverview?.summary?.paidCount ?? 0,
                    pendingOrderCount: financeOverview?.summary?.pendingCount ?? 0,
                    pendingValueCents: financeOverview?.summary?.pendingValueCents ?? 0,
                    paidValueCents: financeOverview?.summary?.paidValueCents ?? 0,
                    splitPayoutPending,
                    splitPayoutFailed,
                }
                : null,
            operational: {
                subscriberCount: subscribers.length,
                staffUserCount: users.length,
                usersByRole,
                campaignsOpen,
                campaignsCompleted,
                campaignsOverdue,
                plannedSendCount,
                campaignsByApi,
                contractedShipments: subscriberTotals.contractedShipments,
                creditsValueCents: subscriberTotals.creditsValueCents,
                campaignsAwaiting: subscriberTotals.campaignsAwaiting,
            },
            productMetrics,
            integration: capabilities.finance
                ? {
                    paymentConfigured: financeOverview?.config?.paymentConfigured ?? (0, asaas_client_1.isAsaasConfigured)(),
                    splitPayoutEnabled: financeOverview?.splitPayoutEnabled === true,
                    transferProbeOk: financeOverview?.splitTransferProbe?.ok !== false,
                }
                : null,
            trend: capabilities.finance ? buildTrendSeries(disparosOrders) : [],
            growthAnalysis: capabilities.finance && capabilities.subscribers
                ? buildSubscriberRevenueGrowth(subscribers, disparosOrders)
                : null,
            recentActivity: this.buildRecentActivity(disparosOrders, subscribers, campaigns, capabilities),
        };
    }
}
exports.WabaAdminDashboardService = WabaAdminDashboardService;
