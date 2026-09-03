"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMPAIGN_VIDEO_ERROR = exports.CAMPAIGN_IMAGE_ERROR = exports.CAMPAIGN_VIDEO_RULES = exports.CAMPAIGN_IMAGE_RULES = exports.CAMPAIGN_VIDEO_MAX_BYTES = void 0;
exports.parseCampaignMediaKind = parseCampaignMediaKind;
exports.sniffCampaignMediaMime = sniffCampaignMediaMime;
exports.validateCampaignIntakeMedia = validateCampaignIntakeMedia;
exports.CAMPAIGN_VIDEO_MAX_BYTES = 16 * 1024 * 1024;
exports.CAMPAIGN_IMAGE_RULES = [
    "Arquivo PNG ou JPG",
    "Exatamente 1080 × 1080 px",
];
exports.CAMPAIGN_VIDEO_RULES = [
    "Arquivo .mp4 (MP4)",
    "Vídeo H.264 e áudio AAC, ou sem áudio",
    "Até 16 MB",
    "Não use MOV, WebM, AVI, MKV ou GIF",
];
exports.CAMPAIGN_IMAGE_ERROR = "A imagem deve ser PNG ou JPG, com 1080 × 1080 px.";
exports.CAMPAIGN_VIDEO_ERROR = "O vídeo deve ser MP4 (.mp4), H.264 com áudio AAC ou sem áudio, e ter no máximo 16 MB.";
function parseCampaignMediaKind(value) {
    return String(value || "").trim().toLowerCase() === "video" ? "video" : "image";
}
function sniffCampaignMediaMime(bytes) {
    if (!bytes || bytes.length < 8)
        return null;
    if (bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a) {
        return "image/png";
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return "image/jpeg";
    if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
        const brand = bytes.subarray(8, 12).toString("ascii");
        if (brand === "qt  " || brand.startsWith("3gp") || brand.startsWith("3g2")) {
            return null;
        }
        return "video/mp4";
    }
    return null;
}
function validateCampaignIntakeMedia(input) {
    const kind = parseCampaignMediaKind(input.kind);
    const sniffed = sniffCampaignMediaMime(input.buffer);
    const declared = String(input.mime || "")
        .toLowerCase()
        .split(";")[0]
        .trim();
    const ext = String(input.fileName || "").toLowerCase().split(".").pop() || "";
    if (kind === "video") {
        if (input.buffer.length > exports.CAMPAIGN_VIDEO_MAX_BYTES || sniffed !== "video/mp4") {
            return { ok: false, error: exports.CAMPAIGN_VIDEO_ERROR };
        }
        return { ok: true, mime: "video/mp4", extension: ".mp4" };
    }
    const jpeg = sniffed === "image/jpeg" ||
        declared === "image/jpeg" ||
        declared === "image/jpg" ||
        ext === "jpg" ||
        ext === "jpeg";
    const png = sniffed === "image/png" || declared === "image/png" || ext === "png";
    if (sniffed === "video/mp4" || (sniffed !== "image/jpeg" && sniffed !== "image/png" && !jpeg && !png)) {
        return { ok: false, error: exports.CAMPAIGN_IMAGE_ERROR };
    }
    if (sniffed === "image/png" || (!sniffed && png && !jpeg)) {
        return { ok: true, mime: "image/png", extension: ".png" };
    }
    return { ok: true, mime: "image/jpeg", extension: ".jpg" };
}
