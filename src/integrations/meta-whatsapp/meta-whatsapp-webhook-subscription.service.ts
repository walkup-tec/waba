import { decryptMetaToken } from "./meta-token-crypto";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { callMetaGraphForWebhook } from "./meta-whatsapp-webhook-graph.client";
import { logMetaWebhook } from "./meta-whatsapp-webhook-log";

export type MetaWebhookSubscriptionResult = {
  ok: boolean;
  alreadySubscribed: boolean;
  subscribed: boolean;
  detail?: string;
};

function listSubscribedAppIds(json: unknown): string[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => String((item as { id?: string })?.id || "").trim())
    .filter(Boolean);
}

export class MetaWhatsappWebhookSubscriptionService {
  constructor(
    private readonly graph = callMetaGraphForWebhook,
    private readonly decrypt = decryptMetaToken,
  ) {}

  async ensureSubscribed(connection: MetaWhatsappConnectionRecord): Promise<MetaWebhookSubscriptionResult> {
    const wabaId = String(connection.wabaId || "").trim();
    if (!wabaId) {
      return {
        ok: false,
        alreadySubscribed: false,
        subscribed: false,
        detail: "WABA confirmada ausente.",
      };
    }

    let token = "";
    try {
      token = this.decrypt(connection.accessTokenEncrypted);
    } catch {
      logMetaWebhook("ERROR", { reason: "decrypt_failed", connectionId: connection.id });
      return {
        ok: false,
        alreadySubscribed: false,
        subscribed: false,
        detail: "Falha ao usar o token da conexão.",
      };
    }

    const existing = await this.graph({
      token,
      method: "GET",
      path: `${wabaId}/subscribed_apps`,
    });
    if (!existing.ok) {
      logMetaWebhook("ERROR", {
        reason: "subscribed_apps_get_failed",
        status: existing.status,
        wabaId,
      });
      return {
        ok: false,
        alreadySubscribed: false,
        subscribed: false,
        detail: "Falha ao consultar subscribed_apps.",
      };
    }

    const apps = listSubscribedAppIds(existing.json);
    if (apps.length > 0) {
      return { ok: true, alreadySubscribed: true, subscribed: true };
    }

    // Graph oficial: POST /{WABA_ID}/subscribed_apps sem body.
    // Campos (messages, message_template_status_update, …) são configurados no App Dashboard.
    const subscribe = await this.graph({
      token,
      method: "POST",
      path: `${wabaId}/subscribed_apps`,
    });
    if (!subscribe.ok) {
      logMetaWebhook("ERROR", {
        reason: "subscribed_apps_post_failed",
        status: subscribe.status,
        wabaId,
      });
      return {
        ok: false,
        alreadySubscribed: false,
        subscribed: false,
        detail: "Falha ao inscrever a WABA nos webhooks do app.",
      };
    }
    return { ok: true, alreadySubscribed: false, subscribed: true };
  }
}
