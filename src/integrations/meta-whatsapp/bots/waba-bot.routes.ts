import type { Express, Request, Response } from "express";
import multer from "multer";
import { resolveWabaRequestAuth } from "../../../auth/waba-request-auth";
import { logMetaWhatsappSafe, toPublicMetaError } from "../meta-whatsapp-errors";
import { stripMetaSecrets } from "../meta-whatsapp-connection.service";
import { WabaBotService } from "./waba-bot.service";

const uploadBotMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024, files: 1 },
});

const service = new WabaBotService();

function sendPublic(res: Response, status: number, payload: unknown) {
  return res.status(status).json(stripMetaSecrets(payload));
}

function handleMetaError(res: Response, error: unknown) {
  const publicError = toPublicMetaError(error);
  logMetaWhatsappSafe("http-error", { code: publicError.code, status: publicError.status });
  return sendPublic(res, publicError.status, {
    ok: false,
    error: publicError.error,
    code: publicError.code,
  });
}

function warnClientTenantClaim(req: Request): void {
  const body = req.body as Record<string, unknown> | undefined;
  if (body?.tenant_id || body?.tenantId || body?.owner_email || body?.ownerEmail) {
    logMetaWhatsappSafe("ignored-client-tenant", {});
  }
}

export function registerWabaBotRoutes(app: Express): void {
  app.get("/integrations/meta/whatsapp/bots", async (req: Request, res: Response) => {
    try {
      const result = await service.list(resolveWabaRequestAuth(req));
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/bots/catalog", async (req: Request, res: Response) => {
    try {
      resolveWabaRequestAuth(req);
      return sendPublic(res, 200, { ok: true, ...service.getCatalog() });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/bots/:id", async (req: Request, res: Response) => {
    try {
      const flow = service.get(resolveWabaRequestAuth(req), String(req.params.id || ""));
      return sendPublic(res, 200, { ok: true, flow });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/bots", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const flow = body.flow
        ? service.upsert(resolveWabaRequestAuth(req), body.flow)
        : service.create(resolveWabaRequestAuth(req), String(body.name || ""));
      return sendPublic(res, 200, { ok: true, flow });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.put("/integrations/meta/whatsapp/bots/:id", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const flow = service.upsert(resolveWabaRequestAuth(req), {
        ...body,
        id: String(req.params.id || body.id || ""),
      });
      return sendPublic(res, 200, { ok: true, flow });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.delete("/integrations/meta/whatsapp/bots/:id", async (req: Request, res: Response) => {
    try {
      service.remove(resolveWabaRequestAuth(req), String(req.params.id || ""));
      return sendPublic(res, 200, { ok: true });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/bots/media", (req: Request, res: Response) => {
    uploadBotMedia.single("file")(req, res, async (err) => {
      if (err) {
        return sendPublic(res, 400, {
          ok: false,
          error: "A mídia pode ter no máximo 16 MB.",
          code: "invalid_payload",
        });
      }
      try {
        warnClientTenantClaim(req);
        const file = req.file;
        const saved = service.saveMedia(resolveWabaRequestAuth(req), {
          mediaKind: String(req.body?.mediaKind || req.body?.media_kind || ""),
          fileName: file?.originalname,
          mime: file?.mimetype,
          bytes: file?.buffer,
        });
        return sendPublic(res, 200, { ok: true, ...saved });
      } catch (error) {
        return handleMetaError(res, error);
      }
    });
  });

  app.post("/integrations/meta/whatsapp/bots/phone-link", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const result = await service.linkPhone(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, result);
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/bots/test-node", async (req: Request, res: Response) => {
    try {
      const result = await service.testNode(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/bots/test-run", async (req: Request, res: Response) => {
    try {
      const result = await service.startTest(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, result);
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/bots/test-continue", async (req: Request, res: Response) => {
    try {
      const result = await service.continueTest(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, result);
    } catch (error) {
      return handleMetaError(res, error);
    }
  });
}
