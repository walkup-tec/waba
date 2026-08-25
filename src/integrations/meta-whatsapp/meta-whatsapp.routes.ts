import type { Express, Request, Response } from "express";
import { resolveWabaRequestAuth } from "../../auth/waba-request-auth";
import {
  isMetaTechProviderConfigured,
  readMetaAppId,
  readMetaConfigId,
  readMetaGraphVersion,
  readMetaOauthRedirectUri,
} from "./meta-config";
import {
  MetaWhatsappConnectionService,
  stripMetaSecrets,
} from "./meta-whatsapp-connection.service";
import { logMetaWhatsappSafe, toPublicMetaError } from "./meta-whatsapp-errors";
import { MetaWhatsappMessagingService } from "./meta-whatsapp-messaging.service";
import { MetaWhatsappTemplateService } from "./meta-whatsapp-template.service";
import { MetaWhatsappInboxService } from "./meta-whatsapp-inbox.service";
import { MetaWhatsappAutomationService } from "./meta-whatsapp-automation.service";

const service = new MetaWhatsappConnectionService();
const messagingService = new MetaWhatsappMessagingService();
const templateService = new MetaWhatsappTemplateService();
const inboxService = new MetaWhatsappInboxService();
const automationService = new MetaWhatsappAutomationService();

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
      graphVersion: readMetaGraphVersion(),
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
      const templates = await templateService.listFromAuth(resolveWabaRequestAuth(req));
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
      const result = await templateService.syncFromAuth(resolveWabaRequestAuth(req));
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
};
