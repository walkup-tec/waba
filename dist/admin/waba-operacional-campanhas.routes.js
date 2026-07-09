"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaOperacionalCampanhasRoutes = void 0;
const waba_staff_menu_auth_1 = require("../auth/waba-staff-menu-auth");
const waba_operacional_campanhas_service_1 = require("./waba-operacional-campanhas.service");
const OPERACIONAL_CAMPANHAS_MENU_ID = "admin-campanhas";
const operacionalCampanhasService = new waba_operacional_campanhas_service_1.WabaOperacionalCampanhasService();
const rejectOperacionalCampanhasAccess = (req, res) => (0, waba_staff_menu_auth_1.rejectUnlessStaffMenu)(req, res, OPERACIONAL_CAMPANHAS_MENU_ID);
const registerWabaOperacionalCampanhasRoutes = (app) => {
    app.get("/admin/operacional/campanhas", (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        const items = operacionalCampanhasService.listCampaigns({
            email: auth.email,
            role: auth.role,
        });
        return res.status(200).json({ items });
    });
    app.get("/admin/operacional/campanhas/:id", (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        const detail = operacionalCampanhasService.getCampaignDetail(req.params.id, {
            email: auth.email,
            role: auth.role,
        });
        if (!detail) {
            return res.status(404).json({ error: "Campanha não encontrada." });
        }
        return res.status(200).json({ campaign: detail });
    });
    app.get("/admin/operacional/campanhas/:id/imagem", (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        const download = operacionalCampanhasService.resolveImageDownload(req.params.id, {
            email: auth.email,
            role: auth.role,
        });
        if (!download) {
            return res.status(404).json({ error: "Imagem da campanha não encontrada." });
        }
        return res.download(download.filePath, download.fileName);
    });
    app.get("/admin/operacional/campanhas/:id/planilha", (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        const download = operacionalCampanhasService.resolveSpreadsheetDownload(req.params.id, {
            email: auth.email,
            role: auth.role,
        });
        if (!download) {
            return res.status(404).json({ error: "Planilha de leads não encontrada." });
        }
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${download.fileName}"`);
        return res.status(200).send(download.buffer);
    });
    app.post("/admin/operacional/campanhas/:id/iniciar", (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        try {
            const campaign = operacionalCampanhasService.markCampaignStarted(req.params.id, {
                email: auth.email,
                role: auth.role,
            });
            return res.status(200).json({
                ok: true,
                campaignId: campaign.id,
                status: campaign.status,
                displayStatus: campaign.displayStatus,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível iniciar a campanha.";
            const status = /não encontrada|não disponível|Somente campanhas|não foi possível atualizar/i.test(message)
                ? 400
                : 500;
            if (status >= 500) {
                console.error("[operacional/campanhas/iniciar] erro:", error);
            }
            return res.status(status).json({ error: message });
        }
    });
    app.get("/admin/operacional/campanhas/:id/relatorio", (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        try {
            const report = operacionalCampanhasService.getCampaignReport(req.params.id, {
                email: auth.email,
                role: auth.role,
            });
            return res.status(200).json({ ok: true, ...report });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível carregar o relatório.",
            });
        }
    });
    app.put("/admin/operacional/campanhas/:id/relatorio", (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        try {
            const body = (req.body ?? {});
            const campaign = operacionalCampanhasService.saveCampaignReport(req.params.id, body, {
                email: auth.email,
                role: auth.role,
            });
            return res.status(200).json({ ok: true, campaign });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível salvar o relatório.",
            });
        }
    });
    app.post("/admin/operacional/campanhas/:id/bm-inoperante", async (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        try {
            const result = await operacionalCampanhasService.markBmInoperante(req.params.id, {
                email: auth.email,
                role: auth.role,
            });
            return res.status(200).json({
                ok: true,
                campaign: result.campaign,
                reassigned: result.reassigned,
                exhausted: result.exhausted,
                message: result.message,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível reatribuir a campanha.";
            const status = /não encontrada|não disponível|BM inoperante|Somente campanhas|atribuída|fornecedor/i.test(message)
                ? 400
                : 500;
            if (status >= 500) {
                console.error("[operacional/campanhas/bm-inoperante] erro:", error);
            }
            return res.status(status).json({ error: message });
        }
    });
    app.post("/admin/operacional/campanhas/:id/reenviar-email-operacional", async (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        try {
            const result = await operacionalCampanhasService.resendOperacionalNotifyEmail(req.params.id, {
                email: auth.email,
                role: auth.role,
            });
            return res.status(200).json({ ok: true, operacionalNotify: result });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível reenviar o e-mail operacional.";
            return res.status(400).json({ error: message });
        }
    });
    app.post("/admin/operacional/campanhas/:id/reportar-erro", (req, res) => {
        const auth = rejectOperacionalCampanhasAccess(req, res);
        if (!auth)
            return;
        try {
            const body = (req.body ?? {});
            const campaign = operacionalCampanhasService.reportCampaignError(req.params.id, String(body.justification ?? ""), {
                email: auth.email,
                role: auth.role,
            });
            return res.status(200).json({ ok: true, campaign });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível reportar o erro.";
            const status = /não encontrada|não disponível|Somente campanhas|já foi finalizada|foi cancelada|justificativa|não foi possível registrar/i.test(message)
                ? 400
                : 500;
            if (status >= 500) {
                console.error("[operacional/campanhas/reportar-erro] erro:", error);
            }
            return res.status(status).json({ error: message });
        }
    });
};
exports.registerWabaOperacionalCampanhasRoutes = registerWabaOperacionalCampanhasRoutes;
