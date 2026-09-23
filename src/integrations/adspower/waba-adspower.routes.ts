import type { Express, Request, Response } from "express";
import { resolveWabaRequestAuth } from "../../auth/waba-request-auth";
import {
  assertAdsPowerIngestAuthorized,
  wabaAdsPowerService,
} from "./waba-adspower.service";
import type { AdsPowerIngestItem } from "./waba-adspower.types";

function sendError(res: Response, error: unknown) {
  const status = Number((error as { status?: number })?.status || 400);
  const message = error instanceof Error ? error.message : "Falha AdsPower.";
  return res.status(status).json({ ok: false, error: message });
}

/** Ingest do PC com AdsPower — registrar ANTES do middleware de sessão. */
export function registerAdsPowerIngestRoute(app: Express): void {
  app.post("/integrations/adspower/ingest", (req: Request, res: Response) => {
    try {
      assertAdsPowerIngestAuthorized(req.headers.authorization);
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const items = Array.isArray(body.profiles)
        ? (body.profiles as AdsPowerIngestItem[])
        : Array.isArray(body.list)
          ? (body.list as AdsPowerIngestItem[])
          : [];
      const prune = body.prune !== false && body.replace !== false;
      const result = wabaAdsPowerService.ingest(items, { prune });
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      return sendError(res, error);
    }
  });
}

export function registerAdsPowerLabRoutes(app: Express): void {
  app.get("/integrations/adspower/status", async (_req, res) => {
    try {
      const bridge = await wabaAdsPowerService.status();
      return res.status(200).json({ ok: true, bridge });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/integrations/adspower/profiles", async (req, res) => {
    try {
      const auth = resolveWabaRequestAuth(req);
      const profiles = wabaAdsPowerService.list(auth);
      const bridge = await wabaAdsPowerService.status();
      return res.status(200).json({ ok: true, bridge, profiles });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/integrations/adspower/sync", async (req, res) => {
    try {
      const auth = resolveWabaRequestAuth(req);
      const result = await wabaAdsPowerService.pullFromLocalApi(auth);
      const bridge = await wabaAdsPowerService.status();
      return res.status(200).json({ ok: true, bridge, ...result });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/integrations/adspower/profiles/:userId/bind", (req, res) => {
    try {
      const auth = resolveWabaRequestAuth(req);
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const profile = wabaAdsPowerService.bind(auth, String(req.params.userId || ""), {
        connectionId: String(body.connectionId || ""),
        wabaId: String(body.wabaId || ""),
        phoneNumberId: String(body.phoneNumberId || ""),
        displayPhoneNumber: String(body.displayPhoneNumber || ""),
        verifiedName: String(body.verifiedName || ""),
      });
      return res.status(200).json({ ok: true, profile });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/integrations/adspower/profiles/:userId/unbind", (req, res) => {
    try {
      const auth = resolveWabaRequestAuth(req);
      const profile = wabaAdsPowerService.unbind(auth, String(req.params.userId || ""));
      return res.status(200).json({ ok: true, profile });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/integrations/adspower/profiles/:userId/open", async (req, res) => {
    try {
      const auth = resolveWabaRequestAuth(req);
      const result = await wabaAdsPowerService.open(auth, String(req.params.userId || ""));
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      return sendError(res, error);
    }
  });
}
