export const META_WHATSAPP_WEBHOOK_PATH = "/webhooks/meta/whatsapp";

export function isMetaWhatsappWebhookPath(reqPath: string): boolean {
  const p = String(reqPath || "/").replace(/\/+$/, "") || "/";
  return p === META_WHATSAPP_WEBHOOK_PATH;
}
