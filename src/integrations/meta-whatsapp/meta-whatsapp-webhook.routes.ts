import type { Express, Request, Response } from "express";
import { MetaWhatsappWebhookEventsRepository } from "./meta-whatsapp-webhook-events.repository";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { META_WHATSAPP_WEBHOOK_PATH } from "./meta-whatsapp-webhook-path";
import { MetaWhatsappWebhookService } from "./meta-whatsapp-webhook.service";
import { MetaWhatsappWebhookInboxService } from "./meta-whatsapp-webhook-inbox.service";
import { MetaWhatsappWebhookTemplateService } from "./meta-whatsapp-webhook-template.service";
import { MetaWhatsappWebhookSubscriptionService } from "./meta-whatsapp-webhook-subscription.service";
import { logMetaWebhook } from "./meta-whatsapp-webhook-log";
import { toPublicMetaError } from "./meta-whatsapp-errors";
import { resolveWabaRequestAuth } from "../../auth/waba-request-auth";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";

const webhookService = new MetaWhatsappWebhookService(
  new MetaWhatsappConnectionRepository(),
  new MetaWhatsappWebhookEventsRepository(),
  new MetaWhatsappWebhookInboxService(),
  new MetaWhatsappWebhookTemplateService(),
);
const subscriptionService = new MetaWhatsappWebhookSubscriptionService();
const connections = new MetaWhatsappConnectionRepository();

function readRawBody(req: Request): Buffer | undefined {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  return Buffer.isBuffer(raw) ? raw : undefined;
}

export const registerMetaWhatsappWebhookRoutes = (app: Express): void => {
  app.get(META_WHATSAPP_WEBHOOK_PATH, (req: Request, res: Response) => {
    const result = webhookService.verifySubscription({
      "hub.mode": String(req.query["hub.mode"] || ""),
      "hub.verify_token": String(req.query["hub.verify_token"] || ""),
      "hub.challenge": String(req.query["hub.challenge"] || ""),
    });
    if (!result.ok) {
      return res.status(403).send("Forbidden");
    }
    return res.status(200).type("text/plain").send(result.challenge);
  });

  app.post(META_WHATSAPP_WEBHOOK_PATH, async (req: Request, res: Response) => {
    try {
      const result = await webhookService.processPostedEvent({
        rawBody: readRawBody(req),
        signatureHeader: req.header("x-hub-signature-256") || req.header("X-Hub-Signature-256"),
        parsedBody: req.body,
      });
      if (!result.accepted) {
        return res.status(result.httpStatus).send("Forbidden");
      }
      return res.status(200).json({ ok: true });
    } catch {
      logMetaWebhook("ERROR", { reason: "unhandled" });
      return res.status(200).json({ ok: true });
    }
  });
};

export const registerMetaWhatsappSubscriptionRoute = (app: Express): void => {
  app.post("/integrations/meta/whatsapp/subscribe-webhooks", async (req: Request, res: Response) => {
    try {
      const auth = resolveWabaRequestAuth(req);
      const tenant = resolveMetaWhatsappTenant(auth);
      const connection = await connections.findOpenByTenant(tenant.tenantId);
      if (
        !connection ||
        !connection.wabaId ||
        (connection.status !== "connected" && connection.status !== "pending_confirmation")
      ) {
        return res.status(409).json({
          ok: false,
          error: "Conecte e confirme a WABA antes de inscrever o webhook.",
        });
      }
      const result = await subscriptionService.ensureSubscribed(connection);
      if (!result.ok) {
        return res.status(424).json({ ok: false, error: result.detail || "Falha na inscrição." });
      }
      return res.status(200).json({
        ok: true,
        alreadySubscribed: result.alreadySubscribed,
        subscribed: result.subscribed,
      });
    } catch (error) {
      const publicError = toPublicMetaError(error);
      return res.status(publicError.status).json({
        ok: false,
        error: publicError.error,
        code: publicError.code,
      });
    }
  });
};
