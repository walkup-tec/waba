import type { BotMediaKind } from "./waba-bot.types";

const BUTTON_LABEL_MAX = 20;

export function normalizeBotHttpsUrl(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function normalizeBotButtonLabel(raw: string): string {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, BUTTON_LABEL_MAX);
}

export function isWhatsappVoiceFormat(mime?: string, fileName?: string): boolean {
  const type = String(mime || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();
  return (
    type.includes("ogg") ||
    type.includes("opus") ||
    name.endsWith(".ogg") ||
    name.endsWith(".opus")
  );
}

export function cloudMediaType(kind: BotMediaKind): "video" | "document" | "audio" {
  if (kind === "pdf") return "document";
  if (kind === "audio") return "audio";
  return "video";
}

export function buildCloudTypingIndicatorBody(messageId: string): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    status: "read",
    message_id: String(messageId || "").trim(),
    typing_indicator: { type: "text" },
  };
}

export function buildCloudCtaUrlBody(input: {
  to: string;
  text: string;
  buttonLabel: string;
  url: string;
}): Record<string, unknown> {
  const to = String(input.to || "").trim();
  const text = String(input.text || "").trim();
  const buttonLabel = normalizeBotButtonLabel(input.buttonLabel);
  const url = normalizeBotHttpsUrl(input.url);
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text },
      action: {
        name: "cta_url",
        parameters: {
          display_text: buttonLabel,
          url,
        },
      },
    },
  };
}

export function buildCloudMediaBody(input: {
  to: string;
  kind: BotMediaKind;
  mediaId?: string;
  link?: string;
  caption?: string;
  fileName?: string;
  mime?: string;
  voice?: boolean;
}): Record<string, unknown> {
  const type = cloudMediaType(input.kind);
  const mediaId = String(input.mediaId || "").trim();
  const link = String(input.link || "").trim();
  const payload: Record<string, unknown> = mediaId ? { id: mediaId } : { link };
  const caption = String(input.caption || "").trim();
  if (caption && type !== "audio") payload.caption = caption;
  if (type === "document") {
    payload.filename = String(input.fileName || "arquivo.pdf").trim() || "arquivo.pdf";
  }
  if (type === "audio" && input.voice && isWhatsappVoiceFormat(input.mime, input.fileName)) {
    payload.voice = true;
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: String(input.to || "").trim(),
    type,
    [type]: payload,
  };
}
