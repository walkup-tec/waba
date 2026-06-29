import type { Express } from "express";
import { resolveWabaRequestAuth } from "../auth/waba-request-auth";
import { wabaRequireAuthMiddleware } from "../auth/waba-auth.routes";
import { listPushAlertsForAuth, dismissPushAlert } from "./waba-push-delivery.service";

export const registerWabaPushRoutes = (app: Express) => {
  app.get("/push/alerts", wabaRequireAuthMiddleware, (req, res) => {
    try {
      const auth = resolveWabaRequestAuth(req);
      const items = listPushAlertsForAuth(auth);
      return res.status(200).json({ items });
    } catch (error) {
      console.error("GET /push/alerts", error);
      return res.status(500).json({ error: "Não foi possível carregar alertas." });
    }
  });

  app.post("/push/alerts/:id/dismiss", wabaRequireAuthMiddleware, (req, res) => {
    try {
      const auth = resolveWabaRequestAuth(req);
      const ok = dismissPushAlert(String(req.params.id || ""), auth.email || "");
      if (!ok) {
        return res.status(404).json({ error: "Alerta não encontrado." });
      }
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("POST /push/alerts/:id/dismiss", error);
      return res.status(500).json({ error: "Não foi possível dispensar o alerta." });
    }
  });
};
