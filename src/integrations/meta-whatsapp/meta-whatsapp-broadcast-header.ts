/**
 * Cabeçalho do Disparo Cloud: a Graph não deve receber weblink de exemplo.
 * URLs lookaside/fbcdn no `header_handle` expiram e a Meta devolve 131053 + HTTP 403.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/
 * https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/
 */

export const BROADCAST_HEADER_WEBLINK_ERROR =
  "Este template exige mídia de cabeçalho no envio. Não use a URL de exemplo da Graph (ela responde 403). Sincronize o template ou reenvie a mídia.";

export function isMetaHeaderExampleUrl(value: string): boolean {
  const raw = String(value || "").trim();
  if (!/^https:\/\//i.test(raw)) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return (
      host === "lookaside.fbsbx.com" ||
      host.endsWith(".fbsbx.com") ||
      host.endsWith(".fbcdn.net") ||
      host.endsWith(".facebook.com")
    );
  } catch {
    return false;
  }
}

export function mimeFromHeaderFormat(format: string, stored?: string): string {
  const current = String(stored || "").trim().toLowerCase();
  if (current) return current;
  const kind = String(format || "").trim().toUpperCase();
  if (kind === "VIDEO") return "video/mp4";
  if (kind === "DOCUMENT") return "application/pdf";
  return "image/jpeg";
}

export function headerUploadFileName(mime: string): string {
  const type = String(mime || "").toLowerCase();
  if (type.includes("png")) return "header.png";
  if (type.includes("mp4")) return "header.mp4";
  if (type.includes("pdf")) return "header.pdf";
  return "header.jpg";
}

export type BroadcastHeaderMediaPlan = "upload" | "weblink" | "refuse-weblink" | "missing";

/** Graph example URLs (lookaside/fbcdn) expire; sending them as `link` yields 131053. */
export function classifyBroadcastHeaderMedia(input: {
  hasLocalPreview: boolean;
  httpsUrl: string | null;
}): BroadcastHeaderMediaPlan {
  if (input.hasLocalPreview) return "upload";
  const url = String(input.httpsUrl || "").trim();
  if (url && isMetaHeaderExampleUrl(url)) return "refuse-weblink";
  if (/^https:\/\//i.test(url)) return "weblink";
  return "missing";
}
