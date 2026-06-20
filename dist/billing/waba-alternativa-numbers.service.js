"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAlternativaNumbersService = exports.ALTERNATIVA_NUMBER_MAX_QUANTITY = exports.ALTERNATIVA_NUMBER_UNIT_CENTS = void 0;
const node_crypto_1 = require("node:crypto");
const waba_fazenda_pool_service_1 = require("../instances/waba-fazenda-pool.service");
const alternativa_number_activation_repository_1 = require("./alternativa-number-activation.repository");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const alternativa_dispatch_rules_1 = require("../disparos/alternativa-dispatch-rules");
exports.ALTERNATIVA_NUMBER_UNIT_CENTS = 2000;
exports.ALTERNATIVA_NUMBER_MAX_QUANTITY = 20;
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
class WabaAlternativaNumbersService {
    constructor(orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), activationRepository = new alternativa_number_activation_repository_1.AlternativaNumberActivationRepository()) {
        this.orderRepository = orderRepository;
        this.activationRepository = activationRepository;
    }
    getPricing() {
        return {
            unitCents: exports.ALTERNATIVA_NUMBER_UNIT_CENTS,
            unitLabel: "R$ 20,00",
            maxQuantity: exports.ALTERNATIVA_NUMBER_MAX_QUANTITY,
            product: "waba-alternativa-numbers",
        };
    }
    getPurchasedSlots(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return 0;
        return this.orderRepository
            .list()
            .filter((order) => order.product === "waba-alternativa-numbers" &&
            order.status === "paid" &&
            normalizeEmail(order.ownerEmail) === normalized)
            .reduce((sum, order) => sum + Math.max(0, Math.round(Number(order.shipmentCount ?? 0))), 0);
    }
    async getSummaryAsync(email) {
        const purchasedSlots = this.getPurchasedSlots(email);
        const activations = this.activationRepository.listForEmail(email);
        const activatedCount = activations.length;
        const availableSlots = Math.max(0, purchasedSlots - activatedCount);
        const fazendaPool = await waba_fazenda_pool_service_1.wabaFazendaPoolService.buildPoolForSubscriber(email);
        return {
            ...this.getPricing(),
            dispatchRules: (0, alternativa_dispatch_rules_1.getAlternativaDispatchRulesMeta)(),
            canPickNumbers: purchasedSlots >= (0, alternativa_dispatch_rules_1.getAlternativaDispatchRulesMeta)().minPurchasedForPicker,
            canSend: activatedCount >= (0, alternativa_dispatch_rules_1.getAlternativaDispatchRulesMeta)().minActivatedForSend,
            purchasedSlots,
            activatedCount,
            availableSlots,
            activations: activations.map((row) => ({
                instanceName: row.instanceName,
                activatedAt: row.activatedAt,
            })),
            fazendaPool: {
                items: fazendaPool.items,
                availableToClaim: fazendaPool.availableToClaim,
                assignedToSubscriber: fazendaPool.assignedToSubscriber,
            },
        };
    }
    validateCheckout(quantity, valueCents) {
        const qty = Math.round(Number(quantity));
        if (!Number.isFinite(qty) || qty < alternativa_dispatch_rules_1.ALTERNATIVA_MIN_PURCHASE_QUANTITY || qty > exports.ALTERNATIVA_NUMBER_MAX_QUANTITY) {
            throw new Error(`Compra mínima de ${alternativa_dispatch_rules_1.ALTERNATIVA_MIN_PURCHASE_QUANTITY} números. Selecione entre ${alternativa_dispatch_rules_1.ALTERNATIVA_MIN_PURCHASE_QUANTITY} e ${exports.ALTERNATIVA_NUMBER_MAX_QUANTITY}.`);
        }
        const expected = qty * exports.ALTERNATIVA_NUMBER_UNIT_CENTS;
        const cents = Math.round(Number(valueCents));
        if (cents !== expected) {
            throw new Error("Valor total inválido para a quantidade selecionada.");
        }
        return { quantity: qty, valueCents: cents };
    }
    async registerActivation(email, instanceName) {
        const summary = await this.getSummaryAsync(email);
        if (summary.availableSlots <= 0) {
            throw new Error("Você não possui números disponíveis para ativar. Compre novos números primeiro.");
        }
        await waba_fazenda_pool_service_1.wabaFazendaPoolService.assertCanAssignToSubscriber(email, instanceName);
        if (this.activationRepository.hasInstance(email, instanceName)) {
            return this.activationRepository.listForEmail(email).find((row) => row.instanceName.toLowerCase() === instanceName.toLowerCase());
        }
        return this.activationRepository.register(email, instanceName, "slot");
    }
    /** Simula compra paga (somente dev/V02). Saldo fica atrelado ao ownerEmail. */
    async simulatePaidPurchase(email, quantity) {
        const normalized = normalizeEmail(email);
        if (!normalized.includes("@")) {
            throw new Error("Informe um e-mail válido.");
        }
        const qty = Math.round(Number(quantity));
        if (!Number.isFinite(qty) || qty < alternativa_dispatch_rules_1.ALTERNATIVA_MIN_PURCHASE_QUANTITY) {
            throw new Error(`Compra mínima de ${alternativa_dispatch_rules_1.ALTERNATIVA_MIN_PURCHASE_QUANTITY} números.`);
        }
        const now = new Date().toISOString();
        const orderId = (0, node_crypto_1.randomUUID)();
        const order = this.orderRepository.create({
            id: orderId,
            product: "waba-alternativa-numbers",
            apiKind: "alternativa",
            customerName: "Simulação V02",
            ownerEmail: normalized,
            whatsapp: "11987654321",
            cpfCnpj: "00000000000",
            billingType: "PIX",
            valueCents: qty * exports.ALTERNATIVA_NUMBER_UNIT_CENTS,
            shipmentCount: qty,
            status: "paid",
            asaasExternalReference: `waba:simulate:${orderId}`,
            createdAt: now,
            updatedAt: now,
            paidAt: now,
        });
        return {
            ok: true,
            simulated: true,
            orderId: order.id,
            ownerEmail: normalized,
            quantity: qty,
            summary: await this.getSummaryAsync(normalized),
        };
    }
}
exports.WabaAlternativaNumbersService = WabaAlternativaNumbersService;
