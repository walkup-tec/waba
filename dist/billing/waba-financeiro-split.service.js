"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaFinanceiroSplitService = void 0;
const node_crypto_1 = require("node:crypto");
const waba_master_disparos_policy_service_1 = require("../users/waba-master-disparos-policy.service");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_campaign_intake_repository_1 = require("../disparos/waba-campaign-intake.repository");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_disparos_order_shipments_1 = require("./waba-disparos-order-shipments");
const waba_financeiro_split_repository_1 = require("./waba-financeiro-split.repository");
const waba_financeiro_split_settlement_repository_1 = require("./waba-financeiro-split-settlement.repository");
const waba_financeiro_split_payout_service_1 = require("./waba-financeiro-split-payout.service");
const waba_financeiro_cet_1 = require("./waba-financeiro-cet");
const waba_metrics_excluded_owners_1 = require("./waba-metrics-excluded-owners");
const waba_campaign_credit_funding_1 = require("./waba-campaign-credit-funding");
const PERCENT_SUM_TOLERANCE = 0.01;
const roundPercent = (value) => Math.round(value * 100) / 100;
const buildSplitCostBreakdown = (paidValueCents, purchasedShipmentCount, costPerShipmentCents) => {
    const supplierCostCents = Math.max(0, Math.round(purchasedShipmentCount * Math.max(0, costPerShipmentCents)));
    const cetCents = (0, waba_financeiro_cet_1.resolveFinanceiroCetCentsForPaidOrder)();
    const totalCostCents = supplierCostCents + cetCents;
    const distributableCents = Math.max(0, paidValueCents - totalCostCents);
    return { supplierCostCents, cetCents, totalCostCents, distributableCents };
};
const resolveSettlementCostBreakdown = (settlement) => {
    const cetCents = settlement.cetCents ??
        settlement.cofCents ??
        (settlement.lines.some((line) => line.lineKind === "cet")
            ? (0, waba_financeiro_cet_1.resolveFinanceiroCetCentsForPaidOrder)()
            : 0);
    const supplierLine = settlement.lines.find((line) => line.lineKind === "supplier");
    const supplierCostCents = settlement.supplierCostCents ??
        supplierLine?.amountCents ??
        Math.max(0, settlement.totalCostCents - cetCents);
    const usesNewModel = settlement.supplierCostCents != null ||
        settlement.cetCents != null ||
        settlement.cofCents != null ||
        settlement.lines.some((line) => line.lineKind === "cet");
    const totalCostCents = usesNewModel
        ? supplierCostCents + cetCents
        : settlement.totalCostCents;
    const distributableCents = usesNewModel
        ? Math.max(0, settlement.paidValueCents - totalCostCents)
        : settlement.distributableCents;
    let compositionSupplier = Math.max(0, supplierCostCents);
    let compositionCet = Math.max(0, usesNewModel ? cetCents : 0);
    if (!usesNewModel && totalCostCents > 0) {
        compositionSupplier = supplierLine?.amountCents ?? totalCostCents;
        compositionCet = 0;
    }
    if (compositionSupplier + compositionCet <= 0 && totalCostCents > 0) {
        compositionSupplier = totalCostCents;
    }
    return {
        supplierCostCents: compositionSupplier,
        cetCents: compositionCet,
        totalCostCents,
        distributableCents,
    };
};
const distributeCentsByPercents = (totalCents, percents) => {
    if (totalCents <= 0 || !percents.length)
        return percents.map(() => 0);
    const raw = percents.map((percent) => (totalCents * percent) / 100);
    const floors = raw.map((value) => Math.floor(value));
    let remainder = totalCents - floors.reduce((sum, value) => sum + value, 0);
    const ranked = raw
        .map((value, index) => ({ index, fraction: value - floors[index] }))
        .sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < remainder; i += 1) {
        floors[ranked[i % ranked.length].index] += 1;
    }
    return floors;
};
const normalizeParticipant = (input) => ({
    id: String(input.id ?? (0, node_crypto_1.randomUUID)()).trim() || (0, node_crypto_1.randomUUID)(),
    label: String(input.label ?? "").trim(),
    email: String(input.email ?? "").trim().toLowerCase(),
    pixKey: String(input.pixKey ?? "").trim(),
    sharePercent: roundPercent(Math.max(0, Math.min(100, Number(input.sharePercent ?? 0)))),
    active: input.active !== false,
});
const normalizeSupplier = (input) => {
    const apiKind = input.apiKind === "alternativa" ? "alternativa" : "oficial";
    const segment = input.segment === "bets" ? "bets" : "outros";
    const priorityRaw = Math.round(Number(input.priority ?? 1));
    const priority = Math.max(1, Math.min(5, Number.isFinite(priorityRaw) ? priorityRaw : 1));
    return {
        id: String(input.id ?? (0, node_crypto_1.randomUUID)()).trim() || (0, node_crypto_1.randomUUID)(),
        name: String(input.name ?? "").trim(),
        apiKind,
        systemUserEmail: String(input.systemUserEmail ?? "").trim().toLowerCase(),
        segment,
        priority,
        costPerShipmentCents: Math.max(0, Math.round(Number(input.costPerShipmentCents ?? 0))),
        pixKey: String(input.pixKey ?? "").trim(),
        active: input.active !== false,
    };
};
class WabaFinanceiroSplitService {
    constructor(configRepository = new waba_financeiro_split_repository_1.WabaFinanceiroSplitRepository(), settlementRepository = new waba_financeiro_split_settlement_repository_1.WabaFinanceiroSplitSettlementRepository(), payoutService = new waba_financeiro_split_payout_service_1.WabaFinanceiroSplitPayoutService(), orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), masterPolicyService = new waba_master_disparos_policy_service_1.WabaMasterDisparosPolicyService()) {
        this.configRepository = configRepository;
        this.settlementRepository = settlementRepository;
        this.payoutService = payoutService;
        this.orderRepository = orderRepository;
        this.masterPolicyService = masterPolicyService;
    }
    getConfig() {
        return this.configRepository.get();
    }
    isPayoutEnabled() {
        return this.payoutService.isPayoutEnabled();
    }
    listSettlements(limit = 100) {
        this.absorbSyntheticCampaignSupplierSettlements();
        return (0, waba_metrics_excluded_owners_1.filterOutMetricsExcludedOwners)(this.settlementRepository.list(limit));
    }
    /** Remove settlements já gravados de owners excluídos das métricas/split. */
    purgeExcludedOwnerSettlements() {
        return this.settlementRepository.deleteByOwnerEmails([...waba_metrics_excluded_owners_1.WABA_METRICS_EXCLUDED_OWNER_EMAILS]);
    }
    /**
     * Remove settlements de campanhas 100% bônus e de pedidos grant admin-bonus-envios.
     */
    purgeBonusOnlyCampaignSettlements() {
        const intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
        const backfill = intakeRepository.backfillBonusFundingForOpenCampaigns();
        if (backfill.updated > 0) {
            console.info(`[FinanceiroSplit] backfill creditFunding bônus em ${backfill.updated} campanha(s) em fila`);
        }
        const intakes = intakeRepository.listAll();
        const orderIds = [];
        for (const intake of intakes) {
            if (!(0, waba_campaign_credit_funding_1.isBonusOnlyCampaignFunding)(intake.creditFunding))
                continue;
            orderIds.push(this.buildCampaignSupplierOrderId(intake.id));
        }
        for (const order of this.orderRepository.list()) {
            if (order.grantSource === "admin-bonus-envios") {
                orderIds.push(order.id);
            }
        }
        return this.settlementRepository.deleteByOrderIds(orderIds);
    }
    async syncSettlementTransferStatuses(limit = 100) {
        return this.payoutService.syncProcessingTransfers(limit);
    }
    getSettlementByOrderId(orderId) {
        return this.settlementRepository.getByOrderId(orderId);
    }
    resolveActiveSupplier(config, apiKind, segment = "outros") {
        return this.listActiveSuppliersForPlanSegmentFromConfig(config, apiKind, segment)[0] ?? null;
    }
    listActiveSuppliersForPlanSegment(apiKind, segment) {
        const config = this.configRepository.get();
        return this.listActiveSuppliersForPlanSegmentFromConfig(config, apiKind, segment);
    }
    listActiveSuppliersForPlanSegmentFromConfig(config, apiKind, segment) {
        return config.suppliers
            .filter((item) => item.active && item.apiKind === apiKind && item.segment === segment)
            .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "pt-BR"));
    }
    shouldDeferSupplierPayout(supplier) {
        return Boolean(supplier?.systemUserEmail);
    }
    resolveSubscriberSegmentForEmail(email) {
        const subscriber = new waba_subscriber_repository_1.WabaSubscriberRepository().getByEmail(email);
        return subscriber?.segment === "bets" ? "bets" : "outros";
    }
    validateConfig(input) {
        const suppliers = (Array.isArray(input.suppliers) ? input.suppliers : []).map(normalizeSupplier);
        const participants = (Array.isArray(input.participants) ? input.participants : []).map(normalizeParticipant);
        const activeSuppliers = suppliers.filter((item) => item.active);
        const priorityKeys = new Set();
        const operacionalEmails = new Set();
        for (const supplier of activeSuppliers) {
            if (!supplier.name) {
                throw new Error("Cada fornecedor ativo precisa de um nome.");
            }
            if (!supplier.systemUserEmail) {
                throw new Error(`Selecione o usuário operacional do fornecedor ${supplier.name || "sem nome"}.`);
            }
            if (!supplier.pixKey || supplier.pixKey.length < 5) {
                throw new Error(`Informe a chave PIX do fornecedor ${supplier.name || "sem nome"}.`);
            }
            const groupKey = `${supplier.apiKind}:${supplier.segment}`;
            const priorityKey = `${groupKey}:${supplier.priority}`;
            if (priorityKeys.has(priorityKey)) {
                throw new Error(`Já existe fornecedor ativo com prioridade ${supplier.priority} para ${supplier.apiKind === "oficial" ? "API Oficial" : "API Alternativa"} / ${supplier.segment === "bets" ? "Bets" : "Outros"}.`);
            }
            priorityKeys.add(priorityKey);
            const operacionalKey = `${supplier.systemUserEmail}:${supplier.apiKind}:${supplier.segment}`;
            if (operacionalEmails.has(operacionalKey)) {
                throw new Error("Cada usuário operacional só pode ser fornecedor uma vez por plano + segmento (ex.: Oficial/Bets).");
            }
            operacionalEmails.add(operacionalKey);
        }
        const activeParticipants = participants.filter((item) => item.active);
        for (const participant of activeParticipants) {
            if (!participant.label) {
                throw new Error("Cada participante ativo precisa de um usuário master selecionado.");
            }
            if (!participant.email) {
                throw new Error(`Selecione o usuário master de ${participant.label || "participante"}.`);
            }
            if (!participant.pixKey || participant.pixKey.length < 5) {
                throw new Error(`Informe a chave PIX de ${participant.label || "participante"}.`);
            }
            if (participant.sharePercent <= 0) {
                throw new Error(`Percentual de ${participant.label} deve ser maior que zero.`);
            }
        }
        if (activeParticipants.length) {
            const emails = new Set();
            for (const participant of activeParticipants) {
                if (emails.has(participant.email)) {
                    throw new Error("Cada usuário master só pode aparecer uma vez no rateio do lucro.");
                }
                emails.add(participant.email);
            }
        }
        return {
            version: 2,
            suppliers,
            participants,
            updatedAt: new Date().toISOString(),
        };
    }
    saveConfig(input) {
        const validated = this.validateConfig(input);
        return this.configRepository.save(validated);
    }
    resolvePurchasedShipmentCount(order) {
        const bonus = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
        const total = (0, waba_disparos_order_shipments_1.resolveOrderShipmentCount)(order);
        if (bonus > 0 && total > bonus)
            return total - bonus;
        return total;
    }
    resolveOrderEconomics(order) {
        if (order.product !== "waba-disparos" || order.status !== "paid")
            return null;
        if ((0, waba_metrics_excluded_owners_1.isWabaMetricsExcludedOwnerEmail)(order.ownerEmail))
            return null;
        const settlement = this.settlementRepository.getByOrderId(order.id);
        if (settlement) {
            if ((0, waba_metrics_excluded_owners_1.isWabaMetricsExcludedOwnerEmail)(settlement.ownerEmail))
                return null;
            const breakdown = resolveSettlementCostBreakdown(settlement);
            return {
                apiKind: settlement.apiKind,
                contractedValueCents: settlement.paidValueCents,
                supplierCostCents: breakdown.supplierCostCents,
                totalCostCents: breakdown.totalCostCents,
                grossProfitCents: breakdown.distributableCents,
                cetCents: breakdown.cetCents,
                distributableCents: breakdown.distributableCents,
                purchasedShipmentCount: settlement.purchasedShipmentCount,
            };
        }
        const config = this.configRepository.get();
        const apiKind = (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order);
        const segment = this.resolveSubscriberSegmentForEmail(order.ownerEmail);
        const supplier = this.resolveActiveSupplier(config, apiKind, segment);
        const purchasedShipmentCount = this.resolvePurchasedShipmentCount(order);
        const costPerShipmentCents = supplier?.costPerShipmentCents ?? 0;
        const contractedValueCents = Math.max(0, Math.round(Number(order.valueCents ?? 0)));
        const breakdown = buildSplitCostBreakdown(contractedValueCents, purchasedShipmentCount, costPerShipmentCents);
        return {
            apiKind,
            contractedValueCents,
            supplierCostCents: breakdown.supplierCostCents,
            totalCostCents: breakdown.totalCostCents,
            grossProfitCents: breakdown.distributableCents,
            cetCents: breakdown.cetCents,
            distributableCents: breakdown.distributableCents,
            purchasedShipmentCount,
        };
    }
    getCetCentsPerOperation() {
        return (0, waba_financeiro_cet_1.resolveFinanceiroCetCentsPerOperation)();
    }
    logSettlementSkip(order, reason) {
        console.warn(`[FinanceiroSplit] pedido ${order.id} (${order.ownerEmail}) sem settlement: ${reason}`);
    }
    settlePaidOrder(order) {
        if (order.product !== "waba-disparos" || order.status !== "paid")
            return null;
        if (order.grantSource === "admin-bonus-envios") {
            this.logSettlementSkip(order, "bônus de envio (sem receita do cliente)");
            return null;
        }
        if ((0, waba_metrics_excluded_owners_1.isWabaMetricsExcludedOwnerEmail)(order.ownerEmail)) {
            this.logSettlementSkip(order, "owner excluído de métricas/split");
            return null;
        }
        const existing = this.settlementRepository.getByOrderId(order.id);
        if (existing) {
            if ((0, waba_metrics_excluded_owners_1.isWabaMetricsExcludedOwnerEmail)(existing.ownerEmail))
                return null;
            return existing;
        }
        const config = this.configRepository.get();
        const apiKind = (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order);
        const masterPolicy = this.masterPolicyService.resolveForEmail(order.ownerEmail);
        const paySuppliers = !masterPolicy || masterPolicy.splitSuppliers;
        const payProfits = !masterPolicy || masterPolicy.splitProfits;
        const segment = this.resolveSubscriberSegmentForEmail(order.ownerEmail);
        const supplier = this.resolveActiveSupplier(config, apiKind, segment);
        if (paySuppliers && !supplier?.pixKey) {
            this.logSettlementSkip(order, `fornecedor ativo sem PIX para plano ${apiKind}`);
            return null;
        }
        const activeParticipants = config.participants.filter((item) => item.active);
        const purchasedShipmentCount = this.resolvePurchasedShipmentCount(order);
        const costPerShipmentCents = Math.max(0, Math.round(Number((paySuppliers ? supplier?.costPerShipmentCents : 0) ?? 0)));
        const paidValueCents = Math.max(0, Math.round(Number(order.valueCents ?? 0)));
        const breakdown = buildSplitCostBreakdown(paidValueCents, purchasedShipmentCount, costPerShipmentCents);
        const { supplierCostCents, cetCents, totalCostCents, distributableCents } = breakdown;
        const effectiveSupplierCostCents = paySuppliers ? supplierCostCents : 0;
        if (distributableCents > 0 && payProfits) {
            if (!activeParticipants.length) {
                this.logSettlementSkip(order, "lucro distribuível sem participantes ativos");
                return null;
            }
            const percentSum = activeParticipants.reduce((sum, item) => sum + item.sharePercent, 0);
            if (Math.abs(percentSum - 100) > PERCENT_SUM_TOLERANCE) {
                this.logSettlementSkip(order, `soma de percentuais inválida (${percentSum.toFixed(2)}%)`);
                return null;
            }
        }
        const lines = [];
        if (cetCents > 0) {
            lines.push({
                lineKind: "cet",
                participantId: "asaas-cet",
                participantLabel: "CET Asaas",
                participantEmail: "",
                pixKey: "",
                sharePercent: 0,
                amountCents: cetCents,
                payoutStatus: "skipped",
            });
        }
        if (supplier) {
            const deferSupplierPayout = this.shouldDeferSupplierPayout(supplier);
            lines.push({
                lineKind: "supplier",
                participantId: supplier.id,
                participantLabel: supplier.name,
                participantEmail: supplier.systemUserEmail || "",
                pixKey: paySuppliers && !deferSupplierPayout ? supplier.pixKey : "",
                sharePercent: 0,
                amountCents: effectiveSupplierCostCents,
                shipmentCount: purchasedShipmentCount,
                costPerShipmentCents: paySuppliers ? costPerShipmentCents : 0,
                payoutStatus: paySuppliers && effectiveSupplierCostCents > 0 && !deferSupplierPayout
                    ? "pending"
                    : "skipped",
            });
        }
        if (distributableCents > 0 && payProfits && activeParticipants.length) {
            const percents = activeParticipants.map((item) => item.sharePercent);
            const amounts = distributeCentsByPercents(distributableCents, percents);
            for (const [index, participant] of activeParticipants.entries()) {
                const amountCents = amounts[index] ?? 0;
                lines.push({
                    lineKind: "partner",
                    participantId: participant.id,
                    participantLabel: participant.label,
                    participantEmail: participant.email,
                    pixKey: participant.pixKey,
                    sharePercent: participant.sharePercent,
                    amountCents,
                    payoutStatus: amountCents > 0 ? "pending" : "skipped",
                });
            }
        }
        return this.settlementRepository.create({
            orderId: order.id,
            apiKind,
            ownerEmail: order.ownerEmail,
            customerName: order.customerName,
            paidValueCents,
            purchasedShipmentCount,
            costPerShipmentCents,
            supplierCostCents: effectiveSupplierCostCents,
            totalCostCents,
            grossProfitCents: distributableCents,
            cetCents,
            distributableCents,
            supplierId: supplier?.id ?? "",
            supplierName: supplier?.name ?? "",
            lines,
            payoutStatus: (0, waba_financeiro_split_settlement_repository_1.deriveSettlementPayoutStatus)(lines),
        });
    }
    async settleAndPayoutPaidOrder(order) {
        const settlement = this.settlePaidOrder(order);
        if (!settlement)
            return null;
        if (!this.payoutService.isPayoutEnabled())
            return settlement;
        try {
            return await this.payoutService.executeForSettlement(settlement);
        }
        catch (error) {
            console.error(`[FinanceiroSplit] falha no repasse PIX do pedido ${order.id}:`, error instanceof Error ? error.message : error);
            return settlement;
        }
    }
    async retryPayoutForOrder(orderId) {
        return this.payoutService.executeForOrderId(orderId);
    }
    async retryPayoutLineForOrder(orderId, participantId) {
        return this.payoutService.retryLineForOrder(orderId, participantId);
    }
    async getSplitLineReceiptUrl(orderId, participantId) {
        return this.payoutService.resolveLineReceiptUrl(orderId, participantId);
    }
    async processPendingPayouts(limit = 50) {
        this.absorbSyntheticCampaignSupplierSettlements();
        return this.payoutService.executePendingSettlements(limit);
    }
    async backfillUnsettledPaidOrders(limit = 200) {
        const cap = Math.max(1, Math.min(500, Math.floor(limit)));
        const paidOrders = this.orderRepository
            .list()
            .filter((order) => order.product === "waba-disparos" && order.status === "paid")
            .sort((a, b) => new Date(a.paidAt || a.updatedAt).getTime() -
            new Date(b.paidAt || b.updatedAt).getTime());
        let scanned = 0;
        let settled = 0;
        let payoutsTriggered = 0;
        for (const order of paidOrders) {
            if (scanned >= cap)
                break;
            if (this.settlementRepository.getByOrderId(order.id))
                continue;
            scanned += 1;
            const result = await this.settleAndPayoutPaidOrder(order);
            if (result) {
                settled += 1;
                if (result.payoutStatus !== "pending")
                    payoutsTriggered += 1;
            }
        }
        return { scanned, settled, payoutsTriggered, payoutEnabled: this.isPayoutEnabled() };
    }
    getSupplierById(supplierId) {
        const normalized = String(supplierId || "").trim();
        if (!normalized)
            return null;
        return this.configRepository.get().suppliers.find((item) => item.id === normalized) ?? null;
    }
    /**
     * Fornecedor eleito para repasse PIX da campanha — usa operacional atribuído
     * (e-mail + plano + segmento) para refletir transferências entre operacionais.
     */
    resolveSupplierForCampaignIntake(intake) {
        const assignedEmail = String(intake.assignedOperacionalEmail || "")
            .trim()
            .toLowerCase();
        const assignedId = String(intake.assignedSupplierId || "").trim();
        if (!assignedEmail && !assignedId)
            return null;
        const apiKind = (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
        const subscriberSegment = this.resolveSubscriberSegmentForEmail(intake.ownerEmail);
        const supplierSegment = subscriberSegment === "bets" ? "bets" : "outros";
        const suppliers = this.configRepository.get().suppliers;
        if (assignedEmail) {
            const byEmail = suppliers.find((row) => row.active &&
                row.systemUserEmail.toLowerCase() === assignedEmail &&
                row.apiKind === apiKind &&
                row.segment === supplierSegment) ??
                suppliers.find((row) => row.active &&
                    row.systemUserEmail.toLowerCase() === assignedEmail &&
                    row.apiKind === apiKind) ??
                null;
            if (byEmail)
                return byEmail;
        }
        if (assignedId) {
            return this.getSupplierById(assignedId);
        }
        return null;
    }
    applyElectedSupplierToSettlement(settlement, supplier) {
        const supplierLineIndex = settlement.lines.findIndex((line) => line.lineKind === "supplier");
        if (supplierLineIndex < 0)
            return null;
        const line = settlement.lines[supplierLineIndex];
        if (line.payoutStatus === "paid" || line.payoutStatus === "processing") {
            return settlement;
        }
        const participantEmail = supplier.systemUserEmail || "";
        const pixKey = supplier.pixKey || line.pixKey || "";
        const needsUpdate = line.participantId !== supplier.id ||
            line.pixKey !== pixKey ||
            line.participantEmail !== participantEmail ||
            line.participantLabel !== supplier.name ||
            settlement.supplierId !== supplier.id;
        if (!needsUpdate)
            return settlement;
        const operatorChanged = line.participantId !== supplier.id;
        const updatedLines = [...settlement.lines];
        updatedLines[supplierLineIndex] = {
            ...line,
            participantId: supplier.id,
            participantLabel: supplier.name,
            participantEmail,
            pixKey,
            payoutStatus: line.payoutStatus === "failed" ? "pending" : line.payoutStatus,
            ...(operatorChanged
                ? {
                    asaasTransferId: undefined,
                    payoutExternalReference: undefined,
                    transactionReceiptUrl: undefined,
                    paidAt: undefined,
                    failureReason: undefined,
                }
                : {}),
        };
        return this.settlementRepository.save({
            ...settlement,
            supplierId: supplier.id,
            supplierName: supplier.name,
            lines: updatedLines,
            payoutStatus: (0, waba_financeiro_split_settlement_repository_1.deriveSettlementPayoutStatus)(updatedLines),
        });
    }
    /**
     * Atualiza settlement pendente da campanha quando o operacional muda
     * (participantId, e-mail e chave PIX do fornecedor eleito).
     * Também atualiza o split do pedido pago (linha fornecedor adiada) para
     * refletir o operador da campanha vigente — cancelar e gerar outra não
     * pode deixar o Financeiro no operador antigo.
     */
    syncCampaignSupplierSettlementForIntake(intake, existing) {
        const supplier = this.resolveSupplierForCampaignIntake(intake);
        if (!supplier?.pixKey)
            return null;
        const campaignOrderId = this.buildCampaignSupplierOrderId(intake.id);
        const campaignSettlement = existing ?? this.settlementRepository.getByOrderId(campaignOrderId);
        let updatedCampaign = null;
        if (campaignSettlement) {
            updatedCampaign = this.applyElectedSupplierToSettlement(campaignSettlement, supplier);
        }
        this.syncDeferredOrderSettlementsForIntake(intake, supplier);
        return updatedCampaign;
    }
    /**
     * Pedido pago congela o fornecedor no momento do PIX do assinante.
     * Se a campanha vigente mudou de operacional, a linha adiada (skipped/pending)
     * precisa seguir o eleito — sem mexer em linhas já pagas (lucro).
     */
    syncDeferredOrderSettlementsForIntake(intake, supplierOverride) {
        const supplier = supplierOverride ?? this.resolveSupplierForCampaignIntake(intake);
        if (!supplier?.pixKey)
            return 0;
        const ownerEmail = String(intake.ownerEmail || "")
            .trim()
            .toLowerCase();
        if (!ownerEmail)
            return 0;
        const apiKind = (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
        const campaignOrderPrefix = "campaign-supplier:";
        let updated = 0;
        for (const settlement of this.settlementRepository.list(500)) {
            if (String(settlement.orderId || "").startsWith(campaignOrderPrefix))
                continue;
            if (String(settlement.ownerEmail || "").trim().toLowerCase() !== ownerEmail)
                continue;
            if (settlement.apiKind !== apiKind)
                continue;
            const saved = this.applyElectedSupplierToSettlement(settlement, supplier);
            if (saved && saved !== settlement)
                updated += 1;
        }
        return updated;
    }
    /** Corrige splits de pedidos cuja campanha aberta já está em outro operacional. */
    syncDeferredSupplierSettlementsFromOpenCampaigns() {
        const intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
        let updated = 0;
        for (const intake of intakeRepository.listAll()) {
            const status = String(intake.status || "");
            if (status !== "generated" && status !== "in_progress")
                continue;
            if (!String(intake.assignedOperacionalEmail || "").trim())
                continue;
            updated += this.syncDeferredOrderSettlementsForIntake(intake);
        }
        return updated;
    }
    buildCampaignSupplierOrderId(intakeId) {
        return `campaign-supplier:${String(intakeId || "").trim()}`;
    }
    isCampaignSupplierOrderId(orderId) {
        return String(orderId || "").trim().startsWith("campaign-supplier:");
    }
    normalizeOwnerEmail(email) {
        return String(email || "").trim().toLowerCase();
    }
    findSupplierLine(settlement) {
        return settlement.lines.find((line) => line.lineKind === "supplier");
    }
    settlementMatchesSupplier(settlement, supplierId) {
        if (!supplierId)
            return true;
        if (String(settlement.supplierId || "").trim() === supplierId)
            return true;
        return String(this.findSupplierLine(settlement)?.participantId || "").trim() === supplierId;
    }
    isUnusedDeferredSupplierSettlement(settlement) {
        if (this.isCampaignSupplierOrderId(settlement.orderId))
            return false;
        const line = this.findSupplierLine(settlement);
        if (!line || line.amountCents <= 0)
            return false;
        if (line.payoutStatus === "paid" || line.payoutStatus === "processing")
            return false;
        return line.payoutStatus === "skipped" || line.payoutStatus === "pending";
    }
    findDeferredSupplierSettlement(params) {
        const ownerEmail = this.normalizeOwnerEmail(params.ownerEmail);
        const supplierId = String(params.supplierId || "").trim();
        const campaignIntakeId = String(params.campaignIntakeId || "").trim();
        const excluded = params.excludeSettlementIds ?? new Set();
        const preferredCost = Math.max(0, Math.round(Number(params.preferredCostPerShipmentCents ?? 0)));
        const all = this.settlementRepository
            .listAll()
            .filter((item) => !excluded.has(item.id))
            .filter((item) => !this.isCampaignSupplierOrderId(item.orderId))
            .filter((item) => this.normalizeOwnerEmail(item.ownerEmail) === ownerEmail)
            .filter((item) => item.apiKind === params.apiKind)
            .filter((item) => this.settlementMatchesSupplier(item, supplierId));
        if (campaignIntakeId) {
            const linked = all.find((item) => item.campaignIntakeId === campaignIntakeId);
            if (linked)
                return linked;
        }
        return (all
            .filter((item) => !item.campaignIntakeId)
            .filter((item) => this.isUnusedDeferredSupplierSettlement(item))
            .sort((a, b) => {
            if (preferredCost > 0) {
                const deltaA = Math.abs(Math.max(0, Math.round(Number(a.costPerShipmentCents ?? 0))) - preferredCost);
                const deltaB = Math.abs(Math.max(0, Math.round(Number(b.costPerShipmentCents ?? 0))) - preferredCost);
                if (deltaA !== deltaB)
                    return deltaA - deltaB;
            }
            return String(a.createdAt).localeCompare(String(b.createdAt));
        })[0] ?? null);
    }
    mergeSupplierPayoutIntoOriginal(original, sourceLine, campaignIntakeId) {
        const lines = original.lines.map((line) => {
            if (line.lineKind !== "supplier")
                return line;
            if (line.payoutStatus === "paid")
                return line;
            return {
                ...line,
                pixKey: sourceLine.pixKey || line.pixKey,
                amountCents: sourceLine.amountCents || line.amountCents,
                shipmentCount: sourceLine.shipmentCount ?? line.shipmentCount,
                costPerShipmentCents: sourceLine.costPerShipmentCents ?? line.costPerShipmentCents,
                payoutStatus: sourceLine.payoutStatus,
                asaasTransferId: sourceLine.asaasTransferId,
                payoutExternalReference: sourceLine.payoutExternalReference,
                transactionReceiptUrl: sourceLine.transactionReceiptUrl,
                paidAt: sourceLine.paidAt,
                failureReason: sourceLine.failureReason,
            };
        });
        const supplierLine = lines.find((line) => line.lineKind === "supplier");
        return {
            ...original,
            campaignIntakeId: original.campaignIntakeId || campaignIntakeId,
            supplierCostCents: supplierLine?.amountCents ?? original.supplierCostCents,
            lines,
            payoutStatus: (0, waba_financeiro_split_settlement_repository_1.deriveSettlementPayoutStatus)(lines),
        };
    }
    absorbSyntheticCampaignSupplierSettlements() {
        const synthetics = this.settlementRepository
            .listAll()
            .filter((item) => this.isCampaignSupplierOrderId(item.orderId))
            .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
        if (!synthetics.length)
            return 0;
        const usedOriginalIds = new Set();
        let absorbed = 0;
        for (const synthetic of synthetics) {
            const sourceLine = this.findSupplierLine(synthetic);
            if (!sourceLine)
                continue;
            const original = this.findDeferredSupplierSettlement({
                ownerEmail: synthetic.ownerEmail,
                apiKind: synthetic.apiKind,
                supplierId: String(synthetic.supplierId || sourceLine.participantId || "").trim(),
                campaignIntakeId: synthetic.campaignIntakeId,
                preferredCostPerShipmentCents: sourceLine.costPerShipmentCents ?? synthetic.costPerShipmentCents,
                excludeSettlementIds: usedOriginalIds,
            });
            if (!original) {
                console.warn(`[FinanceiroSplit] settlement sintético ${synthetic.orderId} sem pedido original para absorver o comprovante`);
                continue;
            }
            const merged = this.mergeSupplierPayoutIntoOriginal(original, sourceLine, String(synthetic.campaignIntakeId || "").trim());
            this.settlementRepository.save(merged);
            this.settlementRepository.deleteByOrderIds([synthetic.orderId]);
            usedOriginalIds.add(original.id);
            absorbed += 1;
        }
        return absorbed;
    }
    prepareDeferredSupplierLine(settlement, supplier, deliveredCount, campaignIntakeId) {
        const aligned = this.applyElectedSupplierToSettlement(settlement, supplier) ?? settlement;
        const existingLine = this.findSupplierLine(aligned);
        const costPerShipmentCents = Math.max(0, Math.round(Number(existingLine?.costPerShipmentCents ??
            aligned.costPerShipmentCents ??
            supplier.costPerShipmentCents ??
            0)));
        const supplierCostCents = Math.max(0, Math.round(deliveredCount * costPerShipmentCents));
        const lines = aligned.lines.map((line) => {
            if (line.lineKind !== "supplier")
                return line;
            if (line.payoutStatus === "paid" || line.payoutStatus === "processing")
                return line;
            return {
                ...line,
                participantId: line.participantId || supplier.id,
                participantLabel: line.participantLabel || supplier.name,
                participantEmail: line.participantEmail || supplier.systemUserEmail || "",
                pixKey: supplier.pixKey,
                amountCents: supplierCostCents || line.amountCents,
                shipmentCount: deliveredCount || line.shipmentCount,
                costPerShipmentCents,
                payoutStatus: line.payoutStatus === "skipped" ? "pending" : line.payoutStatus,
            };
        });
        const supplierLine = lines.find((line) => line.lineKind === "supplier");
        return this.settlementRepository.save({
            ...aligned,
            campaignIntakeId: aligned.campaignIntakeId || campaignIntakeId,
            supplierCostCents: supplierLine?.amountCents ?? aligned.supplierCostCents,
            lines,
            payoutStatus: (0, waba_financeiro_split_settlement_repository_1.deriveSettlementPayoutStatus)(lines),
        });
    }
    async ensureSupplierPayoutOnSettlement(settlement, supplier, deliveredCount, campaignIntakeId) {
        const prepared = this.prepareDeferredSupplierLine(settlement, supplier, deliveredCount, campaignIntakeId);
        const supplierLine = this.findSupplierLine(prepared);
        if (!supplierLine)
            return prepared;
        if (supplierLine.payoutStatus === "paid")
            return prepared;
        if (!this.payoutService.isPayoutEnabled())
            return prepared;
        try {
            return ((await this.payoutService.executeSingleLine(prepared, supplierLine.participantId)) ??
                prepared);
        }
        catch (error) {
            console.error(`[FinanceiroSplit] falha no repasse PIX do fornecedor no pedido ${prepared.orderId}:`, error instanceof Error ? error.message : error);
            return prepared;
        }
    }
    async payoutSupplierForCompletedCampaign(intake) {
        if (intake.status !== "completed")
            return null;
        if ((0, waba_metrics_excluded_owners_1.isWabaMetricsExcludedOwnerEmail)(intake.ownerEmail))
            return null;
        if ((0, waba_campaign_credit_funding_1.isBonusOnlyCampaignFunding)(intake.creditFunding)) {
            console.info(`[FinanceiroSplit] campanha ${intake.id} ignorada no split: 100% bônus de envio`);
            return null;
        }
        const deliveredCount = (0, waba_campaign_credit_funding_1.resolveBillableSentForSupplierSplit)(intake);
        if (deliveredCount <= 0)
            return null;
        const supplier = this.resolveSupplierForCampaignIntake(intake);
        if (!supplier?.pixKey)
            return null;
        this.absorbSyntheticCampaignSupplierSettlements();
        this.syncDeferredOrderSettlementsForIntake(intake, supplier);
        const apiKind = (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
        const linkedCandidates = this.settlementRepository
            .listAll()
            .filter((item) => item.campaignIntakeId === intake.id)
            .sort((a, b) => Number(this.isCampaignSupplierOrderId(a.orderId)) -
            Number(this.isCampaignSupplierOrderId(b.orderId)));
        const linked = linkedCandidates[0] ??
            this.settlementRepository.getByOrderId(this.buildCampaignSupplierOrderId(intake.id));
        const target = linked && !this.isCampaignSupplierOrderId(linked.orderId)
            ? linked
            : this.findDeferredSupplierSettlement({
                ownerEmail: intake.ownerEmail,
                apiKind,
                supplierId: supplier.id,
                campaignIntakeId: intake.id,
                preferredCostPerShipmentCents: supplier.costPerShipmentCents,
            });
        if (target && !this.isCampaignSupplierOrderId(target.orderId)) {
            if ((0, waba_metrics_excluded_owners_1.isWabaMetricsExcludedOwnerEmail)(target.ownerEmail))
                return null;
            return this.ensureSupplierPayoutOnSettlement(target, supplier, deliveredCount, intake.id);
        }
        if (linked && this.isCampaignSupplierOrderId(linked.orderId)) {
            if ((0, waba_metrics_excluded_owners_1.isWabaMetricsExcludedOwnerEmail)(linked.ownerEmail))
                return null;
            return this.ensureSupplierPayoutOnSettlement(linked, supplier, deliveredCount, intake.id);
        }
        const orderId = this.buildCampaignSupplierOrderId(intake.id);
        const costPerShipmentCents = Math.max(0, Math.round(Number(supplier.costPerShipmentCents ?? 0)));
        const supplierCostCents = Math.max(0, Math.round(deliveredCount * costPerShipmentCents));
        if (supplierCostCents <= 0)
            return null;
        const lines = [
            {
                lineKind: "supplier",
                participantId: supplier.id,
                participantLabel: supplier.name,
                participantEmail: supplier.systemUserEmail || "",
                pixKey: supplier.pixKey,
                sharePercent: 0,
                amountCents: supplierCostCents,
                shipmentCount: deliveredCount,
                costPerShipmentCents,
                payoutStatus: "pending",
            },
        ];
        const fallback = this.settlementRepository.create({
            orderId,
            campaignIntakeId: intake.id,
            apiKind,
            ownerEmail: intake.ownerEmail,
            customerName: intake.campaignName,
            paidValueCents: 0,
            purchasedShipmentCount: deliveredCount,
            costPerShipmentCents,
            supplierCostCents,
            totalCostCents: supplierCostCents,
            grossProfitCents: 0,
            cetCents: 0,
            distributableCents: 0,
            supplierId: supplier.id,
            supplierName: supplier.name,
            lines,
            payoutStatus: (0, waba_financeiro_split_settlement_repository_1.deriveSettlementPayoutStatus)(lines),
        });
        return this.ensureSupplierPayoutOnSettlement(fallback, supplier, deliveredCount, intake.id);
    }
}
exports.WabaFinanceiroSplitService = WabaFinanceiroSplitService;
