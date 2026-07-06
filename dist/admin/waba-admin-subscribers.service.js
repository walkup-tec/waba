"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminSubscribersService = void 0;
const waba_disparos_credits_service_1 = require("../billing/waba-disparos-credits.service");
const waba_billing_order_repository_1 = require("../billing/waba-billing-order.repository");
const waba_campaign_intake_repository_1 = require("../disparos/waba-campaign-intake.repository");
const waba_disparos_order_shipments_1 = require("../billing/waba-disparos-order-shipments");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_subscriber_service_1 = require("../subscribers/waba-subscriber.service");
const waba_mail_delivery_1 = require("../mail/waba-mail-delivery");
const waba_welcome_whatsapp_service_1 = require("../mail/waba-welcome-whatsapp.service");
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
const formatPhoneDisplay = (raw) => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (digits.length === 11) {
        return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    if (digits.length === 10) {
        return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return digits || "—";
};
const resolveProductLabel = (product) => {
    if (product === "waba-alternativa-numbers")
        return "Números API Alternativa";
    return "Créditos de disparos";
};
const resolveApiKindLabel = (apiKind) => apiKind === "alternativa" ? "API Alternativa" : "API Oficial";
const resolveOrderStatusLabel = (status) => {
    if (status === "paid")
        return "Pago";
    if (status === "pending_payment")
        return "Aguardando pagamento";
    if (status === "cancelled")
        return "Cancelado";
    if (status === "failed")
        return "Falhou";
    return status;
};
const resolvePurchaseQuantityLabel = (order) => {
    const quantity = Math.max(0, Math.round(Number((0, waba_disparos_order_shipments_1.resolveOrderShipmentCount)(order) || 0)));
    const bonus = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
    if (order.product === "waba-alternativa-numbers") {
        return {
            quantity,
            label: quantity === 1 ? "1 número" : `${quantity.toLocaleString("pt-BR")} números`,
        };
    }
    const base = quantity === 1 ? "1 envio" : `${quantity.toLocaleString("pt-BR")} envios`;
    if (bonus > 0) {
        return {
            quantity,
            label: `${base} (+${bonus.toLocaleString("pt-BR")} bônus)`,
        };
    }
    return { quantity, label: base };
};
const normalizeIntakeStatus = (status) => String(status || "")
    .trim()
    .toLowerCase();
const isCampaignAwaiting = (intake) => {
    const status = normalizeIntakeStatus(intake.status);
    return status === "generated" || status === "pending_review" || status === "in_progress";
};
const isCampaignCompleted = (intake) => normalizeIntakeStatus(intake.status) === "completed";
const summarizePaidDisparosOrders = (orders) => {
    let contractedValueCents = 0;
    let contractedShipments = 0;
    for (const order of orders) {
        contractedValueCents += Math.max(0, Math.round(Number(order.valueCents ?? 0)));
        contractedShipments += Math.max(0, Math.round(Number((0, waba_disparos_order_shipments_1.resolveOrderShipmentCount)(order) || 0)));
    }
    return { contractedValueCents, contractedShipments };
};
class WabaAdminSubscribersService {
    constructor(subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository(), subscriberService = new waba_subscriber_service_1.WabaSubscriberService(), creditsService = new waba_disparos_credits_service_1.WabaDisparosCreditsService(), intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository(), orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository()) {
        this.subscriberRepository = subscriberRepository;
        this.subscriberService = subscriberService;
        this.creditsService = creditsService;
        this.intakeRepository = intakeRepository;
        this.orderRepository = orderRepository;
    }
    buildPaidDisparosOrdersByEmail() {
        const byEmail = new Map();
        for (const order of this.orderRepository.list()) {
            if (order.product !== "waba-disparos" || order.status !== "paid")
                continue;
            if (!String(order.paidAt ?? "").trim())
                continue;
            const email = normalizeEmail(order.ownerEmail);
            if (!email)
                continue;
            const bucket = byEmail.get(email) ?? [];
            bucket.push(order);
            byEmail.set(email, bucket);
        }
        return byEmail;
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
        const paidDisparosByEmail = this.buildPaidDisparosOrdersByEmail();
        return this.subscriberRepository
            .list()
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((subscriber) => {
            const email = normalizeEmail(subscriber.email);
            const credits = summarizePaidDisparosOrders(paidDisparosByEmail.get(email) ?? []);
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
    getSubscriberDetail(subscriberId) {
        const id = String(subscriberId ?? "").trim();
        if (!id)
            throw new Error("Assinante inválido.");
        const subscriber = this.subscriberRepository.getById(id);
        if (!subscriber)
            throw new Error("Assinante não encontrado.");
        const email = normalizeEmail(subscriber.email);
        const credits = this.creditsService.getCreditsSummary(email);
        const intakes = this.intakeRepository.listByEmail(email);
        return {
            profile: {
                id: subscriber.id,
                email,
                fullName: subscriber.fullName,
                cpfCnpj: subscriber.cpfCnpj,
                cpfCnpjFormatted: formatCpfCnpj(subscriber.cpfCnpj),
                whatsapp: subscriber.whatsapp,
                whatsappFormatted: formatPhoneDisplay(subscriber.whatsapp),
                phone: subscriber.phone,
                phoneFormatted: formatPhoneDisplay(subscriber.phone || subscriber.whatsapp),
                aquecedorGranted: Boolean(subscriber.aquecedorGranted),
                createdAt: subscriber.createdAt,
                createdAtLabel: formatCreatedAtLabel(subscriber.createdAt),
                updatedAt: subscriber.updatedAt,
                updatedAtLabel: formatCreatedAtLabel(subscriber.updatedAt),
            },
            summary: {
                creditsValueCents: credits.contractedValueCents,
                creditsValueLabel: formatMoneyFromCents(credits.contractedValueCents),
                contractedShipments: credits.contractedShipments,
                campaignsAwaiting: intakes.filter(isCampaignAwaiting).length,
                campaignsCompleted: intakes.filter(isCampaignCompleted).length,
            },
            purchaseHistory: this.listPurchaseHistory(email),
        };
    }
    updateSubscriber(subscriberId, input) {
        this.subscriberService.update(subscriberId, input);
        return this.getSubscriberDetail(subscriberId);
    }
    async resendSubscriberWelcome(subscriberId, password) {
        const id = String(subscriberId || "").trim();
        if (!id)
            throw new Error("Assinante inválido.");
        const subscriber = this.subscriberRepository.getById(id);
        if (!subscriber)
            throw new Error("Assinante não encontrado.");
        const plainPassword = String(password ?? "").trim();
        if (plainPassword.length < 6) {
            throw new Error("Informe a senha de acesso (mín. 6 caracteres) para reenviar as boas-vindas.");
        }
        const payload = {
            email: subscriber.email,
            fullName: subscriber.fullName,
            password: plainPassword,
            whatsapp: subscriber.whatsapp,
            phone: subscriber.phone ?? subscriber.whatsapp,
            cpfCnpj: subscriber.cpfCnpj,
        };
        const [email, whatsapp] = await Promise.all([
            (0, waba_mail_delivery_1.deliverSubscriberWelcomeEmail)(payload),
            (0, waba_welcome_whatsapp_service_1.deliverSubscriberWelcomeWhatsApp)({
                email: payload.email,
                password: payload.password,
                whatsapp: payload.whatsapp,
            }),
        ]);
        return { email, whatsapp };
    }
    listPurchaseHistory(email, limit = 50) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return [];
        return this.orderRepository
            .list()
            .filter((order) => normalizeEmail(order.ownerEmail) === normalized &&
            (order.status === "paid" || order.status === "pending_payment"))
            .sort((a, b) => {
            const aTime = new Date(String(a.paidAt || a.createdAt || 0)).getTime();
            const bTime = new Date(String(b.paidAt || b.createdAt || 0)).getTime();
            return bTime - aTime;
        })
            .slice(0, Math.max(1, Math.min(100, Math.floor(limit))))
            .map((order) => {
            const quantity = resolvePurchaseQuantityLabel(order);
            return {
                id: order.id,
                product: order.product,
                productLabel: resolveProductLabel(order.product),
                apiKind: order.apiKind,
                apiKindLabel: resolveApiKindLabel(order.apiKind),
                valueCents: Math.max(0, Math.round(Number(order.valueCents ?? 0))),
                valueLabel: formatMoneyFromCents(order.valueCents),
                quantity: quantity.quantity,
                quantityLabel: quantity.label,
                bonusShipmentsApplied: Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0))),
                status: order.status,
                statusLabel: resolveOrderStatusLabel(order.status),
                paidAt: String(order.paidAt ?? ""),
                paidAtLabel: order.paidAt ? formatCreatedAtLabel(order.paidAt) : "—",
                createdAt: order.createdAt,
                createdAtLabel: formatCreatedAtLabel(order.createdAt),
                couponAlias: String(order.couponAlias ?? "").trim(),
            };
        });
    }
}
exports.WabaAdminSubscribersService = WabaAdminSubscribersService;
