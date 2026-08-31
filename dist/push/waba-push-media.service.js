"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePushImageAttachment = savePushImageAttachment;
exports.resolvePushMediaFile = resolvePushMediaFile;
exports.readPushMediaBase64 = readPushMediaBase64;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const data_path_1 = require("../data-path");
const PUSH_MEDIA_DIR = "push-media";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
function resolvePushMediaDir() {
    const dir = node_path_1.default.join((0, data_path_1.resolveDataDir)(), PUSH_MEDIA_DIR);
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    return dir;
}
function sanitizeFileName(value) {
    const base = node_path_1.default.basename(String(value || "imagem").trim()) || "imagem";
    return base.replace(/[^\w.\-()+\s]/g, "_").slice(0, 120);
}
function isSafeMediaId(id) {
    return /^[0-9a-f-]{36}$/i.test(String(id || "").trim());
}
function savePushImageAttachment(input) {
    const mimeType = String(input.mimeType || "").trim().toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
        throw new Error("Formato inválido. Use JPEG, PNG, WebP ou GIF.");
    }
    if (!input.buffer?.length || input.buffer.length > MAX_IMAGE_BYTES) {
        throw new Error("Imagem inválida ou maior que 5 MB.");
    }
    const id = (0, node_crypto_1.randomUUID)();
    const safeName = sanitizeFileName(input.fileName);
    const storageName = `${id}-${safeName}`;
    const absolutePath = node_path_1.default.join(resolvePushMediaDir(), storageName);
    (0, node_fs_1.writeFileSync)(absolutePath, input.buffer);
    return {
        id,
        fileName: safeName,
        mimeType,
        sizeBytes: input.buffer.length,
    };
}
function resolvePushMediaFile(mediaId) {
    const id = String(mediaId || "").trim();
    if (!isSafeMediaId(id))
        return null;
    const dir = resolvePushMediaDir();
    const entries = (0, node_fs_1.existsSync)(dir)
        ? (0, node_fs_1.readdirSync)(dir).filter((name) => name.startsWith(`${id}-`))
        : [];
    const match = entries[0];
    if (!match)
        return null;
    const absolutePath = node_path_1.default.join(dir, match);
    if (!(0, node_fs_1.existsSync)(absolutePath))
        return null;
    const ext = node_path_1.default.extname(match).toLowerCase();
    const mimeType = ext === ".png"
        ? "image/png"
        : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
                ? "image/gif"
                : "image/jpeg";
    return { absolutePath, mimeType, fileName: match.slice(id.length + 1) };
}
function readPushMediaBase64(mediaId) {
    const file = resolvePushMediaFile(mediaId);
    if (!file)
        return null;
    const base64 = (0, node_fs_1.readFileSync)(file.absolutePath).toString("base64");
    return { base64, mimeType: file.mimeType };
}
