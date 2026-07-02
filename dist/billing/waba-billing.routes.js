"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaBillingRoutes = void 0;
const waba_auth_service_1 = require("../auth/waba-auth.service");
const load_env_1 = require("../load-env");
const waba_feature_flags_1 = require("../config/waba-feature-flags");
const asaas_transfer_auth_service_1 = require("./asaas-transfer-auth.service");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_billing_service_1 = require("./waba-billing.service");
const waba_alternativa_numbers_service_1 = require("./waba-alternativa-numbers.service");
const waba_disparos_credits_service_1 = require("./waba-disparos-credits.service");
const alternativa_dispatch_rules_1 = require("../disparos/alternativa-dispatch-rules");
const orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository();
const billingService = new waba_billing_service_1.WabaBillingService(orderRepository);
const disparosCreditsService = new waba_disparos_credits_service_1.WabaDisparosCreditsService();
const alternativaNumbersService = new waba_alternativa_numbers_service_1.WabaAlternativaNumbersService();
const transferAuthService = new asaas_transfer_auth_service_1.AsaasTransferAuthService();
const resolveRequestAuth = (req) => {
    const token = (0, waba_auth_service_1.readWabaSessionCookie)(req.headers.cookie);
    const session = (0, waba_auth_service_1.verifyWabaSessionToken)(token);
    if (!session)
        return { email: "", role: "guest" };
    return {
        email: session.email,
        role: (0, waba_auth_service_1.resolveSessionRole)(session),
    };
};
const resolveAsaasWebhookToken = () => String(process.env.ASAAS_WEBHOOK_ACCESS_TOKEN ?? "").trim();
const resolveAsaasTransferWebhookToken = () => String(process.env.ASAAS_TRANSFER_WEBHOOK_ACCESS_TOKEN ??
    process.env.ASAAS_WEBHOOK_ACCESS_TOKEN ??
    "").trim();
