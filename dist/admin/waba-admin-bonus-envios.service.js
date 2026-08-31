"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminBonusEnviosService = void 0;
const node_crypto_1 = require("node:crypto");
const waba_billing_order_repository_1 = require("../billing/waba-billing-order.repository");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_disparos_order_shipments_1 = require("../billing/waba-disparos-order-shipments");
const waba_disparos_credits_service_1 = require("../billing/waba-disparos-credits.service");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const normalizeEmail = (value) => value.trim().toLowerCase();
const addHours = (iso, hours) => {
    const date = new Date(iso);
    date.setTime(date.getTime() + hours * 60 * 60 * 1000);
    return date.toISOString();
};
const resolveValidityWindow = (mode, createdAt, customUntil) => {
    if (mode === "lifetime") {
        return { validFrom: createdAt, validUntil: null };
    }
    if (mode === "12h") {
        return { validFrom: createdAt, validUntil: addHours(createdAt, 12) };
    }
    if (mode === "24h") {
        return { validFrom: createdAt, validUntil: addHours(createdAt, 24) };
    }
    const until = String(customUntil ?? "").trim();
    if (!until) {
        throw new Error("Informe a data de validade personalizada dos envios.");
    }
    const parsed = new Date(until);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Data de validade personalizada inválida.");
    }
    const minUntilMs = Date.now() + 60000;
    if (parsed.getTime() < minUntilMs) {
        throw new Error("A validade personalizada deve ser pelo menos 1 minuto no futuro.");
    }
    return { validFrom: createdAt, validUntil: parsed.toISOString() };
};
const resolveApiKindLabel = (apiKind) => apiKind === "alternativa" ? "API Alternativa" : "API Oficial";
const isBonusGrantOrder = (order) => order.product === "waba-disparos" && order.grantSource === "admin-bonus-envios";
class WabaAdminBonusEnviosService {
    constructor(subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository(), orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), creditsService = new waba_disparos_credits_service_1.WabaDisparosCreditsService()) {
        this.subscriberRepository = subscriberRepository;
        this.orderRepository = orderRepository;
        this.creditsService = creditsService;
    }
    toPublicItem(order) {
        const apiKind = (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(order.apiKind) ?? "oficial";
        const grantActive = order.grantActive !== false;
        return {
            id: order.id,
            ownerEmail: normalizeEmail(order.ownerEmail),
            customerName: String(order.customerName || "").trim() || "Assinante",
            apiKind,
            apiKindLabel: resolveApiKindLabel(apiKind),
            shipmentCount: Math.max(0, Math.round(Number(order.shipmentCount ?? 0))),
            validityMode: String(order.validityMode || (order.creditsValidUntil ? "custom" : "lifetime")),
            creditsValidUntil: order.creditsValidUntil ? String(order.creditsValidUntil) : null,
            grantActive,
            validNow: (0, waba_disparos_order_shipments_1.isOrderCreditsActive)(order),
            createdByEmail: normalizeEmail(String(order.grantCreatedByEmail || "")),
            createdAt: String(order.createdAt || ""),
            paidAt: String(order.paidAt || order.createdAt || ""),
        };
    }
    listPublicGrants() {
        return this.orderRepository
            .list()
            .filter(isBonusGrantOrder)
            .sort((a, b) => Date.parse(String(b.createdAt || 0)) - Date.parse(String(a.createdAt || 0)))
            .map((order) => this.toPublicItem(order));
    }
    deactivateGrant(grantId) {
        const id = String(grantId ?? "").trim();
        if (!id)
            throw new Error("Bônus de envios inválido.");
        const current = this.orderRepository.getById(id);
        if (!current || !isBonusGrantOrder(current)) {
            throw new Error("Bônus de envios não encontrado.");
        }
        const updated = this.orderRepository.update(id, { grantActive: false });
        if (!updated)
            throw new Error("Bônus de envios não encontrado.");
        return this.toPublicItem(updated);
    }
    grant(input) {
        const createdByEmail = normalizeEmail(input.createdByEmail);
        if (!createdByEmail.includes("@")) {
            throw new Error("E-mail do master inválido.");
        }
        const subscriberId = String(input.subscriberId ?? "").trim();
        const emailHint = normalizeEmail(String(input.email ?? ""));
        const subscriber = subscriberId
            ? this.subscriberRepository.getById(subscriberId)
            : emailHint
                ? this.subscriberRepository.getByEmail(emailHint)
                : null;
        if (!subscriber) {
            throw new Error("Assinante não encontrado.");
        }
        const ownerEmail = normalizeEmail(subscriber.email);
        if (!ownerEmail.includes("@")) {
            throw new Error("Assinante sem e-mail válido.");
        }
        const shipmentCount = Math.max(0, Math.round(Number(input.shipmentCount)));
        if (!Number.isFinite(shipmentCount) || shipmentCount <= 0) {
            throw new Error("Informe a quantidade de envios a creditar (mínimo 1).");
        }
        if (shipmentCount > 5000000) {
            throw new Error("Quantidade de envios acima do limite permitido.");
        }
        const apiKind = (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(input.apiKind);
        if (!apiKind) {
            throw new Error("Selecione o tipo de plano (API Oficial ou API Alternativa).");
        }
        const segment = String(subscriber.segment ?? "outros").trim().toLowerCase();
        if (segment === "bets" && apiKind === "alternativa") {
            throw new Error("Assinantes do segmento Bets recebem créditos apenas na API Oficial.");
        }
        const validityMode = input.validityMode;
        if (!["12h", "24h", "custom", "lifetime"].includes(validityMode)) {
            throw new Error("Selecione uma validade válida para o bônus de envios.");
        }
        const now = new Date().toISOString();
        const { validUntil } = resolveValidityWindow(validityMode, now, input.validUntil);
        const id = (0, node_crypto_1.randomUUID)();
        const order = {
            id,
            product: "waba-disparos",
            apiKind,
            customerName: String(subscriber.fullName || "Assinante").trim() || "Assinante",
            ownerEmail,
            whatsapp: String(subscriber.whatsapp || subscriber.phone || "").trim(),
            cpfCnpj: String(subscriber.cpfCnpj || "").trim(),
            billingType: "PIX",
            valueCents: 0,
            shipmentCount,
            status: "paid",
            asaasExternalReference: `waba:bonus-envios:${id}`,
            createdAt: now,
            updatedAt: now,
            paidAt: now,
            bonusShipmentsApplied: 0,
            bonusSettlementAt: now,
            grantSource: "admin-bonus-envios",
            grantCreatedByEmail: createdByEmail,
            grantActive: true,
            creditsValidUntil: validUntil,
            validityMode,
        };
        this.orderRepository.create(order);
        const credits = this.creditsService.getCreditsSummary(ownerEmail);
        const bucket = credits.byApi[apiKind];
        return {
            ok: true,
            order: this.toPublicItem(order),
            credits: {
                remainingShipments: bucket.remainingShipments,
                contractedShipments: bucket.contractedShipments,
                pendingBonusShipments: bucket.pendingBonusShipments,
            },
            subscriber: {
                id: subscriber.id,
                email: ownerEmail,
                fullName: subscriber.fullName,
            },
        };
    }
}
exports.WabaAdminBonusEnviosService = WabaAdminBonusEnviosService;
