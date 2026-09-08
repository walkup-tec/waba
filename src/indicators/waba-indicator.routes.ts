import type { Express, Request, Response } from "express";
import { rejectUnlessStaffMenu } from "../auth/waba-staff-menu-auth";
import { resolveWabaRequestAuth } from "../auth/waba-request-auth";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import { WabaAdminBonusEnviosService, type BonusEnviosValidityMode } from "../admin/waba-admin-bonus-envios.service";
import { WabaOperacionalCampanhasService } from "../admin/waba-operacional-campanhas.service";
import { deliverSubscriberWelcomeNotifications } from "../mail/waba-mail-delivery";
import { WabaIndicatorService } from "./waba-indicator.service";

const indicatorService = new WabaIndicatorService();
const systemUserService = new WabaSystemUserService();
const bonusService = new WabaAdminBonusEnviosService();
const campanhasService = new WabaOperacionalCampanhasService();

const rejectMasterIndicadores = (req: Request, res: Response) =>
  rejectUnlessStaffMenu(req, res, "admin-indicadores");

const rejectIndicadorMenu = (req: Request, res: Response, menuId: string) => {
  const auth = rejectUnlessStaffMenu(req, res, menuId);
  if (!auth) return null;
  if (auth.role !== "indicador") {
    res.status(403).json({ error: "Área restrita ao perfil Indicador." });
    return null;
  }
  return auth;
};

const actorFromAuth = (email: string) => {
  const user = systemUserService.getByEmail(email);
  return { userId: user?.id ?? "", email };
};