const parseAsaasWebhookTokens = (raw) => String(raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
const readAsaasWebhookHeaderToken = (req) => String(req.header("asaas-access-token") ??
    req.header("Asaas-Access-Token") ??
    req.header("ASAAS-ACCESS-TOKEN") ??
    "").trim();
const isAuthorizedAsaasWebhook = (req) => {
    const expectedTokens = parseAsaasWebhookTokens(resolveAsaasWebhookToken());
    if (!expectedTokens.length)
        return true;
    const received = readAsaasWebhookHeaderToken(req);
    return received.length > 0 && expectedTokens.includes(received);
};
const isAuthorizedAsaasTransferWebhook = (req) => {
    const expectedTokens = parseAsaasWebhookTokens(resolveAsaasTransferWebhookToken());
    if (!expectedTokens.length)
        return true;
    const received = readAsaasWebhookHeaderToken(req);
    return received.length > 0 && expectedTokens.includes(received);
};
const isAlternativaNumbersSimulationEnabled = () => {
    const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
    return load_env_1.WABA_ENV === "v02" || runtime === "development";
};
const registerWabaBillingRoutes = (app) => {
    app.get("/billing/disparos/config", (_req, res) => {
        return res.status(200).json(billingService.getDisparosConfig());
    });
    app.get("/billing/disparos/status", (_req, res) => {
        return res.status(200).json({
            ...billingService.getDisparosConfig(),
            paidOrders: billingService.listPaidDisparosOrders(),
        });
    });
    app.get("/billing/disparos/credits", (req, res) => {
        const auth = resolveRequestAuth(req);
        if (!auth.email) {
            return res.status(401).json({ error: "Faça login para consultar seus créditos." });
        }
        return res.status(200).json({
            ...disparosCreditsService.getCreditsSummary(auth.email),
            role: auth.role,
        });
    });
    app.get("/billing/disparos/purchases", (req, res) => {
        const auth = resolveRequestAuth(req);
        if (!auth.email) {
            return res.status(401).json({ error: "Faça login para consultar suas compras." });
        }
        const limitRaw = Number(req.query.limit ?? 20);
        const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
        return res.status(200).json({
            items: disparosCreditsService.listPurchaseHistory(auth.email, limit),
        });
    });
    app.get("/billing/disparos/bonus-history", (req, res) => {
        const auth = resolveRequestAuth(req);
        if (!auth.email) {
            return res.status(401).json({ error: "Faça login para consultar bonificações." });
        }
        const limitRaw = Number(req.query.limit ?? 20);
        const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
        return res.status(200).json({
            items: disparosCreditsService.listBonusHistory(auth.email, limit),
        });
    });
    app.post("/billing/disparos/coupon/validate", (req, res) => {
        try {
            const auth = resolveRequestAuth(req);
            if (!auth.email) {
                return res.status(401).json({ error: "Faça login para aplicar cupom." });
            }
            const body = req.body;
            const quote = billingService.quoteDisparosCoupon({
                alias: String(body.alias ?? ""),
                apiKind: body.apiKind === "alternativa" ? "alternativa" : "oficial",
                shipmentCount: Number(body.shipmentCount ?? 0),
            });
            return res.status(200).json({ ok: true, quote });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível validar o cupom.",
            });
        }
    });
    app.post("/billing/disparos/checkout", async (req, res) => {
        try {
            const auth = resolveRequestAuth(req);
            if (!auth.email) {
                return res.status(401).json({ error: "Faça login para contratar créditos." });
            }
            const body = req.body;
            const checkout = await billingService.createDisparosPixCheckout({
                apiKind: body.apiKind === "alternativa" ? "alternativa" : "oficial",
                customerName: String(body.customerName ?? ""),
                ownerEmail: auth.email,
                cpfCnpj: String(body.cpfCnpj ?? ""),
                whatsapp: String(body.whatsapp ?? ""),
                valueCents: body.valueCents !== undefined ? Number(body.valueCents) : undefined,
                shipmentCount: body.shipmentCount !== undefined ? Number(body.shipmentCount) : undefined,
                couponAlias: body.couponAlias !== undefined ? String(body.couponAlias) : undefined,
            });
            return res.status(201).json(checkout);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.",
            });
        }
    });
    app.get("/billing/disparos/orders/:orderId", async (req, res) => {
        try {
            const current = billingService.getOrderStatus(req.params.orderId);
            if (!current)
                return res.status(404).json({ error: "Pedido não encontrado." });
            if (current.status === "pending_payment") {
                const reconciled = await billingService.reconcileOrderPayment(req.params.orderId);
                return res.status(200).json(reconciled ?? current);
            }
            return res.status(200).json(current);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível consultar o pedido.",
            });
        }
    });
    app.get("/billing/alternativa-numbers/config", (_req, res) => {
        const purchaseEnabled = (0, waba_feature_flags_1.isAlternativaNumbersPurchaseEnabled)();
        return res.status(200).json({
            ...alternativaNumbersService.getPricing(),
            paymentConfigured: billingService.getDisparosConfig().paymentConfigured,
            purchaseEnabled,
            featureFlags: { alternativaNumbersPurchase: purchaseEnabled },
        });
    });
    app.get("/billing/alternativa-numbers/summary", async (req, res) => {
        const auth = resolveRequestAuth(req);
        if (!auth.email) {
            return res.status(401).json({ error: "Faça login para consultar seus números." });
        }
        if (!(0, waba_feature_flags_1.isAlternativaNumbersPurchaseEnabled)()) {
            return res.status(200).json({
                purchaseEnabled: false,
                ...alternativaNumbersService.getPricing(),
                dispatchRules: (0, alternativa_dispatch_rules_1.getAlternativaDispatchRulesMeta)(),
                purchasedSlots: 0,
                activatedCount: 0,
                availableSlots: 0,
                activations: [],
                fazendaPool: { items: [], availableToClaim: [], assignedToSubscriber: [] },
                canPickNumbers: false,
                canSend: false,
            });
        }
        try {
            const summary = await alternativaNumbersService.getSummaryAsync(auth.email);
            return res.status(200).json({ ...summary, purchaseEnabled: true });
        }
        catch (error) {
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Erro ao consultar números da fazenda.",
            });
        }
    });
    app.post("/billing/alternativa-numbers/checkout", async (req, res) => {
        if (!(0, waba_feature_flags_1.isAlternativaNumbersPurchaseEnabled)()) {
            return res.status(403).json({ error: "Compra de números indisponível neste ambiente." });
        }
        try {
            const auth = resolveRequestAuth(req);
            if (!auth.email) {
                return res.status(401).json({ error: "Faça login para comprar números." });
            }
            const body = req.body;
            const quantity = Math.round(Number(body.quantity ?? 0));
            const checkout = await billingService.createAlternativaNumbersPixCheckout({
                customerName: String(body.customerName ?? ""),
                ownerEmail: auth.email,
                cpfCnpj: String(body.cpfCnpj ?? ""),
                whatsapp: String(body.whatsapp ?? ""),
                quantity,
                valueCents: quantity * 2000,
            });
            return res.status(201).json(checkout);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.",
            });
        }
    });
    app.post("/billing/alternativa-numbers/activate", async (req, res) => {
        if (!(0, waba_feature_flags_1.isAlternativaNumbersPurchaseEnabled)()) {
            return res.status(403).json({ error: "Ativação de números da fazenda indisponível neste ambiente." });
        }
        try {
            const auth = resolveRequestAuth(req);
            if (!auth.email) {
                return res.status(401).json({ error: "Faça login para ativar um número." });
            }
            const instanceName = String(req.body?.instanceName ?? "").trim();
            if (!instanceName) {
                return res.status(400).json({ error: "Informe o nome da instância." });
            }
            const activation = await alternativaNumbersService.registerActivation(auth.email, instanceName);
            return res.status(200).json({
                ok: true,
                activation,
                summary: await alternativaNumbersService.getSummaryAsync(auth.email),
            });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível ativar o número.",
            });
        }
    });
    app.post("/billing/alternativa-numbers/simulate-purchase", async (req, res) => {
        if (!isAlternativaNumbersSimulationEnabled()) {
            return res.status(404).json({ error: "Simulação indisponível neste ambiente." });
        }
        try {
            const auth = resolveRequestAuth(req);
            if (!auth.email) {
                return res.status(401).json({ error: "Faça login para simular a compra." });
            }
            const quantity = Math.round(Number(req.body?.quantity ?? 0));
            const result = await alternativaNumbersService.simulatePaidPurchase(auth.email, quantity);
            return res.status(201).json(result);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível simular a compra.",
            });
        }
    });
    app.post("/webhooks/asaas", (req, res) => {
        if (!isAuthorizedAsaasWebhook(req)) {
            console.warn("[AsaasWebhook] rejeitado — header asaas-access-token ausente ou diferente do env ASAAS_WEBHOOK_ACCESS_TOKEN");
            return res.status(401).json({ error: "Webhook Asaas não autorizado." });
        }
        const body = req.body;
        const event = String(body.event ?? "");
        const payment = body.payment ?? {};
        // Asaas só considera entrega OK com HTTP 200 — responder rápido e processar depois.
        res.status(200).json({ ok: true, accepted: true });
        setImmediate(() => {
            billingService
                .handleAsaasWebhook(event, payment)
                .then((result) => {
                if (result?.ignored) {
                    console.info("[AsaasWebhook] ignorado:", result.reason ?? event);
                    return;
                }
                console.info("[AsaasWebhook] processado:", JSON.stringify(result));
            })
                .catch((error) => {
                console.error("[AsaasWebhook] erro ao processar (já respondido 200):", error instanceof Error ? error.message : error);
            });
        });
    });
    app.post("/webhooks/asaas/transfer-authorization", (req, res) => {
        if (!isAuthorizedAsaasTransferWebhook(req)) {
            console.warn("[AsaasTransferWebhook] rejeitado — header asaas-access-token ausente ou diferente do env");
            return res.status(401).json({ error: "Webhook de autorização de transferência não autorizado." });
        }
        try {
            const result = transferAuthService.resolveTransferAuthorization(req.body);
            return res.status(200).json(result);
        }
        catch (error) {
            console.error("[AsaasTransferWebhook] erro:", error instanceof Error ? error.message : error);
            return res.status(200).json({
                status: "REFUSED",
                refuseReason: error instanceof Error ? error.message : "Falha ao validar transferência.",
            });
        }
    });
};
exports.registerWabaBillingRoutes = registerWabaBillingRoutes;
