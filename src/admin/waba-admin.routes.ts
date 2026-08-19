import type { Express, Request, Response } from "express";
import path from "node:path";
import multer from "multer";
import { rejectUnlessStaffMenu } from "../auth/waba-staff-menu-auth";
import { resolveWabaRequestAuth } from "../auth/waba-request-auth";
import { deliverSubscriberWelcomeNotifications } from "../mail/waba-mail-delivery";
import { WabaFinanceiroSplitService } from "../billing/waba-financeiro-split.service";
import { WabaAdminDashboardService } from "./waba-admin-dashboard.service";
import { WabaAdminFinanceiroService } from "./waba-admin-financeiro.service";
import { WabaAdminSubscribersService } from "./waba-admin-subscribers.service";
import { WabaAdminSubscribersCreateService } from "./waba-admin-subscribers-create.service";
import { WabaAdminSubscriberPurgeService } from "./waba-admin-subscriber-purge.service";
import { WabaAdminSubscriberPromoteService } from "./waba-admin-subscriber-promote.service";
import { WabaAdminMasterPromoteService } from "./waba-admin-master-promote.service";
import { WabaAdminSupportService } from "./waba-admin-support.service";
import { WabaAdminPushService } from "./waba-admin-push.service";
import { WabaAdminMasterMenuBadgesService } from "./waba-admin-master-menu-badges.service";
import { MASTER_MENU_BADGE_KEYS, type MasterMenuBadgeKey } from "./waba-admin-master-menu-badges.repository";
import {
  runAsaasIntegrationMonitorCheck,
  sendAsaasIntegrationTestAlert,
  getAsaasIntegrationMonitorStatus,
} from "../monitoring/asaas-integration-monitor.service";
import {
  runUptimeMonitorCheck,
  sendUptimeMonitorTestAlert,
  getUptimeMonitorStatus,
  getUptimeLights,
} from "../monitoring/uptime-monitor.service";
import {
  diagnoseUptimeTarget,
  isUptimeDiagnosticMasterEmail,
} from "../monitoring/uptime-monitor-diagnostics.service";
import { WabaAdminUsersService } from "./waba-admin-users.service";
import { WabaAdminInstancesService } from "./waba-admin-instances.service";
import { buildWabaDataSnapshot } from "./waba-admin-data-snapshot.service";
import { VpsCpuMonitorService } from "../infra/vps-cpu-monitor.service";
import { systemConnectionLogService } from "../monitoring/system-connection-log.service";
import { SYSTEM_LOG_MOTIVOS } from "../monitoring/system-connection-log.types";
import type { SystemConnectionLogFilters, SystemLogMotivo } from "../monitoring/system-connection-log.types";
import { WabaCouponService, parseWabaCouponDiscountPercent } from "../billing/waba-coupon.service";
import {
  WabaAdminBonusEnviosService,
  type BonusEnviosValidityMode,
} from "./waba-admin-bonus-envios.service";

const ADMIN_DASHBOARD_MENU_ID = "admin-dashboard";

const adminSubscribersService = new WabaAdminSubscribersService();
const adminSubscribersCreateService = new WabaAdminSubscribersCreateService();
const adminSubscriberPurgeService = new WabaAdminSubscriberPurgeService();
const couponService = new WabaCouponService();
const adminBonusEnviosService = new WabaAdminBonusEnviosService();
const adminSubscriberPromoteService = new WabaAdminSubscriberPromoteService();
const adminMasterPromoteService = new WabaAdminMasterPromoteService();
const adminUsersService = new WabaAdminUsersService();
const adminFinanceiroService = new WabaAdminFinanceiroService();
const adminDashboardService = new WabaAdminDashboardService();
const adminSupportService = new WabaAdminSupportService();
const adminPushService = new WabaAdminPushService();
const adminInstancesService = new WabaAdminInstancesService();
const adminMasterMenuBadgesService = new WabaAdminMasterMenuBadgesService();
const financeiroSplitService = new WabaFinanceiroSplitService();
const vpsCpuMonitorService = new VpsCpuMonitorService();

const uploadPushImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || "").toLowerCase().startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Envie apenas imagens (JPEG, PNG, WebP ou GIF)."));
  },
});

