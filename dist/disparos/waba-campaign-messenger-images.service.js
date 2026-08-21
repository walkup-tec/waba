"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readImageDimensions = readImageDimensions;
exports.saveCampaignMessengerImage = saveCampaignMessengerImage;
exports.resolveCampaignMessengerImageFile = resolveCampaignMessengerImageFile;
exports.readCampaignMessengerImageBase64 = readCampaignMessengerImageBase64;
exports.normalizeMessengerImagesConfig = normalizeMessengerImagesConfig;
exports.messengerImagesAreComplete = messengerImagesAreComplete;
exports.pickNextMessengerImageIndex = pickNextMessengerImageIndex;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const data_path_1 = require("../data-path");
const MEDIA_DIR = "campaign-messenger-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUIRED_SIZE = 1080;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
function resolveMediaDir() {
    const dir = node_path_1.default.join((0, data_path_1.resolveDataDir)(), MEDIA_DIR);
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
/** Lê width/height de PNG ou JPEG sem dependência externa. */
function readImageDimensions(buffer) {
    if (!buffer || buffer.length < 24)
        return null;
    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return {
            width: buffer.readUInt32BE(16),
            height: buffer.readUInt32BE(20),
        };
    }
    // JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        let i = 2;
        while (i < buffer.length - 9) {
            if (buffer[i] !== 0xff) {
                i += 1;
                continue;
            }
            const marker = buffer[i + 1];
            if (marker === 0xd9 || marker === 0xda)
                break;
            if (marker >= 0xc0 && marker <= 0xc3) {
                return {
                    height: buffer.readUInt16BE(i + 5),
                    width: buffer.readUInt16BE(i + 7),
                };
            }
            const len = buffer.readUInt16BE(i + 2);
            if (len < 2)
                break;
            i += 2 + len;
        }
    }
    // WebP (VP8X / VP8 )
    if (buffer.length >= 30 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP") {
        const chunk = buffer.toString("ascii", 12, 16);
        if (chunk === "VP8X" && buffer.length >= 30) {
            const w = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16);
            const h = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16);
            return { width: w, height: h };
        }
        if (chunk === "VP8 " && buffer.length >= 30) {
            const w = buffer.readUInt16LE(26) & 0x3fff;
            const h = buffer.readUInt16LE(28) & 0x3fff;
            return { width: w, height: h };
        }
    }
    return null;
}
function saveCampaignMessengerImage(input) {
    const slot = Math.floor(Number(input.slot));
    if (!Number.isFinite(slot) || slot < 0 || slot > 3) {
        throw new Error("Slot inválido. Use 1 a 4 (índice 0–3).");
    }
    const mimeType = String(input.mimeType || "").trim().toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
        throw new Error("Formato inválido. Use JPEG, PNG ou WebP.");
    }
    if (!input.buffer?.length || input.buffer.length > MAX_IMAGE_BYTES) {
        throw new Error("Imagem inválida ou maior que 5 MB.");
    }
    const dims = readImageDimensions(input.buffer);
    if (!dims || dims.width !== REQUIRED_SIZE || dims.height !== REQUIRED_SIZE) {
        throw new Error(`A imagem deve ter exatamente ${REQUIRED_SIZE}×${REQUIRED_SIZE} px.`);
    }
    const id = (0, node_crypto_1.randomUUID)();
    const safeName = sanitizeFileName(input.fileName);
    const storageName = `${id}-${safeName}`;
    (0, node_fs_1.writeFileSync)(node_path_1.default.join(resolveMediaDir(), storageName), input.buffer);
    return {
        id,
        fileName: safeName,
        mimeType,
        width: dims.width,
        height: dims.height,
        sizeBytes: input.buffer.length,
        slot,
        createdAt: new Date().toISOString(),
    };
}
function resolveCampaignMessengerImageFile(mediaId) {
    const id = String(mediaId || "").trim();
    if (!isSafeMediaId(id))
        return null;
    const dir = resolveMediaDir();
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
    const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return { absolutePath, mimeType, fileName: match.slice(id.length + 1) };
}
function readCampaignMessengerImageBase64(mediaId) {
    const file = resolveCampaignMessengerImageFile(mediaId);
    if (!file)
        return null;
    const buf = (0, node_fs_1.readFileSync)(file.absolutePath);
    return {
        base64: buf.toString("base64"),
        mimeType: file.mimeType,
        fileName: file.fileName,
        sizeBytes: buf.length,
    };
}
function normalizeMessengerImagesConfig(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const row of raw) {
        const id = String(row?.id || "").trim();
        if (!isSafeMediaId(id))
            continue;
        const file = resolveCampaignMessengerImageFile(id);
        if (!file)
            continue;
        const slot = Math.floor(Number(row?.slot));
        out.push({
            id,
            fileName: String(row?.fileName || file.fileName).slice(0, 120),
            mimeType: String(row?.mimeType || file.mimeType),
            width: Number(row?.width) || REQUIRED_SIZE,
            height: Number(row?.height) || REQUIRED_SIZE,
            sizeBytes: Number(row?.sizeBytes) || 0,
            slot: Number.isFinite(slot) ? Math.max(0, Math.min(3, slot)) : out.length,
            createdAt: String(row?.createdAt || new Date().toISOString()),
        });
    }
    out.sort((a, b) => a.slot - b.slot);
    return out.slice(0, 4);
}
function messengerImagesAreComplete(images) {
    if (!Array.isArray(images) || images.length !== 4)
        return false;
    const slots = new Set(images.map((i) => i.slot));
    return slots.size === 4 && images.every((i) => isSafeMediaId(i.id));
}
/** Round-robin estável por campanha (0→1→2→3→0…). */
function pickNextMessengerImageIndex(cursorMap, campaignId, imageCount = 4) {
    const id = String(campaignId || "").trim();
    const n = Math.max(1, imageCount);
    const cur = cursorMap.get(id) || 0;
    const idx = ((cur % n) + n) % n;
    cursorMap.set(id, cur + 1);
    return idx;
}
