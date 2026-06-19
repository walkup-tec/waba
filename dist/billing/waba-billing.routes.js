"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaBillingRoutes = void 0;
const waba_auth_service_1 = require("../auth/waba-auth.service");
const asaas_transfer_auth_service_1 = require("./asaas-transfer-auth.service");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_billing_service_1 = require("./waba-billing.service");
const waba_disparos_credits_service_1 = require("./waba-disparos-credits.service");
const orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository();
const billingService = new waba_billing_service_1.WabaBillingService(orderRepository);
const disparosCreditsService = new waba_disparos_credits_service_1.WabaDisparosCreditsService();
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
const isAuthorizedAsaasWebhook = (req) => {
    const expected = resolveAsaasWebhookToken();
    if (!expected)
        return true;
    const received = String(req.header("asaas-access-token") ?? "").trim();
    return received.length > 0 && received === expected;
};
const isAuthorizedAsaasTransferWebhook = (req) => {
    const expected = resolveAsaasTransferWebhookToken();
    if (!expected)
        return true;
    const received = String(req.header("asaas-access-token") ?? "").trim();
    return received.length > 0 && received === expected;
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
    app.post("/webhooks/asaas", async (req, res) => {
        if (!isAuthorizedAsaasWebhook(req)) {
            return res.status(401).json({ error: "Webhook Asaas não autorizado." });
        }
        try {
            const body = req.body;
            const result = await billingService.handleAsaasWebhook(String(body.event ?? ""), body.payment ?? {});
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Webhook inválido.",
            });
        }
    });
    app.post("/webhooks/asaas/transfer-authorization", (req, res) => {
        if (!isAuthorizedAsaasTransferWebhook(req)) {
            return res.status(401).json({ error: "Webhook de autorização de transferência não autorizado." });
        }
        try {
            const result = transferAuthService.resolveTransferAuthorization(req.body);
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(400).json({
                status: "REFUSED",
                refuseReason: error instanceof Error ? error.message : "Falha ao validar transferência.",
            });
        }
    });
};
exports.registerWabaBillingRoutes = registerWabaBillingRoutes;
