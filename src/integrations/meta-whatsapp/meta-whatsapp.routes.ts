import type { Express, Request, Response } from "express";
import multer from "multer";
import { resolveWabaRequestAuth } from "../../auth/waba-request-auth";
import {
  isMetaTechProviderConfigured,
  readMetaAppId,
  readMetaConfigId,
  readMetaJsSdkGraphVersion,
  readMetaOauthRedirectUri,
} from "./meta-config";
import {
  MetaWhatsappConnectionService,
  stripMetaSecrets,
} from "./meta-whatsapp-connection.service";
import { logMetaWhatsappSafe, toPublicMetaError } from "./meta-whatsapp-errors";
import { isMetaOfficialPortfolioLabEnabled } from "../../config/waba-feature-flags";
import { MetaWhatsappMessagingService } from "./meta-whatsapp-messaging.service";
import { MetaWhatsappTemplateService } from "./meta-whatsapp-template.service";
import { MetaWhatsappInboxService } from "./meta-whatsapp-inbox.service";
import { MetaWhatsappAutomationService } from "./meta-whatsapp-automation.service";
import { MetaWhatsappTemplateAiService } from "./meta-whatsapp-template-ai.service";
import { publicBaseHintsFromExpressRequest } from "../../lib/waba-public-base-url";
import { MetaWhatsappBroadcastService } from "./meta-whatsapp-broadcast.service";
import { isMetaTemplateRouteId } from "./meta-whatsapp-template-route-id";

const service = new MetaWhatsappConnectionService();
const messagingService = new MetaWhatsappMessagingService();
const templateService = new MetaWhatsappTemplateService();
const inboxService = new MetaWhatsappInboxService();
const automationService = new MetaWhatsappAutomationService();
const templateAiService = new MetaWhatsappTemplateAiService();
const broadcastService = new MetaWhatsappBroadcastService();
const uploadTemplateHeader = multer({
  storage: multer.memoryStorage(),
  /** Meta: vídeo de cabeçalho ≤ 16 MB; folga para overhead multipart. */
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});
const uploadBroadcastLeads = multer({
  storage: multer.memoryStorage(),
});

function sendPublic(res: Response, status: number, payload: unknown) {
  return res.status(status).json(stripMetaSecrets(payload));
}

function multerHeaderUploadError(err: unknown): { ok: false; error: string; code: string } | null {
  const code = String((err as { code?: string })?.code || "");
  if (code === "LIMIT_FILE_SIZE") {
    return {
      ok: false,
      error: "Arquivo acima do limite. Vídeo de cabeçalho: MP4 até 16 MB (H.264).",
      code: "template_media_too_large",
    };
  }
  if (err) {
    return {
      ok: false,
      error: "Não foi possível enviar a mídia.",
      code: "invalid_payload",
    };
  }
  return null;
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
  if (
    body?.tenant_id ||
    body?.tenantId ||
    body?.owner_email ||
    body?.ownerEmail
  ) {
    logMetaWhatsappSafe("ignored-client-tenant", {});
  }
}

