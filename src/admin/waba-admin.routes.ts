import type { Express, Request, Response } from "express";
import path from "node:path";
import { rejectUnlessStaffMenu } from "../auth/waba-staff-menu-auth";
import { resolveWabaRequestAuth } from "../auth/waba-request-auth";
import { WabaFinanceiroSplitService } from "../billing/waba-financeiro-split.service";
import { WabaAdminDashboardService } from "./waba-admin-dashboard.service";
import { WabaAdminFinanceiroService } from "./waba-admin-financeiro.service";
import { WabaAdminSubscribersService } from "./waba-admin-subscribers.service";
import { WabaAdminSubscriberPromoteService } from "./waba-admin-subscriber-promote.service";
import { WabaAdminMasterPromoteService } from "./waba-admin-master-promote.service";
import { WabaAdminSupportService } from "./waba-admin-support.service";
import { WabaAdminMasterMenuBadgesService } from "./waba-admin-master-menu-badges.service";
import { MASTER_MENU_BADGE_KEYS, type MasterMenuBadgeKey } from "./waba-admin-master-menu-badges.repository";
import {
  runAsaasIntegrationMonitorCheck,
  sendAsaasIntegrationTestAlert,
  getAsaasIntegrationMonitorStatus,
} from "../monitoring/asaas-integration-monitor.service";
import { WabaAdminUsersService } from "./waba-admin-users.service";

const ADMIN_DASHBOARD_MENU_ID = "admin-dashboard";

const adminSubscribersService = new WabaAdminSubscribersService();
const adminSubscriberPromoteService = new WabaAdminSubscriberPromoteService();
const adminMasterPromoteService = new WabaAdminMasterPromoteService();
const adminUsersService = new WabaAdminUsersService();
const adminFinanceiroService = new WabaAdminFinanceiroService();
const adminDashboardService = new WabaAdminDashboardService();
const adminSupportService = new WabaAdminSupportService();
const adminMasterMenuBadgesService = new WabaAdminMasterMenuBadgesService();
const financeiroSplitService = new WabaFinanceiroSplitService();

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
    const items = adminSubscribersService.listSubscribers();
    return res.status(200).json({ items });
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
        role: String(body.role ?? ""),
        menuPermissions: body.menuPermissions,
        operacionalDispatchesApi: body.operacionalDispatchesApi,
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
        menuPermissions: body.menuPermissions,
        operacionalDispatchesApi: body.operacionalDispatchesApi,
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
      const badges = adminMasterMenuBadgesService.getBadgesForMaster(auth.email);
      return res.status(200).json({ badges });
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
      const badges = adminMasterMenuBadgesService.getBadges(auth.email);
      return res.status(200).json({ ok: true, badges });
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
};