export const registerWabaIndicatorRoutes = (app: Express) => {
  app.get("/admin/indicadores", (req, res) => {
    const auth = rejectMasterIndicadores(req, res);
    if (!auth) return;
    return res.status(200).json({ items: indicatorService.listForMaster() });
  });

  app.get("/admin/indicadores/commissions", (req, res) => {
    const auth = rejectMasterIndicadores(req, res);
    if (!auth) return;
    const query = req.query as Record<string, unknown>;
    const items = indicatorService.listAllCommissionsForMaster({
      status: query.status !== undefined ? String(query.status) : undefined,
      indicatorUserId: query.indicatorUserId !== undefined ? String(query.indicatorUserId) : undefined,
      from: query.from !== undefined ? String(query.from) : undefined,
      to: query.to !== undefined ? String(query.to) : undefined,
    });
    const generated = items.filter((item) => item.status !== "canceled");
    return res.status(200).json({
      items,
      generatedCents: generated.reduce((sum, item) => sum + item.commissionAmountCents, 0),
      pendingCents: generated
        .filter((item) => item.status === "pending" || item.status === "processing")
        .reduce((sum, item) => sum + item.commissionAmountCents, 0),
      paidCents: generated
        .filter((item) => item.status === "paid")
        .reduce((sum, item) => sum + item.commissionAmountCents, 0),
    });
  });

  app.get("/admin/indicadores/subscribers", (req, res) => {
    const auth = rejectMasterIndicadores(req, res);
    if (!auth) return;
    return res.status(200).json({ items: indicatorService.listAllLinkedSubscribersForMaster() });
  });

  app.get("/admin/indicadores/:id", (req, res) => {
    const auth = rejectMasterIndicadores(req, res);
    if (!auth) return;
    try {
      return res.status(200).json({ indicator: indicatorService.getForMaster(String(req.params.id ?? "")) });
    } catch (error) {
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Indicador não encontrado.",
      });
    }
  });

  app.post("/admin/indicadores", (req, res) => {
    const auth = rejectMasterIndicadores(req, res);
    if (!auth) return;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const indicator = indicatorService.createForMaster(
        {
          fullName: String(body.fullName ?? ""),
          email: String(body.email ?? ""),
          password: String(body.password ?? ""),
          whatsapp: body.whatsapp,
          cpfCnpj: body.cpfCnpj,
          pixKey: String(body.pixKey ?? ""),
          pixKeyType: body.pixKeyType,
          spreadCentsPerSend: body.spreadCentsPerSend ?? body.spread,
          status: body.status,
        },
        actorFromAuth(auth.email),
      );
      return res.status(201).json({ ok: true, indicator });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível cadastrar o indicador.",
      });
    }
  });

  app.patch("/admin/indicadores/:id", (req, res) => {
    const auth = rejectMasterIndicadores(req, res);
    if (!auth) return;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const indicator = indicatorService.updateForMaster(
        String(req.params.id ?? ""),
        {
          fullName: body.fullName !== undefined ? String(body.fullName) : undefined,
          email: body.email !== undefined ? String(body.email) : undefined,
          password: body.password !== undefined ? String(body.password) : undefined,
          whatsapp: body.whatsapp,
          cpfCnpj: body.cpfCnpj,
          pixKey: body.pixKey !== undefined ? String(body.pixKey) : undefined,
          pixKeyType: body.pixKeyType,
          spreadCentsPerSend: body.spreadCentsPerSend ?? body.spread,
          status: body.status,
        },
        actorFromAuth(auth.email),
      );
      return res.status(200).json({ ok: true, indicator });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível atualizar o indicador.",
      });
    }
  });

  app.patch("/admin/subscribers/:subscriberId/indicator", (req, res) => {
    const auth = rejectMasterIndicadores(req, res);
    if (!auth) return;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const indicatorUserId =
        body.indicatorUserId === null || body.indicatorUserId === ""
          ? null
          : String(body.indicatorUserId ?? "");
      const subscriber = indicatorService.linkSubscriberForMaster(
        String(req.params.subscriberId ?? ""),
        indicatorUserId,
        actorFromAuth(auth.email),
      );
      return res.status(200).json({ ok: true, subscriber });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível vincular o assinante.",
      });
    }
  });

  app.get("/indicador/dashboard", (req, res) => {
    const auth = rejectIndicadorMenu(req, res, "indicador-dashboard");
    if (!auth) return;
    try {
      const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
      return res.status(200).json(indicatorService.dashboard(indicatorUserId));
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar o dashboard.",
      });
    }
  });

  app.get("/indicador/subscribers", (req, res) => {
    const auth = rejectIndicadorMenu(req, res, "indicador-assinantes");
    if (!auth) return;
    try {
      const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
      return res.status(200).json({ items: indicatorService.listSubscribersForIndicator(indicatorUserId) });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível listar assinantes.",
      });
    }
  });

  app.post("/indicador/subscribers", async (req, res) => {
    const auth = rejectIndicadorMenu(req, res, "indicador-assinantes");
    if (!auth) return;
    try {
      const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const password = String(body.password ?? "");
      const subscriber = indicatorService.createSubscriberForIndicator(
        indicatorUserId,
        {
          email: String(body.email ?? ""),
          password,
          fullName: String(body.fullName ?? body.name ?? ""),
          whatsapp: String(body.whatsapp ?? ""),
          phone: String(body.phone ?? body.whatsapp ?? ""),
          cpfCnpj: String(body.cpfCnpj ?? ""),
          segment: body.segment,
        },
        actorFromAuth(auth.email),
      );
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
        error: error instanceof Error ? error.message : "Não foi possível cadastrar o assinante.",
      });
    }
  });

  app.get("/indicador/subscribers/:id", (req, res) => {
    const auth = rejectIndicadorMenu(req, res, "indicador-assinantes");
    if (!auth) return;
    try {
      const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
      const subscriber = indicatorService.assertOwnsSubscriber(indicatorUserId, String(req.params.id ?? ""));
      const items = indicatorService.listSubscribersForIndicator(indicatorUserId);
      return res.status(200).json({ subscriber: items.find((item) => item.id === subscriber.id) });
    } catch (error) {
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Assinante não encontrado.",
      });
    }
  });

  app.post("/indicador/subscribers/:id/bonus-envios", (req, res) => {
    const auth = rejectIndicadorMenu(req, res, "indicador-assinantes");
    if (!auth) return;
    try {
      const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
      const subscriberId = String(req.params.id ?? "");
      const body = (req.body ?? {}) as Record<string, unknown>;
      const shipmentCount = Number(body.shipmentCount ?? body.quantity ?? 0);
      indicatorService.assertIndicatorBonusGrant(indicatorUserId, subscriberId, shipmentCount);
      const result = bonusService.grant({
        subscriberId,
        shipmentCount,
        apiKind: String(body.apiKind ?? "oficial"),
        validityMode: String(body.validityMode ?? "lifetime") as BonusEnviosValidityMode,
        validUntil: body.validUntil !== undefined ? String(body.validUntil) : undefined,
        createdByEmail: auth.email,
        applyIndicatorBonusCap: true,
      });
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível conceder o bônus.",
      });
    }
  });

  app.get("/indicador/campanhas", (req, res) => {
    const auth = rejectIndicadorMenu(req, res, "indicador-campanhas");
    if (!auth) return;
    const items = campanhasService.listCampaigns({ email: auth.email, role: "indicador" });
    return res.status(200).json({ items });
  });

  app.get("/indicador/campanhas/:id", (req, res) => {
    const auth = rejectIndicadorMenu(req, res, "indicador-campanhas");
    if (!auth) return;
    try {
      const detail = campanhasService.getCampaignDetail(String(req.params.id ?? ""), {
        email: auth.email,
        role: "indicador",
      });
      if (!detail) return res.status(404).json({ error: "Campanha não encontrada." });
      return res.status(200).json({
        campaign: {
          ...detail,
          canFillReport: false,
          canReportError: false,
          canBmInoperante: false,
          canTransferOperacional: false,
          readOnly: true,
        },
      });
    } catch (error) {
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Campanha não encontrada.",
      });
    }
  });

  const rejectIndicadorCampaignMutation = (_req: Request, res: Response) =>
    res.status(403).json({ error: "Indicador pode apenas consultar campanhas, sem ações operacionais." });

  app.post("/indicador/campanhas/:id/iniciar", rejectIndicadorCampaignMutation);
  app.put("/indicador/campanhas/:id/relatorio", rejectIndicadorCampaignMutation);
  app.post("/indicador/campanhas/:id/bm-inoperante", rejectIndicadorCampaignMutation);
  app.post("/indicador/campanhas/:id/atribuir", rejectIndicadorCampaignMutation);
  app.post("/indicador/campanhas/:id/reportar-erro", rejectIndicadorCampaignMutation);

  app.get("/indicador/financeiro", (req, res) => {
    const auth = rejectIndicadorMenu(req, res, "indicador-financeiro");
    if (!auth) return;
    try {
      const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
      const query = req.query as Record<string, unknown>;
      return res.status(200).json(
        indicatorService.financeSummary(indicatorUserId, {
          status: query.status !== undefined ? String(query.status) : undefined,
          subscriberId: query.subscriberId !== undefined ? String(query.subscriberId) : undefined,
          from: query.from !== undefined ? String(query.from) : undefined,
          to: query.to !== undefined ? String(query.to) : undefined,
        }),
      );
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar o financeiro.",
      });
    }
  });

  app.get("/indicador/financeiro/:id/comprovante", (req, res) => {
    const auth = rejectIndicadorMenu(req, res, "indicador-financeiro");
    if (!auth) return;
    try {
      const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
      const receipt = indicatorService.getReceiptForIndicator(indicatorUserId, String(req.params.id ?? ""));
      return res.status(200).json({ ok: true, ...receipt });
    } catch (error) {
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Comprovante não encontrado.",
      });
    }
  });
};
