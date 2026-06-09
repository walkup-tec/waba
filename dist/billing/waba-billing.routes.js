"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaBillingRoutes = void 0;
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_billing_service_1 = require("./waba-billing.service");
const orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository();
const billingService = new waba_billing_service_1.WabaBillingService(orderRepository);
const resolveAsaasWebhookToken = () => String(process.env.ASAAS_WEBHOOK_ACCESS_TOKEN ?? "").trim();
const isAuthorizedAsaasWebhook = (req) => {
    const expected = resolveAsaasWebhookToken();
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
    app.post("/billing/disparos/checkout", async (req, res) => {
        try {
            const body = req.body;
            const checkout = await billingService.createDisparosPixCheckout({
                apiKind: body.apiKind === "alternativa" ? "alternativa" : "oficial",
                customerName: String(body.customerName ?? ""),
                ownerEmail: String(body.ownerEmail ?? ""),
                cpfCnpj: String(body.cpfCnpj ?? ""),
                whatsapp: String(body.whatsapp ?? ""),
                valueCents: body.valueCents !== undefined ? Number(body.valueCents) : undefined,
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
};
exports.registerWabaBillingRoutes = registerWabaBillingRoutes;
