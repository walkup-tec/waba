"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaIndicatorRoutes = void 0;
const waba_staff_menu_auth_1 = require("../auth/waba-staff-menu-auth");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_admin_bonus_envios_service_1 = require("../admin/waba-admin-bonus-envios.service");
const waba_operacional_campanhas_service_1 = require("../admin/waba-operacional-campanhas.service");
const waba_mail_delivery_1 = require("../mail/waba-mail-delivery");
const waba_indicator_service_1 = require("./waba-indicator.service");
const indicatorService = new waba_indicator_service_1.WabaIndicatorService();
const systemUserService = new waba_system_user_service_1.WabaSystemUserService();
const bonusService = new waba_admin_bonus_envios_service_1.WabaAdminBonusEnviosService();
const campanhasService = new waba_operacional_campanhas_service_1.WabaOperacionalCampanhasService();
const rejectMasterIndicadores = (req, res) => (0, waba_staff_menu_auth_1.rejectUnlessStaffMenu)(req, res, "admin-indicadores");
const rejectIndicadorMenu = (req, res, menuId) => {
    const auth = (0, waba_staff_menu_auth_1.rejectUnlessStaffMenu)(req, res, menuId);
    if (!auth)
        return null;
    if (auth.role !== "indicador") {
        res.status(403).json({ error: "Área restrita ao perfil Indicador." });
        return null;
    }
    return auth;
};
const actorFromAuth = (email) => {
    const user = systemUserService.getByEmail(email);
    return { userId: user?.id ?? "", email };
};
const registerWabaIndicatorRoutes = (app) => {
    app.get("/admin/indicadores", (req, res) => {
        const auth = rejectMasterIndicadores(req, res);
        if (!auth)
            return;
        return res.status(200).json({ items: indicatorService.listForMaster() });
    });
    app.get("/admin/indicadores/commissions", (req, res) => {
        const auth = rejectMasterIndicadores(req, res);
        if (!auth)
            return;
        const query = req.query;
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
        if (!auth)
            return;
        return res.status(200).json({ items: indicatorService.listAllLinkedSubscribersForMaster() });
    });
    app.get("/admin/indicadores/:id", (req, res) => {
        const auth = rejectMasterIndicadores(req, res);
        if (!auth)
            return;
        try {
            return res.status(200).json({ indicator: indicatorService.getForMaster(String(req.params.id ?? "")) });
        }
        catch (error) {
            return res.status(404).json({
                error: error instanceof Error ? error.message : "Indicador não encontrado.",
            });
        }
    });
    app.post("/admin/indicadores", (req, res) => {
        const auth = rejectMasterIndicadores(req, res);
        if (!auth)
            return;
        try {
            const body = (req.body ?? {});
            const indicator = indicatorService.createForMaster({
                fullName: String(body.fullName ?? ""),
                email: String(body.email ?? ""),
                password: String(body.password ?? ""),
                whatsapp: body.whatsapp,
                cpfCnpj: body.cpfCnpj,
                pixKey: String(body.pixKey ?? ""),
                pixKeyType: body.pixKeyType,
                spreadCentsPerSend: body.spreadCentsPerSend ?? body.spread,
                status: body.status,
            }, actorFromAuth(auth.email));
            return res.status(201).json({ ok: true, indicator });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível cadastrar o indicador.",
            });
        }
    });
    app.patch("/admin/indicadores/:id", (req, res) => {
        const auth = rejectMasterIndicadores(req, res);
        if (!auth)
            return;
        try {
            const body = (req.body ?? {});
            const indicator = indicatorService.updateForMaster(String(req.params.id ?? ""), {
                fullName: body.fullName !== undefined ? String(body.fullName) : undefined,
                email: body.email !== undefined ? String(body.email) : undefined,
                password: body.password !== undefined ? String(body.password) : undefined,
                whatsapp: body.whatsapp,
                cpfCnpj: body.cpfCnpj,
                pixKey: body.pixKey !== undefined ? String(body.pixKey) : undefined,
                pixKeyType: body.pixKeyType,
                spreadCentsPerSend: body.spreadCentsPerSend ?? body.spread,
                status: body.status,
            }, actorFromAuth(auth.email));
            return res.status(200).json({ ok: true, indicator });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível atualizar o indicador.",
            });
        }
    });
    app.patch("/admin/subscribers/:subscriberId/indicator", (req, res) => {
        const auth = rejectMasterIndicadores(req, res);
        if (!auth)
            return;
        try {
            const body = (req.body ?? {});
            const indicatorUserId = body.indicatorUserId === null || body.indicatorUserId === ""
                ? null
                : String(body.indicatorUserId ?? "");
            const subscriber = indicatorService.linkSubscriberForMaster(String(req.params.subscriberId ?? ""), indicatorUserId, actorFromAuth(auth.email));
            return res.status(200).json({ ok: true, subscriber });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível vincular o assinante.",
            });
        }
    });
    app.get("/indicador/dashboard", (req, res) => {
        const auth = rejectIndicadorMenu(req, res, "indicador-dashboard");
        if (!auth)
            return;
        try {
            const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
            return res.status(200).json(indicatorService.dashboard(indicatorUserId));
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível carregar o dashboard.",
            });
        }
    });
    app.get("/indicador/subscribers", (req, res) => {
        const auth = rejectIndicadorMenu(req, res, "indicador-assinantes");
        if (!auth)
            return;
        try {
            const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
            return res.status(200).json({ items: indicatorService.listSubscribersForIndicator(indicatorUserId) });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível listar assinantes.",
            });
        }
    });
    app.post("/indicador/subscribers", async (req, res) => {
        const auth = rejectIndicadorMenu(req, res, "indicador-assinantes");
        if (!auth)
            return;
        try {
            const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
            const body = (req.body ?? {});
            const password = String(body.password ?? "");
            const subscriber = indicatorService.createSubscriberForIndicator(indicatorUserId, {
                email: String(body.email ?? ""),
                password,
                fullName: String(body.fullName ?? body.name ?? ""),
                whatsapp: String(body.whatsapp ?? ""),
                phone: String(body.phone ?? body.whatsapp ?? ""),
                cpfCnpj: String(body.cpfCnpj ?? ""),
                segment: body.segment,
            }, actorFromAuth(auth.email));
            const notifications = await (0, waba_mail_delivery_1.deliverSubscriberWelcomeNotifications)({
                email: subscriber.email,
                fullName: subscriber.fullName,
                password,
                whatsapp: subscriber.whatsapp,
                phone: subscriber.phone,
                cpfCnpj: subscriber.cpfCnpj,
            });
            return res.status(201).json({ ok: true, subscriber, notifications });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível cadastrar o assinante.",
            });
        }
    });
    app.get("/indicador/subscribers/:id", (req, res) => {
        const auth = rejectIndicadorMenu(req, res, "indicador-assinantes");
        if (!auth)
            return;
        try {
            const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
            const subscriber = indicatorService.assertOwnsSubscriber(indicatorUserId, String(req.params.id ?? ""));
            const items = indicatorService.listSubscribersForIndicator(indicatorUserId);
            return res.status(200).json({ subscriber: items.find((item) => item.id === subscriber.id) });
        }
        catch (error) {
            return res.status(404).json({
                error: error instanceof Error ? error.message : "Assinante não encontrado.",
            });
        }
    });
    app.post("/indicador/subscribers/:id/bonus-envios", (req, res) => {
        const auth = rejectIndicadorMenu(req, res, "indicador-assinantes");
        if (!auth)
            return;
        try {
            const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
            const subscriberId = String(req.params.id ?? "");
            const body = (req.body ?? {});
            const shipmentCount = Number(body.shipmentCount ?? body.quantity ?? 0);
            indicatorService.assertIndicatorBonusGrant(indicatorUserId, subscriberId, shipmentCount);
            const result = bonusService.grant({
                subscriberId,
                shipmentCount,
                apiKind: String(body.apiKind ?? "oficial"),
                validityMode: String(body.validityMode ?? "lifetime"),
                validUntil: body.validUntil !== undefined ? String(body.validUntil) : undefined,
                createdByEmail: auth.email,
                applyIndicatorBonusCap: true,
            });
            return res.status(201).json(result);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível conceder o bônus.",
            });
        }
    });
    app.get("/indicador/campanhas", (req, res) => {
        const auth = rejectIndicadorMenu(req, res, "indicador-campanhas");
        if (!auth)
            return;
        const items = campanhasService.listCampaigns({ email: auth.email, role: "indicador" });
        return res.status(200).json({ items });
    });
    app.get("/indicador/campanhas/:id", (req, res) => {
        const auth = rejectIndicadorMenu(req, res, "indicador-campanhas");
        if (!auth)
            return;
        try {
            const detail = campanhasService.getCampaignDetail(String(req.params.id ?? ""), {
                email: auth.email,
                role: "indicador",
            });
            if (!detail)
                return res.status(404).json({ error: "Campanha não encontrada." });
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
        }
        catch (error) {
            return res.status(404).json({
                error: error instanceof Error ? error.message : "Campanha não encontrada.",
            });
        }
    });
    const rejectIndicadorCampaignMutation = (_req, res) => res.status(403).json({ error: "Indicador pode apenas consultar campanhas, sem ações operacionais." });
    app.post("/indicador/campanhas/:id/iniciar", rejectIndicadorCampaignMutation);
    app.put("/indicador/campanhas/:id/relatorio", rejectIndicadorCampaignMutation);
    app.post("/indicador/campanhas/:id/bm-inoperante", rejectIndicadorCampaignMutation);
    app.post("/indicador/campanhas/:id/atribuir", rejectIndicadorCampaignMutation);
    app.post("/indicador/campanhas/:id/reportar-erro", rejectIndicadorCampaignMutation);
    app.get("/indicador/financeiro", (req, res) => {
        const auth = rejectIndicadorMenu(req, res, "indicador-financeiro");
        if (!auth)
            return;
        try {
            const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
            const query = req.query;
            return res.status(200).json(indicatorService.financeSummary(indicatorUserId, {
                status: query.status !== undefined ? String(query.status) : undefined,
                subscriberId: query.subscriberId !== undefined ? String(query.subscriberId) : undefined,
                from: query.from !== undefined ? String(query.from) : undefined,
                to: query.to !== undefined ? String(query.to) : undefined,
            }));
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível carregar o financeiro.",
            });
        }
    });
    app.get("/indicador/financeiro/:id/comprovante", (req, res) => {
        const auth = rejectIndicadorMenu(req, res, "indicador-financeiro");
        if (!auth)
            return;
        try {
            const indicatorUserId = indicatorService.requireIndicatorUserIdByEmail(auth.email);
            const receipt = indicatorService.getReceiptForIndicator(indicatorUserId, String(req.params.id ?? ""));
            return res.status(200).json({ ok: true, ...receipt });
        }
        catch (error) {
            return res.status(404).json({
                error: error instanceof Error ? error.message : "Comprovante não encontrado.",
            });
        }
    });
};
exports.registerWabaIndicatorRoutes = registerWabaIndicatorRoutes;
