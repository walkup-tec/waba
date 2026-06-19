"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaFinanceiroSplitService = void 0;
const node_crypto_1 = require("node:crypto");
const waba_master_disparos_policy_service_1 = require("../users/waba-master-disparos-policy.service");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_disparos_order_shipments_1 = require("./waba-disparos-order-shipments");
const waba_financeiro_split_repository_1 = require("./waba-financeiro-split.repository");
const waba_financeiro_split_settlement_repository_1 = require("./waba-financeiro-split-settlement.repository");
const waba_financeiro_split_payout_service_1 = require("./waba-financeiro-split-payout.service");
const waba_financeiro_cet_1 = require("./waba-financeiro-cet");
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
    return {
        id: String(input.id ?? (0, node_crypto_1.randomUUID)()).trim() || (0, node_crypto_1.randomUUID)(),
        name: String(input.name ?? "").trim(),
        apiKind,
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
        return this.settlementRepository.list(limit);
    }
    async syncSettlementTransferStatuses(limit = 100) {
        return this.payoutService.syncProcessingTransfers(limit);
    }
    getSettlementByOrderId(orderId) {
        return this.settlementRepository.getByOrderId(orderId);
    }
    resolveActiveSupplier(config, apiKind) {
        return (config.suppliers.find((item) => item.active && item.apiKind === apiKind) ?? null);
    }
    validateConfig(input) {
        const suppliers = (Array.isArray(input.suppliers) ? input.suppliers : []).map(normalizeSupplier);
        const participants = (Array.isArray(input.participants) ? input.participants : []).map(normalizeParticipant);
        const activeSuppliers = suppliers.filter((item) => item.active);
        const apiKinds = new Set();
        for (const supplier of activeSuppliers) {
            if (!supplier.name) {
                throw new Error("Cada fornecedor ativo precisa de um nome.");
            }
            if (!supplier.pixKey || supplier.pixKey.length < 5) {
                throw new Error(`Informe a chave PIX do fornecedor ${supplier.name || "sem nome"}.`);
            }
            if (apiKinds.has(supplier.apiKind)) {
                throw new Error(supplier.apiKind === "oficial"
                    ? "Já existe um fornecedor ativo para API Oficial."
                    : "Já existe um fornecedor ativo para API Alternativa.");
            }
            apiKinds.add(supplier.apiKind);
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
            const percentSum = roundPercent(activeParticipants.reduce((sum, item) => sum + item.sharePercent, 0));
            if (Math.abs(percentSum - 100) > PERCENT_SUM_TOLERANCE) {
                throw new Error(`A soma dos percentuais do lucro deve ser 100% (atual: ${percentSum.toFixed(2)}%).`);
            }
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
        const settlement = this.settlementRepository.getByOrderId(order.id);
        if (settlement) {
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
        const supplier = this.resolveActiveSupplier(config, apiKind);
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
        const existing = this.settlementRepository.getByOrderId(order.id);
        if (existing)
            return existing;
        const config = this.configRepository.get();
        const apiKind = (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order);
        const masterPolicy = this.masterPolicyService.resolveForEmail(order.ownerEmail);
        const paySuppliers = !masterPolicy || masterPolicy.splitSuppliers;
        const payProfits = !masterPolicy || masterPolicy.splitProfits;
        const supplier = this.resolveActiveSupplier(config, apiKind);
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
            lines.push({
                lineKind: "supplier",
                participantId: supplier.id,
                participantLabel: supplier.name,
                participantEmail: "",
                pixKey: paySuppliers ? supplier.pixKey : "",
                sharePercent: 0,
                amountCents: effectiveSupplierCostCents,
                shipmentCount: purchasedShipmentCount,
                costPerShipmentCents: paySuppliers ? costPerShipmentCents : 0,
                payoutStatus: paySuppliers && effectiveSupplierCostCents > 0 ? "pending" : "skipped",
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
}
exports.WabaFinanceiroSplitService = WabaFinanceiroSplitService;
