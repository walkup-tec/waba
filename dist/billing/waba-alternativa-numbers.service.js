"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAlternativaNumbersService = exports.ALTERNATIVA_NUMBER_MAX_QUANTITY = exports.ALTERNATIVA_NUMBER_UNIT_CENTS = void 0;
const node_crypto_1 = require("node:crypto");
const alternativa_number_activation_repository_1 = require("./alternativa-number-activation.repository");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
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
    getSummary(email) {
        const purchasedSlots = this.getPurchasedSlots(email);
        const activations = this.activationRepository.listForEmail(email);
        const activatedCount = activations.length;
        const availableSlots = Math.max(0, purchasedSlots - activatedCount);
        return {
            ...this.getPricing(),
            purchasedSlots,
            activatedCount,
            availableSlots,
            activations: activations.map((row) => ({
                instanceName: row.instanceName,
                activatedAt: row.activatedAt,
            })),
        };
    }
    validateCheckout(quantity, valueCents) {
        const qty = Math.round(Number(quantity));
        if (!Number.isFinite(qty) || qty < 1 || qty > exports.ALTERNATIVA_NUMBER_MAX_QUANTITY) {
            throw new Error(`Selecione entre 1 e ${exports.ALTERNATIVA_NUMBER_MAX_QUANTITY} números.`);
        }
        const expected = qty * exports.ALTERNATIVA_NUMBER_UNIT_CENTS;
        const cents = Math.round(Number(valueCents));
        if (cents !== expected) {
            throw new Error("Valor total inválido para a quantidade selecionada.");
        }
        return { quantity: qty, valueCents: cents };
    }
    registerActivation(email, instanceName) {
        const summary = this.getSummary(email);
        if (summary.availableSlots <= 0) {
            throw new Error("Você não possui números disponíveis para ativar. Compre novos números primeiro.");
        }
        if (this.activationRepository.hasInstance(email, instanceName)) {
            return this.activationRepository.listForEmail(email).find((row) => row.instanceName.toLowerCase() === instanceName.toLowerCase());
        }
        return this.activationRepository.register(email, instanceName, "slot");
    }
    /** Simula compra paga (somente dev/V02). Saldo fica atrelado ao ownerEmail. */
    simulatePaidPurchase(email, quantity) {
        const normalized = normalizeEmail(email);
        if (!normalized.includes("@")) {
            throw new Error("Informe um e-mail válido.");
        }
        const qty = Math.round(Number(quantity));
        if (!Number.isFinite(qty) || qty < 1) {
            throw new Error("Informe uma quantidade válida de números.");
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
            summary: this.getSummary(normalized),
        };
    }
}
exports.WabaAlternativaNumbersService = WabaAlternativaNumbersService;
