import type { Express, Request, Response } from "express";
import { resolveWabaRequestAuth } from "../../auth/waba-request-auth";
import { WabaLeadsCnpjService } from "./waba-leads-cnpj.service";

const service = new WabaLeadsCnpjService();

const rejectNonMaster = (req: Request, res: Response) => {
  const auth = resolveWabaRequestAuth(req);
  if (auth.role !== "master") {
    res.status(403).json({ error: "Área restrita ao usuário master." });
    return null;
  }
  return auth;
};

export const registerWabaLeadsCnpjRoutes = (app: Express) => {
  // Pipeline 1 Excel/dia: retoma jobs e agenda continuação a partir do pool.
  try {
    service.resumeDailyPipelinesAfterBoot();
  } catch {
    /* não derruba o boot se o resume falhar */
  }

  app.get("/admin/marketing/leads-cnpj", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const history = service.listHistory();
      return res.status(200).json(history);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível listar as listas.",
      });
    }
  });

  app.get("/admin/marketing/leads-cnpj/:id", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const item = service.getById(String(req.params.id || ""));
      if (!item) return res.status(404).json({ error: "Lista não encontrada." });
      return res.status(200).json({ item });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar a lista.",
      });
    }
  });

  app.post("/admin/marketing/leads-cnpj", (req, res) => {
    const auth = rejectNonMaster(req, res);
    if (!auth) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const summary = service.createAndStart({
        name: String(body.name || ""),
        source: body.source === "manual" ? "manual" : "portal",
        filters: body.filters,
        manualCnpjs: body.manualCnpjs ?? body.cnpjs ?? body.cnpjText,
        createdByEmail: auth.email,
      });
      return res.status(202).json({ item: summary });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível criar a lista.",
      });
    }
  });

  app.get("/admin/marketing/leads-cnpj/:id/download", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const id = String(req.params.id || "");
      const download = service.getDownload(id);
      if (!download) {
        return res.status(404).json({ error: "Arquivo ainda não disponível para download." });
      }
      service.markDownloaded(id);
      return res.download(download.filePath, download.downloadName);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível baixar o arquivo.",
      });
    }
  });

  app.post("/admin/marketing/leads-cnpj/:id/downloaded", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const item = service.markDownloaded(String(req.params.id || ""));
      if (!item) return res.status(404).json({ error: "Lista não encontrada ou sem Excel." });
      return res.status(200).json({ item });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível marcar o download.",
      });
    }
  });

  app.post("/admin/marketing/leads-cnpj/:id/finalize-day", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const item = service.finalizeEnrichDayNow(String(req.params.id || ""), {
        startNextNow: body.startNextNow !== false,
      });
      return res.status(200).json({ item });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível finalizar o dia.",
      });
    }
  });

  app.post("/admin/marketing/leads-cnpj/:id/resume-scrape", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const item = service.resumeIncompletePortalScrape(String(req.params.id || ""));
      return res.status(200).json({ item });
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error ? error.message : "Não foi possível retomar a raspagem do portal.",
      });
    }
  });

  app.delete("/admin/marketing/leads-cnpj/:id", (req, res) => {
    if (!rejectNonMaster(req, res)) return;
    try {
      const ok = service.deleteList(String(req.params.id || ""));
      if (!ok) return res.status(404).json({ error: "Lista não encontrada." });
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível excluir a lista.",
      });
    }
  });
};
