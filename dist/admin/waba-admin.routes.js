"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaAdminRoutes = void 0;
const node_path_1 = __importDefault(require("node:path"));
const multer_1 = __importDefault(require("multer"));
const waba_staff_menu_auth_1 = require("../auth/waba-staff-menu-auth");
const waba_request_auth_1 = require("../auth/waba-request-auth");
const waba_financeiro_split_service_1 = require("../billing/waba-financeiro-split.service");
const waba_admin_dashboard_service_1 = require("./waba-admin-dashboard.service");
const waba_admin_financeiro_service_1 = require("./waba-admin-financeiro.service");
const waba_admin_subscribers_service_1 = require("./waba-admin-subscribers.service");
const waba_admin_subscriber_promote_service_1 = require("./waba-admin-subscriber-promote.service");
const waba_admin_master_promote_service_1 = require("./waba-admin-master-promote.service");
const waba_admin_support_service_1 = require("./waba-admin-support.service");
const waba_admin_push_service_1 = require("./waba-admin-push.service");
const waba_admin_master_menu_badges_service_1 = require("./waba-admin-master-menu-badges.service");
const waba_admin_master_menu_badges_repository_1 = require("./waba-admin-master-menu-badges.repository");
const asaas_integration_monitor_service_1 = require("../monitoring/asaas-integration-monitor.service");
const waba_admin_users_service_1 = require("./waba-admin-users.service");
const waba_admin_instances_service_1 = require("./waba-admin-instances.service");
const vps_cpu_monitor_service_1 = require("../infra/vps-cpu-monitor.service");
const ADMIN_DASHBOARD_MENU_ID = "admin-dashboard";
const adminSubscribersService = new waba_admin_subscribers_service_1.WabaAdminSubscribersService();
const adminSubscriberPromoteService = new waba_admin_subscriber_promote_service_1.WabaAdminSubscriberPromoteService();
const adminMasterPromoteService = new waba_admin_master_promote_service_1.WabaAdminMasterPromoteService();
const adminUsersService = new waba_admin_users_service_1.WabaAdminUsersService();
const adminFinanceiroService = new waba_admin_financeiro_service_1.WabaAdminFinanceiroService();
const adminDashboardService = new waba_admin_dashboard_service_1.WabaAdminDashboardService();
const adminSupportService = new waba_admin_support_service_1.WabaAdminSupportService();
const adminPushService = new waba_admin_push_service_1.WabaAdminPushService();
const adminInstancesService = new waba_admin_instances_service_1.WabaAdminInstancesService();
const adminMasterMenuBadgesService = new waba_admin_master_menu_badges_service_1.WabaAdminMasterMenuBadgesService();
const financeiroSplitService = new waba_financeiro_split_service_1.WabaFinanceiroSplitService();
const vpsCpuMonitorService = new vps_cpu_monitor_service_1.VpsCpuMonitorService();
const uploadPushImage = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (String(file.mimetype || "").toLowerCase().startsWith("image/")) {
            cb(null, true);
            return;
        }
        cb(new Error("Envie apenas imagens (JPEG, PNG, WebP ou GIF)."));
    },
});
const rejectNonMaster = (req, res) => {
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    if (auth.role !== "master") {
        res.status(403).json({ error: "Área restrita ao usuário master." });
        return null;
    }
    return auth;
};
const registerWabaAdminRoutes = (app) => {
    app.get("/admin/dashboard/overview", async (req, res) => {
        const auth = (0, waba_staff_menu_auth_1.rejectUnlessStaffMenu)(req, res, ADMIN_DASHBOARD_MENU_ID);
        if (!auth)
            return;
        try {
            return res.status(200).json(await adminDashboardService.getOverview({
                role: auth.role,
                email: auth.email,
            }));
        }
        catch (error) {
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Não foi possível carregar o dashboard.",
            });
        }
    });
    app.get("/admin/subscribers", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const items = adminSubscribersService.listSubscribers();
        return res.status(200).json({ items });
    });
    app.get("/admin/instances/lookup", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const phone = String(req.query.phone || "").trim();
            const items = await adminInstancesService.lookupByPhone(phone);
            return res.status(200).json({ items });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível localizar a instância.",
            });
        }
    });
    app.post("/admin/instances/transfer-owner", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
            const result = await adminInstancesService.transferOwner({
                instanceName: body.instanceName !== undefined ? String(body.instanceName) : undefined,
                phone: body.phone !== undefined ? String(body.phone) : undefined,
                targetEmail: String(body.targetEmail || ""),
            });
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível transferir a instância.",
            });
        }
    });
    app.post("/admin/subscribers/promote-from-v02", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
            const result = adminSubscriberPromoteService.promoteFromV02Bundle(body);
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível promover o assinante.",
            });
        }
    });
    app.post("/admin/master/promote-from-v02", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
            const result = adminMasterPromoteService.promoteFromV02Bundle(body);
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível promover o master.",
            });
        }
    });
    app.get("/admin/financeiro/overview", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        return res.status(200).json(await adminFinanceiroService.getOverview());
    });
    app.get("/admin/financeiro/asaas-monitor/status", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            return res.status(200).json(await (0, asaas_integration_monitor_service_1.getAsaasIntegrationMonitorStatus)());
        }
        catch (error) {
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Não foi possível consultar o monitor Asaas.",
            });
        }
    });
    app.post("/admin/financeiro/asaas-monitor/run", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const forceAlert = String(req.query.forceAlert ?? req.body?.forceAlert ?? "")
                .trim()
                .toLowerCase() === "1" ||
                String(req.query.forceAlert ?? req.body?.forceAlert ?? "")
                    .trim()
                    .toLowerCase() === "true";
            const result = await (0, asaas_integration_monitor_service_1.runAsaasIntegrationMonitorCheck)({
                forceAlert,
                skipState: forceAlert,
            });
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Não foi possível executar o monitor Asaas.",
            });
        }
    });
    app.post("/admin/financeiro/asaas-monitor/test-alert", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const alerts = await (0, asaas_integration_monitor_service_1.sendAsaasIntegrationTestAlert)();
            return res.status(200).json({ ok: true, test: true, alerts });
        }
        catch (error) {
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Não foi possível enviar alerta de teste.",
            });
        }
    });
    app.get("/admin/financeiro/orders", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const limit = Number(req.query.limit ?? 10);
        const offset = Number(req.query.offset ?? 0);
        return res.status(200).json(adminFinanceiroService.listOrders({
            limit: Number.isFinite(limit) ? limit : 10,
            offset: Number.isFinite(offset) ? offset : 0,
        }));
    });
    app.get("/admin/financeiro/split-config", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        return res.status(200).json({ config: financeiroSplitService.getConfig() });
    });
    app.put("/admin/financeiro/split-config", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
            const config = financeiroSplitService.saveConfig({
                version: 2,
                suppliers: body.suppliers,
                participants: body.participants,
                updatedAt: new Date().toISOString(),
            });
            return res.status(200).json({ ok: true, config });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível salvar o split.",
            });
        }
    });
    app.get("/admin/financeiro/split-settlements", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const rawLimit = Number(req.query.limit ?? 100);
        const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(500, Math.floor(rawLimit))) : 100;
        return res.status(200).json({
            items: financeiroSplitService.listSettlements(limit),
            payoutEnabled: financeiroSplitService.isPayoutEnabled(),
        });
    });
    app.post("/admin/financeiro/split-backfill", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
            const limit = Number(body.limit ?? 200);
            const result = await financeiroSplitService.backfillUnsettledPaidOrders(Number.isFinite(limit) ? limit : 200);
            return res.status(200).json({ ok: true, ...result });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível processar o backfill.",
            });
        }
    });
    app.post("/admin/financeiro/split-settlements/:orderId/payout", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const settlement = await financeiroSplitService.retryPayoutForOrder(req.params.orderId);
            if (!settlement) {
                return res.status(404).json({ error: "Split não encontrado para este pedido." });
            }
            return res.status(200).json({ ok: true, settlement });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível executar o repasse.",
            });
        }
    });
    app.post("/admin/financeiro/split-settlements/:orderId/lines/:participantId/payout", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const settlement = await financeiroSplitService.retryPayoutLineForOrder(req.params.orderId, req.params.participantId);
            if (!settlement) {
                return res.status(404).json({ error: "Split não encontrado para este pedido." });
            }
            return res.status(200).json({ ok: true, settlement });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível refazer o PIX desta linha.",
            });
        }
    });
    app.get("/admin/financeiro/split-settlements/:orderId/lines/:participantId/receipt", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const receipt = await financeiroSplitService.getSplitLineReceiptUrl(req.params.orderId, req.params.participantId);
            if (!receipt?.url) {
                return res.status(404).json({ error: "Comprovante PIX indisponível para esta linha." });
            }
            return res.status(200).json({ ok: true, url: receipt.url });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível obter o comprovante.",
            });
        }
    });
    app.post("/admin/financeiro/split-payouts/process-pending", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
            const limit = Number(body.limit ?? 50);
            const result = await financeiroSplitService.processPendingPayouts(Number.isFinite(limit) ? limit : 50);
            return res.status(200).json({ ok: true, ...result, payoutEnabled: financeiroSplitService.isPayoutEnabled() });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível processar repasses pendentes.",
            });
        }
    });
    app.get("/admin/menus", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const items = adminUsersService.listMenus();
        return res.status(200).json({ items });
    });
    app.get("/admin/users", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const items = adminUsersService.listUsers();
        return res.status(200).json({ items });
    });
    app.post("/admin/users", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
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
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível criar o usuário.",
            });
        }
    });
    app.patch("/admin/users/:id", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
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
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível atualizar o usuário.",
            });
        }
    });
    app.patch("/admin/users/:id/menus", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
            const user = adminUsersService.updateUserMenuPermissions(req.params.id, body.menuPermissions);
            return res.status(200).json({ ok: true, user });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível atualizar os menus.",
            });
        }
    });
    app.delete("/admin/users/:id", (req, res) => {
        const auth = rejectNonMaster(req, res);
        if (!auth)
            return;
        try {
            adminUsersService.deleteUser(req.params.id, auth.email);
            return res.status(200).json({ ok: true });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível remover o usuário.",
            });
        }
    });
    app.get("/admin/master-menu-badges", (req, res) => {
        const auth = rejectNonMaster(req, res);
        if (!auth)
            return;
        try {
            const badges = adminMasterMenuBadgesService.getBadgesForMaster(auth.email);
            return res.status(200).json({ badges });
        }
        catch (error) {
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Não foi possível carregar os avisos do menu.",
            });
        }
    });
    app.post("/admin/master-menu-badges/seen", (req, res) => {
        const auth = rejectNonMaster(req, res);
        if (!auth)
            return;
        const menuKey = String(req.body?.menuKey ?? "").trim();
        if (!waba_admin_master_menu_badges_repository_1.MASTER_MENU_BADGE_KEYS.includes(menuKey)) {
            return res.status(400).json({ error: "Menu inválido." });
        }
        try {
            adminMasterMenuBadgesService.markSeen(auth.email, menuKey);
            const badges = adminMasterMenuBadgesService.getBadges(auth.email);
            return res.status(200).json({ ok: true, badges });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível atualizar o aviso do menu.",
            });
        }
    });
    app.get("/admin/support/tickets", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const bucket = String(req.query.bucket || "open").trim().toLowerCase() === "closed" ? "closed" : "open";
        return res.status(200).json(adminSupportService.listTickets(bucket));
    });
    app.get("/admin/support/tickets/:ticketId", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const ticket = adminSupportService.getTicket(String(req.params.ticketId || "").trim());
        if (!ticket) {
            return res.status(404).json({ error: "Chamado não encontrado." });
        }
        return res.status(200).json({ ticket });
    });
    app.patch("/admin/support/tickets/:ticketId", (req, res) => {
        const auth = rejectNonMaster(req, res);
        if (!auth)
            return;
        const body = req.body;
        const statusRaw = String(body.status ?? "").trim().toLowerCase();
        const status = statusRaw === "closed" ? "closed" : statusRaw === "open" ? "open" : undefined;
        try {
            const ticket = adminSupportService.updateTicket(auth.email, String(req.params.ticketId || "").trim(), {
                masterResponse: body.masterResponse !== undefined ? String(body.masterResponse) : undefined,
                status,
            });
            return res.status(200).json({ ticket });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível atualizar o chamado.";
            const statusCode = message.includes("não encontrado") ? 404 : 400;
            return res.status(statusCode).json({ error: message });
        }
    });
    app.get("/admin/support/tickets/:ticketId/attachments/:attachmentId", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const resolved = adminSupportService.resolveAttachmentFile(String(req.params.ticketId || "").trim(), String(req.params.attachmentId || "").trim());
        if (!resolved) {
            return res.status(404).json({ error: "Anexo não encontrado." });
        }
        res.type(resolved.attachment.mimeType);
        res.setHeader("Content-Disposition", `inline; filename="${resolved.attachment.fileName.replace(/"/g, "")}"`);
        return res.sendFile(node_path_1.default.resolve(resolved.absolutePath));
    });
    app.post("/admin/push/review", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const body = req.body;
            const result = await adminPushService.reviewMessage({
                title: String(body.title || "").trim(),
                text: String(body.text || "").trim(),
            });
            return res.status(200).json(result);
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível revisar a mensagem.",
            });
        }
    });
    app.post("/admin/push/upload-image", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        uploadPushImage.single("image")(req, res, (err) => {
            if (err) {
                const message = err instanceof multer_1.default.MulterError && err.code === "LIMIT_FILE_SIZE"
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
            }
            catch (error) {
                return res.status(400).json({
                    error: error instanceof Error ? error.message : "Não foi possível salvar a imagem.",
                });
            }
        });
    });
    app.post("/admin/push/send", async (req, res) => {
        const auth = rejectNonMaster(req, res);
        if (!auth)
            return;
        try {
            const body = req.body;
            const audiences = Array.isArray(body.audiences) ? body.audiences : [];
            const userRoles = Array.isArray(body.userRoles) ? body.userRoles : [];
            const imageRaw = body.image && typeof body.image === "object" ? body.image : null;
            const result = await adminPushService.publishMessage({
                title: String(body.title || "").trim(),
                originalText: String(body.originalText || "").trim(),
                reviewedText: String(body.reviewedText || "").trim(),
                audiences: audiences,
                userRoles: userRoles,
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
            return res.status(202).json({
                message: result.message,
                deduplicated: false,
                accepted: true,
            });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível enviar o push.",
            });
        }
    });
    app.get("/admin/push/history", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
        return res.status(200).json({ items: adminPushService.listHistory(limit) });
    });
    app.get("/admin/push/messages/:id", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const message = adminPushService.getMessageById(String(req.params.id || "").trim());
        if (!message) {
            return res.status(404).json({ error: "Push não encontrado." });
        }
        return res.status(200).json({ message });
    });
    app.get("/admin/push/community-config", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        try {
            const payload = await adminPushService.loadCommunityConfigForAdmin();
            return res.status(200).json(payload);
        }
        catch (error) {
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Não foi possível carregar config da comunidade.",
            });
        }
    });
    app.put("/admin/push/community-config", (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        const body = req.body;
        const config = adminPushService.saveCommunityConfig({
            communityInviteLink: body.communityInviteLink !== undefined ? String(body.communityInviteLink) : undefined,
            communityAnnouncementGroupJid: body.communityAnnouncementGroupJid !== undefined
                ? String(body.communityAnnouncementGroupJid)
                : undefined,
            communityEvoInstance: body.communityEvoInstance !== undefined ? String(body.communityEvoInstance) : undefined,
        });
        return res.status(200).json({ config });
    });
    app.get("/admin/infra/cpu/dashboard", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        if (!vpsCpuMonitorService.isEnabled()) {
            return res.status(503).json({ error: "Monitor CPU desativado neste ambiente." });
        }
        try {
            const range = String(req.query.range ?? "1h");
            return res.status(200).json(await vpsCpuMonitorService.getDashboard(range));
        }
        catch (error) {
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Não foi possível carregar o monitor CPU.",
            });
        }
    });
    app.get("/admin/infra/cpu/alert-status", async (req, res) => {
        if (!rejectNonMaster(req, res))
            return;
        if (!vpsCpuMonitorService.isEnabled()) {
            return res.status(200).json({ active: false, alert: null });
        }
        try {
            return res.status(200).json(await vpsCpuMonitorService.getAlertStatus());
        }
        catch (error) {
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Não foi possível verificar alerta CPU.",
            });
        }
    });
};
exports.registerWabaAdminRoutes = registerWabaAdminRoutes;
