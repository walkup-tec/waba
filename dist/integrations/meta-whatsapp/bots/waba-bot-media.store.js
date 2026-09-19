"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferBotMediaMime = inferBotMediaMime;
exports.assertBotMediaFile = assertBotMediaFile;
exports.saveBotMedia = saveBotMedia;
exports.readBotMedia = readBotMedia;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../../data-path");
const TENANT_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const REF_RE = /^media-[a-zA-Z0-9]{8,32}$/;
const MAX_BYTES = 16 * 1024 * 1024;
function safeTenantId(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        throw new Error("Tenant inválido para mídia do bot.");
    if (TENANT_RE.test(id))
        return id;
    return (0, node_crypto_1.createHash)("sha256").update(id).digest("hex").slice(0, 40);
}
function mediaDir(tenantId) {
    return node_path_1.default.join((0, data_path_1.resolveDataDir)(), "meta-whatsapp", "bots", safeTenantId(tenantId), "media");
}
function extensionFor(kind, mime, fileName) {
    const name = String(fileName || "").toLowerCase();
    const type = String(mime || "").toLowerCase();
    if (kind === "pdf" || type.includes("pdf") || name.endsWith(".pdf"))
        return "pdf";
    if (kind === "video" || type.includes("mp4") || name.endsWith(".mp4"))
        return "mp4";
    if (name.endsWith(".3gp") || type.includes("3gpp"))
        return "3gp";
    if (name.endsWith(".opus") || type.includes("opus"))
        return "opus";
    if (name.endsWith(".ogg") || type.includes("ogg"))
        return "ogg";
    if (name.endsWith(".m4a") || type === "audio/mp4")
        return "m4a";
    if (name.endsWith(".aac") || type.includes("aac"))
        return "aac";
    if (name.endsWith(".amr") || type.includes("amr"))
        return "amr";
    if (name.endsWith(".mp3") || type.includes("mpeg"))
        return "mp3";
    return kind === "audio" ? "ogg" : kind === "pdf" ? "pdf" : "mp4";
}
function inferBotMediaMime(kind, mime, fileName) {
    const type = String(mime || "").trim().toLowerCase();
    if (type && type !== "application/octet-stream")
        return type;
    const name = String(fileName || "").toLowerCase();
    if (kind === "pdf" || name.endsWith(".pdf"))
        return "application/pdf";
    if (name.endsWith(".3gp"))
        return "video/3gpp";
    if (kind === "video" || name.endsWith(".mp4"))
        return "video/mp4";
    if (name.endsWith(".opus"))
        return "audio/opus";
    if (name.endsWith(".ogg"))
        return "audio/ogg";
    if (name.endsWith(".m4a"))
        return "audio/mp4";
    if (name.endsWith(".aac"))
        return "audio/aac";
    if (name.endsWith(".amr"))
        return "audio/amr";
    if (name.endsWith(".mp3"))
        return "audio/mpeg";
    return kind === "audio" ? "audio/ogg" : "video/mp4";
}
function assertBotMediaFile(input) {
    const kind = input.mediaKind;
    const bytes = input.bytes;
    if (!bytes?.length)
        throw new Error("Selecione o arquivo de mídia.");
    if (bytes.length > MAX_BYTES)
        throw new Error("A mídia pode ter no máximo 16 MB.");
    const mime = inferBotMediaMime(kind, input.mime, input.fileName);
    const name = String(input.fileName || "").toLowerCase();
    if (kind === "video" && !mime.includes("mp4") && !mime.includes("3gpp") && !name.endsWith(".mp4") && !name.endsWith(".3gp")) {
        throw new Error("Vídeo: envie MP4 (H.264) ou 3GP.");
    }
    if (kind === "pdf" && !mime.includes("pdf") && !name.endsWith(".pdf")) {
        throw new Error("Documento: envie um PDF.");
    }
    if (kind === "audio" &&
        !/ogg|opus|mpeg|mp4|aac|amr|mp3/.test(mime) &&
        !/\.(ogg|opus|mp3|m4a|aac|amr)$/.test(name)) {
        throw new Error("Áudio: OGG/OPUS (nota de voz), MP3, M4A, AAC ou AMR.");
    }
    const fileName = String(input.fileName || "").trim() || `midia.${extensionFor(kind, mime, "")}`;
    return { mime, fileName };
}
function saveBotMedia(input) {
    const checked = assertBotMediaFile(input);
    const mediaRef = `media-${(0, node_crypto_1.randomUUID)().replace(/-/g, "").slice(0, 16)}`;
    const ext = extensionFor(input.mediaKind, checked.mime, checked.fileName);
    const dir = mediaDir(input.tenantId);
    (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(dir, `${mediaRef}.${ext}`), input.bytes);
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(dir, `${mediaRef}.json`), JSON.stringify({
        mediaRef,
        mediaKind: input.mediaKind,
        fileName: checked.fileName,
        mime: checked.mime,
        size: input.bytes.length,
    }), "utf8");
    return {
        mediaRef,
        mediaKind: input.mediaKind,
        fileName: checked.fileName,
        mime: checked.mime,
        size: input.bytes.length,
    };
}
function readBotMedia(tenantId, mediaRef) {
    const id = String(mediaRef || "").trim();
    if (!REF_RE.test(id))
        return null;
    const dir = mediaDir(tenantId);
    const metaFile = node_path_1.default.join(dir, `${id}.json`);
    if (!(0, node_fs_1.existsSync)(metaFile))
        return null;
    try {
        const meta = JSON.parse((0, node_fs_1.readFileSync)(metaFile, "utf8"));
        const ext = extensionFor(meta.mediaKind, meta.mime, meta.fileName);
        const file = node_path_1.default.join(dir, `${id}.${ext}`);
        if (!(0, node_fs_1.existsSync)(file))
            return null;
        return {
            bytes: (0, node_fs_1.readFileSync)(file),
            mime: meta.mime,
            fileName: meta.fileName,
            mediaKind: meta.mediaKind,
        };
    }
    catch {
        return null;
    }
}
