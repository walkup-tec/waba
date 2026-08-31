import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveDataDir } from "../data-path";

const MEDIA_DIR = "campaign-messenger-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUIRED_SIZE = 1080;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CampaignMessengerImageMeta = {
  id: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  slot: number;
  createdAt: string;
};

function resolveMediaDir(): string {
  const dir = path.join(resolveDataDir(), MEDIA_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function sanitizeFileName(value: string): string {
  const base = path.basename(String(value || "imagem").trim()) || "imagem";
  return base.replace(/[^\w.\-()+\s]/g, "_").slice(0, 120);
}

function isSafeMediaId(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(String(id || "").trim());
}

/** Lê width/height de PNG ou JPEG sem dependência externa. */
export function readImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (!buffer || buffer.length < 24) return null;
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
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: buffer.readUInt16BE(i + 5),
          width: buffer.readUInt16BE(i + 7),
        };
      }
      const len = buffer.readUInt16BE(i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
  }
  // WebP (VP8X / VP8 )
  if (
    buffer.length >= 30 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
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

export function saveCampaignMessengerImage(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  slot: number;
}): CampaignMessengerImageMeta {
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

  const id = randomUUID();
  const safeName = sanitizeFileName(input.fileName);
  const storageName = `${id}-${safeName}`;
  writeFileSync(path.join(resolveMediaDir(), storageName), input.buffer);

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

export function resolveCampaignMessengerImageFile(
  mediaId: string,
): { absolutePath: string; mimeType: string; fileName: string } | null {
  const id = String(mediaId || "").trim();
  if (!isSafeMediaId(id)) return null;
  const dir = resolveMediaDir();
  const entries = existsSync(dir)
    ? readdirSync(dir).filter((name) => name.startsWith(`${id}-`))
    : [];
  const match = entries[0];
  if (!match) return null;
  const absolutePath = path.join(dir, match);
  if (!existsSync(absolutePath)) return null;
  const ext = path.extname(match).toLowerCase();
  const mimeType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { absolutePath, mimeType, fileName: match.slice(id.length + 1) };
}

export function readCampaignMessengerImageBase64(
  mediaId: string,
): { base64: string; mimeType: string; fileName: string; sizeBytes: number } | null {
  const file = resolveCampaignMessengerImageFile(mediaId);
  if (!file) return null;
  const buf = readFileSync(file.absolutePath);
  return {
    base64: buf.toString("base64"),
    mimeType: file.mimeType,
    fileName: file.fileName,
    sizeBytes: buf.length,
  };
}

export function normalizeMessengerImagesConfig(raw: unknown): CampaignMessengerImageMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: CampaignMessengerImageMeta[] = [];
  for (const row of raw) {
    const id = String((row as any)?.id || "").trim();
    if (!isSafeMediaId(id)) continue;
    const file = resolveCampaignMessengerImageFile(id);
    if (!file) continue;
    const slot = Math.floor(Number((row as any)?.slot));
    out.push({
      id,
      fileName: String((row as any)?.fileName || file.fileName).slice(0, 120),
      mimeType: String((row as any)?.mimeType || file.mimeType),
      width: Number((row as any)?.width) || REQUIRED_SIZE,
      height: Number((row as any)?.height) || REQUIRED_SIZE,
      sizeBytes: Number((row as any)?.sizeBytes) || 0,
      slot: Number.isFinite(slot) ? Math.max(0, Math.min(3, slot)) : out.length,
      createdAt: String((row as any)?.createdAt || new Date().toISOString()),
    });
  }
  out.sort((a, b) => a.slot - b.slot);
  return out.slice(0, 4);
}

export function messengerImagesAreComplete(images: CampaignMessengerImageMeta[]): boolean {
  if (!Array.isArray(images) || images.length !== 4) return false;
  const slots = new Set(images.map((i) => i.slot));
  return slots.size === 4 && images.every((i) => isSafeMediaId(i.id));
}

/** Round-robin estável por campanha (0→1→2→3→0…). */
export function pickNextMessengerImageIndex(
  cursorMap: Map<string, number>,
  campaignId: string,
  imageCount = 4,
): number {
  const id = String(campaignId || "").trim();
  const n = Math.max(1, imageCount);
  const cur = cursorMap.get(id) || 0;
  const idx = ((cur % n) + n) % n;
  cursorMap.set(id, cur + 1);
  return idx;
}
