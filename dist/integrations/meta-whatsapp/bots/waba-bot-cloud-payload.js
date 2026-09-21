"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBotHttpsUrl = normalizeBotHttpsUrl;
exports.normalizeBotButtonLabel = normalizeBotButtonLabel;
exports.isWhatsappVoiceFormat = isWhatsappVoiceFormat;
exports.cloudMediaType = cloudMediaType;
exports.buildCloudTypingIndicatorBody = buildCloudTypingIndicatorBody;
exports.buildCloudCtaUrlBody = buildCloudCtaUrlBody;
exports.buildCloudMediaBody = buildCloudMediaBody;
const BUTTON_LABEL_MAX = 20;
function normalizeBotHttpsUrl(raw) {
    const value = String(raw || "").trim();
    if (!value)
        return "";
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:")
            return "";
        return parsed.toString();
    }
    catch {
        return "";
    }
}
function normalizeBotButtonLabel(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim().slice(0, BUTTON_LABEL_MAX);
}
function isWhatsappVoiceFormat(mime, fileName) {
    const type = String(mime || "").toLowerCase();
    const name = String(fileName || "").toLowerCase();
    return (type.includes("ogg") ||
        type.includes("opus") ||
        name.endsWith(".ogg") ||
        name.endsWith(".opus"));
}
function cloudMediaType(kind) {
    if (kind === "pdf")
        return "document";
    if (kind === "audio")
        return "audio";
    return "video";
}
function buildCloudTypingIndicatorBody(messageId) {
    return {
        messaging_product: "whatsapp",
        status: "read",
        message_id: String(messageId || "").trim(),
        typing_indicator: { type: "text" },
    };
}
function buildCloudCtaUrlBody(input) {
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
function buildCloudMediaBody(input) {
    const type = cloudMediaType(input.kind);
    const mediaId = String(input.mediaId || "").trim();
    const link = String(input.link || "").trim();
    const payload = mediaId ? { id: mediaId } : { link };
    const caption = String(input.caption || "").trim();
    if (caption && type !== "audio")
        payload.caption = caption;
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