export const registerMetaWhatsappIntegrationRoutes = (app: Express): void => {
  app.get("/integrations/meta/whatsapp/config", (_req, res) => {
    const appId = readMetaAppId();
    const configId = readMetaConfigId();
    return sendPublic(res, 200, {
      ok: Boolean(appId && configId),
      appId: appId || undefined,
      configId: configId || undefined,
      graphVersion: readMetaJsSdkGraphVersion(),
      callbackPath: "/integrations/meta/whatsapp/callback",
      redirectUri: readMetaOauthRedirectUri() || undefined,
    });
  });

  app.get("/integrations/meta/whatsapp/start", (req: Request, res: Response) => {
    try {
      const started = service.startAuthenticatedFlow(resolveWabaRequestAuth(req));
      return sendPublic(res, 200, started);
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/status", async (req: Request, res: Response) => {
    try {
      const publicStatus = await service.getPublicStatus(resolveWabaRequestAuth(req));
      return sendPublic(res, 200, { ok: true, ...publicStatus });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  /**
   * Callback de API (sessão autenticada).
   * O Embedded Signup atual usa FB.login na SPA e POST do `code` — não é redirect OAuth para a home.
   * GET existe para a URL dedicada existir; se vier `code` na query (futuro OAuth redirect), troca e persiste.
   */
  app.get("/integrations/meta/whatsapp/callback", async (req: Request, res: Response) => {
    const code = String(req.query.code || "").trim();
    if (!code) {
      return sendPublic(res, 200, {
        ok: true,
        message: "Callback Meta. Envie POST com { code } autenticado.",
      });
    }
    try {
      if (!isMetaTechProviderConfigured()) {
        return sendPublic(res, 503, {
          ok: false,
          error: "A conexão com a Meta não está disponível. Fale com o suporte.",
          code: "config_invalid",
        });
      }
      const publicStatus = await service.exchangeCodeAndStore(resolveWabaRequestAuth(req), {
        code,
        redirectUri: String(req.query.redirect_uri || "").trim() || undefined,
      });
      return sendPublic(res, 200, { ok: true, exchanged: true, ...publicStatus });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/callback", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const publicStatus = await service.exchangeCodeAndStore(resolveWabaRequestAuth(req), {
        code: String(req.body?.code || "").trim(),
        redirectUri: String(req.body?.redirectUri || req.body?.redirect_uri || "").trim() || undefined,
        tenantId: String(req.body?.tenantId || req.body?.tenant_id || "").trim() || undefined,
        ownerEmail: String(req.body?.ownerEmail || req.body?.owner_email || "").trim() || undefined,
      });
      return sendPublic(res, 200, { ok: true, exchanged: true, ...publicStatus });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/complete", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const publicStatus = await service.attachSessionAssets(resolveWabaRequestAuth(req), {
        wabaId: String(req.body?.wabaId || req.body?.waba_id || "").trim(),
        phoneNumberId: String(req.body?.phoneNumberId || req.body?.phone_number_id || "").trim(),
        businessId: String(req.body?.businessId || req.body?.business_id || "").trim(),
        displayPhoneNumber: String(req.body?.displayPhoneNumber || "").trim(),
        verifiedName: String(req.body?.verifiedName || "").trim(),
        tenantId: String(req.body?.tenantId || req.body?.tenant_id || "").trim() || undefined,
        ownerEmail: String(req.body?.ownerEmail || req.body?.owner_email || "").trim() || undefined,
      });
      return sendPublic(res, 200, { ok: true, ...publicStatus });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/confirm", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const publicStatus = await service.confirmFromAuth(resolveWabaRequestAuth(req));
      return sendPublic(res, 200, { ok: true, ...publicStatus });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/portfolio", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      const assets = await service.listPortfolioAssets(resolveWabaRequestAuth(req), {
        connectionId: String(req.query?.connectionId || ""),
      });
      return sendPublic(res, 200, { ok: true, ...assets });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.delete("/integrations/meta/whatsapp/portfolio", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      warnClientTenantClaim(req);
      const result = await service.disconnectOfficialLabFromAuth(resolveWabaRequestAuth(req));
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/portfolio/photo", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      const photo = await service.readPortfolioPhotoFromAuth(
        resolveWabaRequestAuth(req),
        String(req.query?.businessId || ""),
      );
      if (!photo) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Foto do portfólio não encontrada.",
          code: "invalid_payload",
        });
      }
      res.setHeader("Content-Type", photo.mime);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Length", String(photo.bytes.length));
      return res.status(200).end(photo.bytes);
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/phone-numbers/register", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      warnClientTenantClaim(req);
      const assets = await service.registerPhoneFromAuth(resolveWabaRequestAuth(req), {
        phoneNumberId: String(req.body?.phoneNumberId || req.body?.phone_number_id || "").trim(),
        pin: String(req.body?.pin || "").trim(),
        connectionId: String(req.body?.connectionId || req.body?.connection_id || "").trim(),
      });
      return sendPublic(res, 200, { ok: true, ...assets });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/phone-numbers/profile", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      warnClientTenantClaim(req);
      const assets = await service.updatePhoneProfileFromAuth(resolveWabaRequestAuth(req), {
        phoneNumberId: String(req.body?.phoneNumberId || req.body?.phone_number_id || "").trim(),
        connectionId: String(req.body?.connectionId || req.body?.connection_id || "").trim(),
        displayName: String(req.body?.displayName || req.body?.display_name || "").trim(),
        photoBase64: String(req.body?.photoBase64 || req.body?.photo_base64 || "").trim(),
        photoMime: String(req.body?.photoMime || req.body?.photo_mime || "").trim(),
        vertical: String(req.body?.vertical || "").trim(),
        description: String(req.body?.description || "").trim(),
        address: String(req.body?.address || "").trim(),
        email: String(req.body?.email || "").trim(),
      });
      return sendPublic(res, 200, { ok: true, ...assets });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/phone-numbers/inbox", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      warnClientTenantClaim(req);
      const enabledRaw = (req.body as { enabled?: unknown } | undefined)?.enabled;
      const auth = resolveWabaRequestAuth(req);
      const result = await service.setPhoneInboxFromAuth(auth, {
        phoneNumberId: String(req.body?.phoneNumberId || req.body?.phone_number_id || "").trim(),
        enabled: enabledRaw === true || enabledRaw === false ? enabledRaw : undefined,
        displayPhoneNumber: String(req.body?.displayPhoneNumber || req.body?.display_phone_number || "").trim(),
        channelName: String(req.body?.channelName || req.body?.channel_name || "").trim(),
        connectionId: String(req.body?.connectionId || req.body?.connection_id || "").trim(),
      });
      let webhooks: { subscribed: boolean; alreadySubscribed: boolean; detail?: string; wabaCount?: number } | undefined;
      if (result.inboxEnabled) {
        webhooks = await service
          .subscribeWebhooksFromAuth(auth, {
            connectionId: String(req.body?.connectionId || req.body?.connection_id || "").trim(),
            phoneNumberId: result.phoneNumberId,
          })
          .catch(() => ({
            subscribed: false,
            alreadySubscribed: false,
            detail: "Falha ao inscrever webhooks.",
          }));
      }
      return sendPublic(res, 200, { ok: true, ...result, webhooks });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/phone-numbers/photo", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      const photo = await service.readPhonePhotoFromAuth(
        resolveWabaRequestAuth(req),
        String(req.query.id || req.query.phoneNumberId || "").trim(),
      );
      if (!photo) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Foto do número não encontrada.",
          code: "invalid_payload",
        });
      }
      res.setHeader("Content-Type", photo.mime);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Length", String(photo.bytes.length));
      return res.status(200).end(photo.bytes);
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/messages", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const result = await messagingService.sendFromAuth(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/templates", async (req: Request, res: Response) => {
    try {
      const templates = await templateService.listFromAuth(
        resolveWabaRequestAuth(req),
        String(req.query.connectionId || req.query.connection_id || ""),
      );
      return sendPublic(res, 200, { ok: true, templates });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/templates", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const template = await templateService.createFromAuth(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, template });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/templates/sync", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const result = await templateService.syncFromAuth(
        resolveWabaRequestAuth(req),
        String(req.body?.connectionId || req.body?.connection_id || ""),
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  // Rotas /templates/ai/* ANTES de /templates/:templateId — senão "ai" vira UUID no Postgres.
  app.post("/integrations/meta/whatsapp/templates/ai/generate", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const result = await templateAiService.generateFromAuth(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/templates/ai/option", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const result = await templateAiService.saveEditedOptionFromAuth(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/templates/ai/submit-all", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const result = await templateAiService.submitAllFromAuth(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
        publicBaseHintsFromExpressRequest(req),
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/templates/ai/header-media", (req: Request, res: Response) => {
    uploadTemplateHeader.single("file")(req, res, async (err) => {
      const multerError = multerHeaderUploadError(err);
      if (multerError) {
        return sendPublic(res, 400, multerError);
      }
      try {
        warnClientTenantClaim(req);
        const file = req.file;
        const result = await templateAiService.uploadHeaderMediaFromAuth(resolveWabaRequestAuth(req), {
          connectionId: String(req.body?.connectionId || req.body?.connection_id || ""),
          mediaFormat: String(req.body?.mediaFormat || req.body?.media_format || ""),
          fileName: file?.originalname,
          mime: file?.mimetype,
          bytes: file?.buffer,
        });
        return sendPublic(res, 200, { ok: true, ...result });
      } catch (error) {
        const cause = (error as { cause?: { message?: string; code?: string } })?.cause;
        logMetaWhatsappSafe("header-media-error", {
          name: String((error as { name?: string })?.name || ""),
          code: String((error as { code?: string })?.code || ""),
          message: String((error as { message?: string })?.message || "").slice(0, 160),
          causeMessage: String(cause?.message || "").slice(0, 120),
          causeCode: String(cause?.code || "").slice(0, 64),
          mediaFormat: String(req.body?.mediaFormat || req.body?.media_format || ""),
          bytes: Number(req.file?.size || req.file?.buffer?.length || 0),
        });
        return handleMetaError(res, error);
      }
    });
  });

  app.post("/integrations/meta/whatsapp/templates/:templateId/header-media", (req: Request, res: Response) => {
    uploadTemplateHeader.single("file")(req, res, async (err) => {
      const multerError = multerHeaderUploadError(err);
      if (multerError) {
        return sendPublic(res, 400, multerError);
      }
      try {
        warnClientTenantClaim(req);
        const templateId = String(req.params.templateId || "").trim();
        if (!isMetaTemplateRouteId(templateId)) {
          return sendPublic(res, 404, {
            ok: false,
            error: "Template não encontrado.",
            code: "template_not_found",
          });
        }
        const file = req.file;
        const result = await templateService.attachHeaderMediaFromAuth(
          resolveWabaRequestAuth(req),
          templateId,
          {
            fileName: file?.originalname,
            mime: file?.mimetype,
            bytes: file?.buffer,
          },
        );
        return sendPublic(res, 200, { ok: true, ...result });
      } catch (error) {
        return handleMetaError(res, error);
      }
    });
  });

  app.get("/integrations/meta/whatsapp/templates/:templateId/header", async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.templateId || "").trim();
      if (!isMetaTemplateRouteId(templateId)) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Mídia do cabeçalho não encontrada.",
          code: "invalid_payload",
        });
      }
      const photo = await templateService.readHeaderPreviewFromAuth(
        resolveWabaRequestAuth(req),
        templateId,
      );
      if (!photo) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Mídia do cabeçalho não encontrada.",
          code: "invalid_payload",
        });
      }
      res.setHeader("Content-Type", photo.mime);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("Content-Length", String(photo.bytes.length));
      return res.status(200).end(photo.bytes);
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.delete("/integrations/meta/whatsapp/templates/:templateId", async (req: Request, res: Response) => {
    try {
      const templateId = String(req.params.templateId || "").trim();
      if (!isMetaTemplateRouteId(templateId)) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Template não encontrado.",
          code: "template_not_found",
        });
      }
      const result = await templateService.deleteFromAuth(
        resolveWabaRequestAuth(req),
        templateId,
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/inbox/conversations", async (req: Request, res: Response) => {
    try {
      const result = await inboxService.listConversations(
        resolveWabaRequestAuth(req),
        req.query as Record<string, unknown>,
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/inbox/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const result = await inboxService.listMessages(
        resolveWabaRequestAuth(req),
        String(req.params.id || ""),
        req.query as Record<string, unknown>,
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/inbox/conversations/:id/read", async (req: Request, res: Response) => {
    try {
      const conversation = await inboxService.markRead(
        resolveWabaRequestAuth(req),
        String(req.params.id || ""),
      );
      return sendPublic(res, 200, { ok: true, conversation });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/inbox/conversations/:id/status", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const conversation = await inboxService.patchStatus(
        resolveWabaRequestAuth(req),
        String(req.params.id || ""),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, conversation });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/inbox/conversations/:id/assign", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const conversation = await inboxService.assign(
        resolveWabaRequestAuth(req),
        String(req.params.id || ""),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, conversation });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/inbox/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const result = await inboxService.sendMessage(
        resolveWabaRequestAuth(req),
        String(req.params.id || ""),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/automation", async (req: Request, res: Response) => {
    try {
      const result = await automationService.getBundle(resolveWabaRequestAuth(req));
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.patch("/integrations/meta/whatsapp/automation/settings", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const settings = await automationService.patchSettings(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, settings });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.patch("/integrations/meta/whatsapp/automation/flows/:id", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const flow = await automationService.patchFlow(
        resolveWabaRequestAuth(req),
        String(req.params.id || ""),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, flow });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.post("/integrations/meta/whatsapp/automation/rules", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const rule = await automationService.createRule(
        resolveWabaRequestAuth(req),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, rule });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.patch("/integrations/meta/whatsapp/automation/rules/:id", async (req: Request, res: Response) => {
    try {
      warnClientTenantClaim(req);
      const rule = await automationService.patchRule(
        resolveWabaRequestAuth(req),
        String(req.params.id || ""),
        req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
      );
      return sendPublic(res, 200, { ok: true, rule });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.delete("/integrations/meta/whatsapp/automation/rules/:id", async (req: Request, res: Response) => {
    try {
      const result = await automationService.deleteRule(
        resolveWabaRequestAuth(req),
        String(req.params.id || ""),
      );
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/broadcast/inspect", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      const result = await broadcastService.inspectFromAuth(resolveWabaRequestAuth(req), {
        connectionId: String(req.query.connectionId || req.query.connection_id || ""),
        templateId: String(req.query.templateId || req.query.template_id || ""),
      });
      return sendPublic(res, 200, { ok: true, ...result });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/broadcast", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      const campaigns = broadcastService.listFromAuth(resolveWabaRequestAuth(req));
      return sendPublic(res, 200, { ok: true, campaigns });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/broadcast/linkable-campaigns", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      warnClientTenantClaim(req);
      const campaigns = broadcastService.listLinkableSubscriberCampaigns(resolveWabaRequestAuth(req));
      return sendPublic(res, 200, { ok: true, campaigns });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  app.get("/integrations/meta/whatsapp/broadcast/:id", async (req: Request, res: Response) => {
    try {
      if (!isMetaOfficialPortfolioLabEnabled()) {
        return sendPublic(res, 404, {
          ok: false,
          error: "Recurso indisponível neste ambiente.",
          code: "config_invalid",
        });
      }
      const campaign = broadcastService.getFromAuth(
        resolveWabaRequestAuth(req),
        String(req.params.id || ""),
      );
      return sendPublic(res, 200, { ok: true, campaign });
    } catch (error) {
      return handleMetaError(res, error);
    }
  });

  function broadcastMappingFromBody(body: Record<string, unknown> | undefined) {
    return {
      phoneColumn: String(body?.phoneColumn || body?.phone_column || "").trim(),
      nomeColumn: String(body?.nomeColumn || body?.nome_column || "").trim(),
      numeroColumn: String(body?.numeroColumn || body?.numero_column || "").trim(),
      textoColumn: String(body?.textoColumn || body?.texto_column || "").trim(),
    };
  }

  function handleBroadcastUpload(req: Request, res: Response, next: (err?: unknown) => void) {
    uploadBroadcastLeads.single("file")(req, res, (err) => {
      if (err) {
        return sendPublic(res, 400, {
          ok: false,
          error: "Não foi possível ler a planilha.",
          code: "invalid_payload",
        });
      }
      return next();
    });
  }

  app.post("/integrations/meta/whatsapp/broadcast/preview", (req: Request, res: Response) => {
    handleBroadcastUpload(req, res, async () => {
      try {
        if (!isMetaOfficialPortfolioLabEnabled()) {
          return sendPublic(res, 404, {
            ok: false,
            error: "Recurso indisponível neste ambiente.",
            code: "config_invalid",
          });
        }
        warnClientTenantClaim(req);
        const file = req.file;
        if (!file?.buffer?.length) {
          return sendPublic(res, 400, {
            ok: false,
            error: "Envie uma planilha .xlsx, .xls ou .txt.",
            code: "invalid_payload",
          });
        }
        const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
        const result = await broadcastService.previewFromAuth(resolveWabaRequestAuth(req), {
          connectionId: String(body.connectionId || body.connection_id || ""),
          templateId: String(body.templateId || body.template_id || ""),
          buffer: file.buffer,
          fileName: String(file.originalname || "leads.xlsx"),
          mapping: broadcastMappingFromBody(body),
        });
        return sendPublic(res, 200, { ok: true, ...result });
      } catch (error) {
        return handleMetaError(res, error);
      }
    });
  });

  app.post("/integrations/meta/whatsapp/broadcast/start", (req: Request, res: Response) => {
    handleBroadcastUpload(req, res, async () => {
      try {
        if (!isMetaOfficialPortfolioLabEnabled()) {
          return sendPublic(res, 404, {
            ok: false,
            error: "Recurso indisponível neste ambiente.",
            code: "config_invalid",
          });
        }
        warnClientTenantClaim(req);
        const file = req.file;
        if (!file?.buffer?.length) {
          return sendPublic(res, 400, {
            ok: false,
            error: "Envie uma planilha .xlsx, .xls ou .txt.",
            code: "invalid_payload",
          });
        }
        const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
        const rawPhoneIds = body.phoneNumberIds ?? body.phone_number_ids ?? body.phoneNumberId ?? body.phone_number_id;
        const phoneNumberIds = Array.isArray(rawPhoneIds)
          ? rawPhoneIds.map((item) => String(item || "").trim()).filter(Boolean)
          : String(rawPhoneIds || "")
              .split(/[\s,;]+/)
              .map((item) => item.trim())
              .filter(Boolean);
        const campaign = await broadcastService.startFromAuth(resolveWabaRequestAuth(req), {
          connectionId: String(body.connectionId || body.connection_id || ""),
          templateId: String(body.templateId || body.template_id || ""),
          phoneNumberId: phoneNumberIds[0] || String(body.phoneNumberId || body.phone_number_id || ""),
          phoneNumberIds,
          buffer: file.buffer,
          fileName: String(file.originalname || "leads.xlsx"),
          mapping: broadcastMappingFromBody(body),
          intakeCampaignId: String(body.intakeCampaignId || body.intake_campaign_id || ""),
          publicBaseHints: publicBaseHintsFromExpressRequest(req),
        });
        return sendPublic(res, 202, { ok: true, campaign });
      } catch (error) {
        return handleMetaError(res, error);
      }
    });
  });
};