const rejectNonMaster = (req: Request, res: Response) => {
  const auth = resolveWabaRequestAuth(req);
  if (auth.role !== "master") {
    res.status(403).json({ error: "Área restrita ao usuário master." });
    return null;
  }
  return auth;
};

export const registerWabaAdminRoutes = (app: Express) => {
  app.get("/admin/dashboard/overview", async (req, res) => {
    const auth = rejectUnlessStaffMenu(req, res, ADMIN_DASHBOARD_MENU_ID);
    if (!auth) return;
    try {
      return res.status(200).json(
        await adminDashboardService.getOverview({
          role: auth.role,
          email: auth.email,
        }),
      );
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar o dashboard.",
      });
    }
  });

  app.get("/admin/subscribers", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const items = adminSubscribersService.listSubscribers();
      return res.status(200).json({ items });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar os assinantes.",
      });
    }
  });

  app.get("/admin/subscribers/:subscriberId", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const detail = adminSubscribersService.getSubscriberDetail(String(req.params.subscriberId ?? ""));
      return res.status(200).json(detail);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível carregar o assinante.";
      const status = message.includes("não encontrado") ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.patch("/admin/subscribers/:subscriberId", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const whatsapp = String(body.whatsapp ?? "");
      const detail = adminSubscribersService.updateSubscriber(String(req.params.subscriberId ?? ""), {
        email: String(body.email ?? ""),
        fullName: String(body.fullName ?? body.name ?? ""),
        whatsapp,
        phone: String(body.phone ?? whatsapp),
        cpfCnpj: String(body.cpfCnpj ?? ""),
        aquecedorGranted: body.aquecedorGranted === true,
        segment: body.segment,
        password: body.password !== undefined ? String(body.password) : undefined,
      });
      return res.status(200).json({ ok: true, ...detail });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o assinante.";
      const status = message.includes("não encontrado") ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.delete("/admin/subscribers/by-email/:email", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const email = decodeURIComponent(String(req.params.email ?? "").trim());
      const summary = adminSubscriberPurgeService.purgeByEmail(email);
      return res.status(200).json({ ok: true, ...summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível excluir o assinante.";
      const status = message.includes("não encontrado") ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.delete("/admin/subscribers/:subscriberId", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const subscriberId = String(req.params.subscriberId ?? "").trim();
      const detail = adminSubscribersService.getSubscriberDetail(subscriberId);
      if (!detail?.profile?.email) {
        return res.status(404).json({ error: "Assinante não encontrado." });
      }
      const summary = adminSubscriberPurgeService.purgeByEmail(detail.profile.email);
      return res.status(200).json({ ok: true, ...summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível excluir o assinante.";
      const status = message.includes("não encontrado") ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.post("/admin/subscribers", async (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    try {
      const body = req.body as Record<string, unknown>;
      const whatsapp = String(body.whatsapp ?? "");
      const password = String(body.password ?? "");
      const subscriber = adminSubscribersCreateService.createSubscriber({
        email: String(body.email ?? ""),
        password,
        fullName: String(body.fullName ?? body.name ?? ""),
        whatsapp,
        phone: String(body.phone ?? whatsapp),
        cpfCnpj: String(body.cpfCnpj ?? ""),
        aquecedorGranted: body.aquecedorGranted === true,
        segment: body.segment,
      });
      const notifications = await deliverSubscriberWelcomeNotifications({
        email: subscriber.email,
        fullName: subscriber.fullName,
        password,
        whatsapp: subscriber.whatsapp,
        phone: subscriber.phone,
        cpfCnpj: subscriber.cpfCnpj,
      });
      return res.status(201).json({ ok: true, subscriber, notifications });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível criar o assinante.",
      });
    }
  });

  app.post("/admin/subscribers/:subscriberId/resend-welcome", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const result = await adminSubscribersService.resendSubscriberWelcome(
        String(req.params.subscriberId ?? ""),
      );
      const emailSent = String(result?.email?.status || "").toLowerCase() === "sent";
      const whatsappSent = String(result?.whatsapp?.status || "").toLowerCase() === "sent";
      return res.status(200).json({
        ok: true,
        emailSent,
        whatsappSent,
        bothSent: emailSent && whatsappSent,
        message:
          emailSent && whatsappSent
            ? "Mensagem de boas-vindas reenviada no WhatsApp e e-mail"
            : undefined,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível reenviar as boas-vindas.";
      const status = message.includes("não encontrado") ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  });

  app.get("/admin/coupons", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    return res.status(200).json({ items: couponService.listPublicCoupons() });
  });

  app.post("/admin/coupons", (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    try {
      const body = req.body as Record<string, unknown>;
      const validityMode = String(body.validityMode ?? "").trim() as
        | "12h"
        | "24h"
        | "custom"
        | "lifetime";
      const coupon = couponService.createCoupon({
        alias: body.alias !== undefined ? String(body.alias) : undefined,
        discountPercent: parseWabaCouponDiscountPercent(body.discountPercent),
        validityMode,
        validUntil: body.validUntil !== undefined ? String(body.validUntil) : undefined,
        createdByEmail: auth.email,
        maxRedemptions:
          body.maxRedemptions !== undefined ? Number(body.maxRedemptions) : undefined,
      });
      return res.status(201).json({ ok: true, coupon });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível criar o cupom.",
      });
    }
  });

  app.patch("/admin/coupons/:couponId/deactivate", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const coupon = couponService.deactivateCoupon(String(req.params.couponId ?? ""));
      return res.status(200).json({ ok: true, coupon });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível desativar o cupom.",
      });
    }
  });

  app.post("/admin/bonus-envios", (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    try {
      const body = req.body as Record<string, unknown>;
      const validityMode = String(body.validityMode ?? "").trim() as BonusEnviosValidityMode;
      const result = adminBonusEnviosService.grant({
        subscriberId: body.subscriberId !== undefined ? String(body.subscriberId) : undefined,
        email: body.email !== undefined ? String(body.email) : undefined,
        shipmentCount: Number(body.shipmentCount ?? body.quantity ?? 0),
        apiKind: String(body.apiKind ?? ""),
        validityMode,
        validUntil: body.validUntil !== undefined ? String(body.validUntil) : undefined,
        createdByEmail: auth.email,
      });
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível creditar os envios.",
      });
    }
  });

  app.get("/admin/bonus-envios", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    return res.status(200).json({ items: adminBonusEnviosService.listPublicGrants() });
  });

  app.patch("/admin/bonus-envios/:grantId/deactivate", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const item = adminBonusEnviosService.deactivateGrant(String(req.params.grantId ?? ""));
      return res.status(200).json({ ok: true, item });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível desativar o bônus.",
      });
    }
  });

  app.get("/admin/instances/lookup", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const phone = String(req.query.phone || "").trim();
      const items = await adminInstancesService.lookupByPhone(phone);
      return res.status(200).json({ items });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível localizar a instância.",
      });
    }
  });

  app.post("/admin/instances/transfer-owner", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const result = await adminInstancesService.transferOwner({
        instanceName: body.instanceName !== undefined ? String(body.instanceName) : undefined,
        phone: body.phone !== undefined ? String(body.phone) : undefined,
        targetEmail: String(body.targetEmail || ""),
      });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível transferir a instância.",
      });
    }
  });

  app.post("/admin/subscribers/promote-from-v02", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const result = adminSubscriberPromoteService.promoteFromV02Bundle(body as any);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível promover o assinante.",
      });
    }
  });

  app.post("/admin/master/promote-from-v02", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const result = adminMasterPromoteService.promoteFromV02Bundle(body as any);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível promover o master.",
      });
    }
  });

  app.get("/admin/financeiro/overview", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    return res.status(200).json(await adminFinanceiroService.getOverview());
  });

  app.get("/admin/financeiro/asaas-monitor/status", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      return res.status(200).json(await getAsaasIntegrationMonitorStatus());
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível consultar o monitor Asaas.",
      });
    }
  });

  app.post("/admin/financeiro/asaas-monitor/run", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const forceAlert =
        String(req.query.forceAlert ?? req.body?.forceAlert ?? "")
          .trim()
          .toLowerCase() === "1" ||
        String(req.query.forceAlert ?? req.body?.forceAlert ?? "")
          .trim()
          .toLowerCase() === "true";
      const result = await runAsaasIntegrationMonitorCheck({
        forceAlert,
        skipState: forceAlert,
      });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível executar o monitor Asaas.",
      });
    }
  });

  app.post("/admin/financeiro/asaas-monitor/test-alert", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const alerts = await sendAsaasIntegrationTestAlert();
      return res.status(200).json({ ok: true, test: true, alerts });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível enviar alerta de teste.",
      });
    }
  });

  app.get("/admin/infra/uptime-monitor/status", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      return res.status(200).json(await getUptimeMonitorStatus());
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível ler o status do monitor.",
      });
    }
  });

  app.get("/admin/infra/uptime-monitor/lights", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const fresh = ["1", "true"].includes(String(req.query.fresh ?? "").trim().toLowerCase());
      return res.status(200).json(await getUptimeLights({ fresh }));
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível ler as luzes do monitor.",
      });
    }
  });

  app.post("/admin/infra/uptime-monitor/run", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const forceAlert =
        ["1", "true"].includes(
          String(req.query.forceAlert ?? req.body?.forceAlert ?? "").trim().toLowerCase(),
        );
      const result = await runUptimeMonitorCheck({ forceAlert, skipState: forceAlert });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível executar o monitor de uptime.",
      });
    }
  });

  app.post("/admin/infra/uptime-monitor/test-alert", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const alerts = await sendUptimeMonitorTestAlert();
      return res.status(200).json({ ok: true, test: true, alerts });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível enviar alerta de teste.",
      });
    }
  });

  app.post("/admin/infra/uptime-monitor/diagnose", async (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    if (!isUptimeDiagnosticMasterEmail(auth.email)) {
      return res.status(403).json({
        error: "Diagnóstico de uptime restrito ao e-mail walkup@walkuptec.com.br.",
      });
    }
    try {
      const body = req.body as Record<string, unknown>;
      const targetKey = String(body.targetKey ?? "").trim();
      const execute =
        ["1", "true"].includes(String(body.execute ?? "").trim().toLowerCase());
      const result = await diagnoseUptimeTarget(targetKey, { execute });
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível executar o diagnóstico.";
      const status = message.includes("inválido") || message.includes("inválida") ? 400 : 500;
      return res.status(status).json({ error: message });
    }
  });

  app.get("/admin/financeiro/orders", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const limit = Number(req.query.limit ?? 10);
    const offset = Number(req.query.offset ?? 0);
    return res.status(200).json(
      adminFinanceiroService.listOrders({
        limit: Number.isFinite(limit) ? limit : 10,
        offset: Number.isFinite(offset) ? offset : 0,
      }),
    );
  });

  app.get("/admin/financeiro/split-config", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    return res.status(200).json({ config: financeiroSplitService.getConfig() });
  });

  app.put("/admin/financeiro/split-config", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const config = financeiroSplitService.saveConfig({
        version: 2,
        suppliers: body.suppliers as any,
        participants: body.participants as any,
        updatedAt: new Date().toISOString(),
      });
      return res.status(200).json({ ok: true, config });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível salvar o split.",
      });
    }
  });

  app.get("/admin/financeiro/split-settlements", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const rawLimit = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(500, Math.floor(rawLimit))) : 100;
    return res.status(200).json({
      items: financeiroSplitService.listSettlements(limit),
      payoutEnabled: financeiroSplitService.isPayoutEnabled(),
    });
  });

  app.post("/admin/financeiro/split-backfill", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const limit = Number(body.limit ?? 200);
      const result = await financeiroSplitService.backfillUnsettledPaidOrders(
        Number.isFinite(limit) ? limit : 200,
      );
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível processar o backfill.",
      });
    }
  });

  app.post("/admin/financeiro/split-settlements/:orderId/payout", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const settlement = await financeiroSplitService.retryPayoutForOrder(req.params.orderId);
      if (!settlement) {
        return res.status(404).json({ error: "Split não encontrado para este pedido." });
      }
      return res.status(200).json({ ok: true, settlement });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível executar o repasse.",
      });
    }
  });

  app.post(
    "/admin/financeiro/split-settlements/:orderId/lines/:participantId/payout",
    async (req, res) => {
      if (!rejectNonMaster(req, res)) return;
      try {
        const settlement = await financeiroSplitService.retryPayoutLineForOrder(
          req.params.orderId,
          req.params.participantId,
        );
        if (!settlement) {
          return res.status(404).json({ error: "Split não encontrado para este pedido." });
        }
        return res.status(200).json({ ok: true, settlement });
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Não foi possível refazer o PIX desta linha.",
        });
      }
    },
  );

  app.get(
    "/admin/financeiro/split-settlements/:orderId/lines/:participantId/receipt",
    async (req, res) => {
      if (!rejectNonMaster(req, res)) return;
      try {
        const receipt = await financeiroSplitService.getSplitLineReceiptUrl(
          req.params.orderId,
          req.params.participantId,
        );
        if (!receipt?.url) {
          return res.status(404).json({ error: "Comprovante PIX indisponível para esta linha." });
        }
        return res.status(200).json({ ok: true, url: receipt.url });
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Não foi possível obter o comprovante.",
        });
      }
    },
  );

  app.post("/admin/financeiro/split-payouts/process-pending", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const limit = Number(body.limit ?? 50);
      const result = await financeiroSplitService.processPendingPayouts(
        Number.isFinite(limit) ? limit : 50,
      );
      return res.status(200).json({ ok: true, ...result, payoutEnabled: financeiroSplitService.isPayoutEnabled() });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível processar repasses pendentes.",
      });
    }
  });

  app.get("/admin/menus", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const items = adminUsersService.listMenus();
    return res.status(200).json({ items });
  });

  app.get("/admin/users", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const items = adminUsersService.listUsers();
    return res.status(200).json({ items });
  });

  app.post("/admin/users", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const user = adminUsersService.createUser({
        fullName: String(body.fullName ?? body.name ?? ""),
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        whatsapp: body.whatsapp,
        role: String(body.role ?? ""),
        menuPermissions: body.menuPermissions,
        operacionalDispatchesApi: body.operacionalDispatchesApi,
        operacionalSegment: body.operacionalSegment,
        masterUnlimitedCredits: body.masterUnlimitedCredits,
        masterSplitSuppliers: body.masterSplitSuppliers,
        masterSplitProfits: body.masterSplitProfits,
      });
      return res.status(201).json({ ok: true, user });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível criar o usuário.",
      });
    }
  });

  app.patch("/admin/users/:id", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const user = adminUsersService.updateUser(req.params.id, {
        fullName: body.fullName !== undefined ? String(body.fullName) : undefined,
        email: body.email !== undefined ? String(body.email) : undefined,
        password: body.password !== undefined ? String(body.password) : undefined,
        whatsapp: body.whatsapp,
        menuPermissions: body.menuPermissions,
        operacionalDispatchesApi: body.operacionalDispatchesApi,
        operacionalSegment: body.operacionalSegment,
        masterUnlimitedCredits: body.masterUnlimitedCredits,
        masterSplitSuppliers: body.masterSplitSuppliers,
        masterSplitProfits: body.masterSplitProfits,
      });
      return res.status(200).json({ ok: true, user });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível atualizar o usuário.",
      });
    }
  });

  app.patch("/admin/users/:id/menus", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const user = adminUsersService.updateUserMenuPermissions(
        req.params.id,
        body.menuPermissions,
      );
      return res.status(200).json({ ok: true, user });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível atualizar os menus.",
      });
    }
  });

  app.delete("/admin/users/:id", (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    try {
      adminUsersService.deleteUser(req.params.id, auth.email);
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível remover o usuário.",
      });
    }
  });

  app.get("/admin/master-menu-badges", (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    try {
      const payload = adminMasterMenuBadgesService.getBadgesPayloadForMaster(auth.email);
      return res.status(200).json(payload);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar os avisos do menu.",
      });
    }
  });

  app.post("/admin/master-menu-badges/seen", (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    const menuKey = String((req.body as Record<string, unknown>)?.menuKey ?? "").trim() as MasterMenuBadgeKey;
    if (!MASTER_MENU_BADGE_KEYS.includes(menuKey)) {
      return res.status(400).json({ error: "Menu inválido." });
    }
    try {
      adminMasterMenuBadgesService.markSeen(auth.email, menuKey);
      const payload = adminMasterMenuBadgesService.getBadgesPayloadForMaster(auth.email);
      return res.status(200).json({ ok: true, ...payload });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível atualizar o aviso do menu.",
      });
    }
  });

  app.get("/admin/support/tickets", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const bucket = String(req.query.bucket || "open").trim().toLowerCase() === "closed" ? "closed" : "open";
    return res.status(200).json(adminSupportService.listTickets(bucket));
  });

  app.get("/admin/support/tickets/:ticketId", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const ticket = adminSupportService.getTicket(String(req.params.ticketId || "").trim());
    if (!ticket) {
      return res.status(404).json({ error: "Chamado não encontrado." });
    }
    return res.status(200).json({ ticket });
  });

  app.patch("/admin/support/tickets/:ticketId", (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    const body = req.body as Record<string, unknown>;
    const statusRaw = String(body.status ?? "").trim().toLowerCase();
    const status = statusRaw === "closed" ? "closed" : statusRaw === "open" ? "open" : undefined;
    try {
      const ticket = adminSupportService.updateTicket(auth.email, String(req.params.ticketId || "").trim(), {
        masterResponse: body.masterResponse !== undefined ? String(body.masterResponse) : undefined,
        status,
      });
      return res.status(200).json({ ticket });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o chamado.";
      const statusCode = message.includes("não encontrado") ? 404 : 400;
      return res.status(statusCode).json({ error: message });
    }
  });

  app.get("/admin/support/tickets/:ticketId/attachments/:attachmentId", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const resolved = adminSupportService.resolveAttachmentFile(
      String(req.params.ticketId || "").trim(),
      String(req.params.attachmentId || "").trim(),
    );
    if (!resolved) {
      return res.status(404).json({ error: "Anexo não encontrado." });
    }
    res.type(resolved.attachment.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${resolved.attachment.fileName.replace(/"/g, "")}"`,
    );
    return res.sendFile(path.resolve(resolved.absolutePath));
  });

  app.post("/admin/push/review", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body as Record<string, unknown>;
      const result = await adminPushService.reviewMessage({
        title: String(body.title || "").trim(),
        text: String(body.text || "").trim(),
      });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível revisar a mensagem.",
      });
    }
  });

  app.post("/admin/push/upload-image", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    uploadPushImage.single("image")(req, res, (err) => {
      if (err) {
        const message =
          err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
            ? "Imagem maior que 5 MB."
            : err instanceof Error
              ? err.message
              : "Falha no upload da imagem.";
        return res.status(400).json({ error: message });
      }
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Selecione uma imagem para enviar." });
      }
      try {
        const image = adminPushService.uploadImage(file);
        return res.status(200).json({ image });
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Não foi possível salvar a imagem.",
        });
      }
    });
  });

  app.post("/admin/push/send", async (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    try {
      const body = req.body as Record<string, unknown>;
      const audiences = Array.isArray(body.audiences) ? body.audiences : [];
      const userRoles = Array.isArray(body.userRoles) ? body.userRoles : [];
      const imageRaw = body.image && typeof body.image === "object" ? (body.image as Record<string, unknown>) : null;
      const result = await adminPushService.publishMessage({
        title: String(body.title || "").trim(),
        originalText: String(body.originalText || "").trim(),
        reviewedText: String(body.reviewedText || "").trim(),
        audiences: audiences as never[],
        userRoles: userRoles as never[],
        createdByEmail: auth.email,
        image: imageRaw?.id
          ? {
              id: String(imageRaw.id || "").trim(),
              fileName: String(imageRaw.fileName || "imagem").trim(),
              mimeType: String(imageRaw.mimeType || "image/jpeg").trim(),
              sizeBytes: Number(imageRaw.sizeBytes) || 0,
            }
          : null,
      });
      if (result.deduplicated) {
        return res.status(200).json({
          message: result.message,
          deduplicated: true,
        });
      }
      res.status(202).json({
        message: result.message,
        deduplicated: false,
        accepted: true,
      });
      const messageId = String(result.message?.id || "").trim();
      const fingerprint = String(result.fingerprint || "").trim();
      if (messageId && fingerprint) {
        setImmediate(() => {
          adminPushService.deliverMessage(messageId, fingerprint);
        });
      }
      return;
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível enviar o push.",
      });
    }
  });

  app.get("/admin/push/history", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    return res.status(200).json({ items: adminPushService.listHistory(limit) });
  });

  app.get("/admin/push/messages/:id", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const message = adminPushService.getMessageById(String(req.params.id || "").trim());
    if (!message) {
      return res.status(404).json({ error: "Push não encontrado." });
    }
    return res.status(200).json({ message });
  });

  app.get("/admin/push/community-config", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const payload = await adminPushService.loadCommunityConfigForAdmin();
      return res.status(200).json(payload);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar config da comunidade.",
      });
    }
  });

  app.put("/admin/push/community-config", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    const body = req.body as Record<string, unknown>;
    const config = adminPushService.saveCommunityConfig({
      communityInviteLink:
        body.communityInviteLink !== undefined ? String(body.communityInviteLink) : undefined,
      communityAnnouncementGroupJid:
        body.communityAnnouncementGroupJid !== undefined
          ? String(body.communityAnnouncementGroupJid)
          : undefined,
      communityEvoInstance:
        body.communityEvoInstance !== undefined ? String(body.communityEvoInstance) : undefined,
    });
    return res.status(200).json({ config });
  });

  app.get("/admin/infra/cpu/dashboard", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    if (!vpsCpuMonitorService.isEnabled()) {
      return res.status(503).json({ error: "Monitor CPU desativado neste ambiente." });
    }
    try {
      const range = String(req.query.range ?? "1h");
      return res.status(200).json(await vpsCpuMonitorService.getDashboard(range));
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar o monitor CPU.",
      });
    }
  });

  app.get("/admin/infra/cpu/alert-status", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    if (!vpsCpuMonitorService.isEnabled()) {
      return res.status(200).json({ active: false, alert: null });
    }
    try {
      return res.status(200).json(await vpsCpuMonitorService.getAlertStatus());
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível verificar alerta CPU.",
      });
    }
  });

  /** Espelho de /app/data → V02 local (somente master). Sem .env/segredos. */
  app.get("/admin/infra/data-snapshot", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      return res.status(200).json(buildWabaDataSnapshot());
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível gerar o snapshot de dados.",
      });
    }
  });

  app.get("/admin/infra/system-logs/dashboard", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const motivosRaw = String(req.query.motivos ?? "").trim();
      const motivos = motivosRaw
        ? motivosRaw
            .split(",")
            .map((item) => item.trim())
            .filter((item): item is SystemLogMotivo =>
              (SYSTEM_LOG_MOTIVOS as readonly string[]).includes(item),
            )
        : undefined;
      const filters: SystemConnectionLogFilters = {
        preset: (String(req.query.preset || "month") as SystemConnectionLogFilters["preset"]) || "month",
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
        status: (String(req.query.status || "all") as SystemConnectionLogFilters["status"]) || "all",
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        motivos,
      };
      return res.status(200).json(await systemConnectionLogService.getDashboard(filters));
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar Logs Sistema.",
      });
    }
  });

  app.get("/admin/infra/system-logs/export", async (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const motivosRaw = String(req.query.motivos ?? "").trim();
      const motivos = motivosRaw
        ? motivosRaw
            .split(",")
            .map((item) => item.trim())
            .filter((item): item is SystemLogMotivo =>
              (SYSTEM_LOG_MOTIVOS as readonly string[]).includes(item),
            )
        : undefined;
      const filters: SystemConnectionLogFilters = {
        preset: (String(req.query.preset || "month") as SystemConnectionLogFilters["preset"]) || "month",
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
        status: (String(req.query.status || "all") as SystemConnectionLogFilters["status"]) || "all",
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        motivos,
      };
      const rows = await systemConnectionLogService.exportRows(filters);
      return res.status(200).json({ rows, generatedAt: new Date().toISOString() });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível exportar Logs Sistema.",
      });
    }
  });
};
