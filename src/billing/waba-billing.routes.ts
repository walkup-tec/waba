import type { Express, Request } from "express";
import { readWabaSessionCookie, resolveSessionRole, verifyWabaSessionToken } from "../auth/waba-auth.service";
import { WABA_ENV } from "../load-env";
import { AsaasTransferAuthService } from "./asaas-transfer-auth.service";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import { WabaBillingService } from "./waba-billing.service";
import { WabaAlternativaNumbersService } from "./waba-alternativa-numbers.service";
import { WabaDisparosCreditsService } from "./waba-disparos-credits.service";

const orderRepository = new WabaBillingOrderRepository();
const billingService = new WabaBillingService(orderRepository);
const disparosCreditsService = new WabaDisparosCreditsService();
const alternativaNumbersService = new WabaAlternativaNumbersService();
const transferAuthService = new AsaasTransferAuthService();

const resolveRequestAuth = (req: Request) => {
  const token = readWabaSessionCookie(req.headers.cookie);
  const session = verifyWabaSessionToken(token);
  if (!session) return { email: "", role: "guest" as const };
  return {
    email: session.email,
    role: resolveSessionRole(session),
  };
};

const resolveAsaasWebhookToken = (): string => String(process.env.ASAAS_WEBHOOK_ACCESS_TOKEN ?? "").trim();

const resolveAsaasTransferWebhookToken = (): string =>
  String(
    process.env.ASAAS_TRANSFER_WEBHOOK_ACCESS_TOKEN ??
      process.env.ASAAS_WEBHOOK_ACCESS_TOKEN ??
      "",
  ).trim();

const isAuthorizedAsaasWebhook = (req: Request): boolean => {
  const expected = resolveAsaasWebhookToken();
  if (!expected) return true;
  const received = String(req.header("asaas-access-token") ?? "").trim();
  return received.length > 0 && received === expected;
};

const isAuthorizedAsaasTransferWebhook = (req: Request): boolean => {
  const expected = resolveAsaasTransferWebhookToken();
  if (!expected) return true;
  const received = String(req.header("asaas-access-token") ?? "").trim();
  return received.length > 0 && received === expected;
};

const isAlternativaNumbersSimulationEnabled = (): boolean => {
  const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
  return WABA_ENV === "v02" || runtime === "development";
};

export const registerWabaBillingRoutes = (app: Express) => {
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
      const body = req.body as Record<string, unknown>;
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
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.",
      });
    }
  });

  app.get("/billing/disparos/orders/:orderId", async (req, res) => {
    try {
      const current = billingService.getOrderStatus(req.params.orderId);
      if (!current) return res.status(404).json({ error: "Pedido não encontrado." });
      if (current.status === "pending_payment") {
        const reconciled = await billingService.reconcileOrderPayment(req.params.orderId);
        return res.status(200).json(reconciled ?? current);
      }
      return res.status(200).json(current);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível consultar o pedido.",
      });
    }
  });

  app.get("/billing/alternativa-numbers/config", (_req, res) => {
    return res.status(200).json({
      ...alternativaNumbersService.getPricing(),
      paymentConfigured: billingService.getDisparosConfig().paymentConfigured,
    });
  });

  app.get("/billing/alternativa-numbers/summary", (req, res) => {
    const auth = resolveRequestAuth(req);
    if (!auth.email) {
      return res.status(401).json({ error: "Faça login para consultar seus números." });
    }
    return res.status(200).json(alternativaNumbersService.getSummary(auth.email));
  });

  app.post("/billing/alternativa-numbers/checkout", async (req, res) => {
    try {
      const auth = resolveRequestAuth(req);
      if (!auth.email) {
        return res.status(401).json({ error: "Faça login para comprar números." });
      }
      const body = req.body as Record<string, unknown>;
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
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.",
      });
    }
  });

  app.post("/billing/alternativa-numbers/activate", (req, res) => {
    try {
      const auth = resolveRequestAuth(req);
      if (!auth.email) {
        return res.status(401).json({ error: "Faça login para ativar um número." });
      }
      const instanceName = String(req.body?.instanceName ?? "").trim();
      if (!instanceName) {
        return res.status(400).json({ error: "Informe o nome da instância." });
      }
      const activation = alternativaNumbersService.registerActivation(auth.email, instanceName);
      return res.status(200).json({
        ok: true,
        activation,
        summary: alternativaNumbersService.getSummary(auth.email),
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível ativar o número.",
      });
    }
  });

  app.post("/billing/alternativa-numbers/simulate-purchase", (req, res) => {
    if (!isAlternativaNumbersSimulationEnabled()) {
      return res.status(404).json({ error: "Simulação indisponível neste ambiente." });
    }
    try {
      const auth = resolveRequestAuth(req);
      if (!auth.email) {
        return res.status(401).json({ error: "Faça login para simular a compra." });
      }
      const quantity = Math.round(Number(req.body?.quantity ?? 0));
      const result = alternativaNumbersService.simulatePaidPurchase(auth.email, quantity);
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível simular a compra.",
      });
    }
  });

  app.post("/webhooks/asaas", async (req, res) => {
    if (!isAuthorizedAsaasWebhook(req)) {
      return res.status(401).json({ error: "Webhook Asaas não autorizado." });
    }

    try {
      const body = req.body as {
        event?: string;
        payment?: { id?: string; externalReference?: string; status?: string };
      };
      const result = await billingService.handleAsaasWebhook(
        String(body.event ?? ""),
        body.payment ?? {},
      );
      return res.status(200).json(result);
    } catch (error) {
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
    } catch (error) {
      return res.status(400).json({
        status: "REFUSED",
        refuseReason: error instanceof Error ? error.message : "Falha ao validar transferência.",
      });
    }
  });
};
