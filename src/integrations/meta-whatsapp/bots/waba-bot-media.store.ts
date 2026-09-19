import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../../data-path";
import type { BotMediaKind } from "./waba-bot.types";

const TENANT_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const REF_RE = /^media-[a-zA-Z0-9]{8,32}$/;
const MAX_BYTES = 16 * 1024 * 1024;

export type SavedBotMedia = {
  mediaRef: string;
  mediaKind: BotMediaKind;
  fileName: string;
  mime: string;
  size: number;
};

function safeTenantId(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Tenant inválido para mídia do bot.");
  if (TENANT_RE.test(id)) return id;
  return createHash("sha256").update(id).digest("hex").slice(0, 40);
}

function mediaDir(tenantId: string): string {
  return path.join(resolveDataDir(), "meta-whatsapp", "bots", safeTenantId(tenantId), "media");
}

function extensionFor(kind: BotMediaKind, mime: string, fileName: string): string {
  const name = String(fileName || "").toLowerCase();
  const type = String(mime || "").toLowerCase();
  if (kind === "pdf" || type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (kind === "video" || type.includes("mp4") || name.endsWith(".mp4")) return "mp4";
  if (name.endsWith(".3gp") || type.includes("3gpp")) return "3gp";
  if (name.endsWith(".opus") || type.includes("opus")) return "opus";
  if (name.endsWith(".ogg") || type.includes("ogg")) return "ogg";
  if (name.endsWith(".m4a") || type === "audio/mp4") return "m4a";
  if (name.endsWith(".aac") || type.includes("aac")) return "aac";
  if (name.endsWith(".amr") || type.includes("amr")) return "amr";
  if (name.endsWith(".mp3") || type.includes("mpeg")) return "mp3";
  return kind === "audio" ? "ogg" : kind === "pdf" ? "pdf" : "mp4";
}

export function inferBotMediaMime(kind: BotMediaKind, mime: string, fileName: string): string {
  const type = String(mime || "").trim().toLowerCase();
  if (type && type !== "application/octet-stream") return type;
  const name = String(fileName || "").toLowerCase();
  if (kind === "pdf" || name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".3gp")) return "video/3gpp";
  if (kind === "video" || name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".opus")) return "audio/opus";
  if (name.endsWith(".ogg")) return "audio/ogg";
  if (name.endsWith(".m4a")) return "audio/mp4";
  if (name.endsWith(".aac")) return "audio/aac";
  if (name.endsWith(".amr")) return "audio/amr";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  return kind === "audio" ? "audio/ogg" : "video/mp4";
}

export function assertBotMediaFile(input: {
  mediaKind: BotMediaKind;
  mime: string;
  fileName: string;
  bytes: Buffer;
}): { mime: string; fileName: string } {
  const kind = input.mediaKind;
  const bytes = input.bytes;
  if (!bytes?.length) throw new Error("Selecione o arquivo de mídia.");
  if (bytes.length > MAX_BYTES) throw new Error("A mídia pode ter no máximo 16 MB.");
  const mime = inferBotMediaMime(kind, input.mime, input.fileName);
  const name = String(input.fileName || "").toLowerCase();
  if (kind === "video" && !mime.includes("mp4") && !mime.includes("3gpp") && !name.endsWith(".mp4") && !name.endsWith(".3gp")) {
    throw new Error("Vídeo: envie MP4 (H.264) ou 3GP.");
  }
  if (kind === "pdf" && !mime.includes("pdf") && !name.endsWith(".pdf")) {
    throw new Error("Documento: envie um PDF.");
  }
  if (
    kind === "audio" &&
    !/ogg|opus|mpeg|mp4|aac|amr|mp3/.test(mime) &&
    !/\.(ogg|opus|mp3|m4a|aac|amr)$/.test(name)
  ) {
    throw new Error("Áudio: OGG/OPUS (nota de voz), MP3, M4A, AAC ou AMR.");
  }
  const fileName = String(input.fileName || "").trim() || `midia.${extensionFor(kind, mime, "")}`;
  return { mime, fileName };
}

export function saveBotMedia(input: {
  tenantId: string;
  mediaKind: BotMediaKind;
  mime: string;
  fileName: string;
  bytes: Buffer;
}): SavedBotMedia {
  const checked = assertBotMediaFile(input);
  const mediaRef = `media-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const ext = extensionFor(input.mediaKind, checked.mime, checked.fileName);
  const dir = mediaDir(input.tenantId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${mediaRef}.${ext}`), input.bytes);
  writeFileSync(
    path.join(dir, `${mediaRef}.json`),
    JSON.stringify({
      mediaRef,
      mediaKind: input.mediaKind,
      fileName: checked.fileName,
      mime: checked.mime,
      size: input.bytes.length,
    }),
    "utf8",
  );
  return {
    mediaRef,
    mediaKind: input.mediaKind,
    fileName: checked.fileName,
    mime: checked.mime,
    size: input.bytes.length,
  };
}

export function readBotMedia(
  tenantId: string,
  mediaRef: string,
): { bytes: Buffer; mime: string; fileName: string; mediaKind: BotMediaKind } | null {
  const id = String(mediaRef || "").trim();
  if (!REF_RE.test(id)) return null;
  const dir = mediaDir(tenantId);
  const metaFile = path.join(dir, `${id}.json`);
  if (!existsSync(metaFile)) return null;
  try {
    const meta = JSON.parse(readFileSync(metaFile, "utf8")) as SavedBotMedia;
    const ext = extensionFor(meta.mediaKind, meta.mime, meta.fileName);
    const file = path.join(dir, `${id}.${ext}`);
    if (!existsSync(file)) return null;
    return {
      bytes: readFileSync(file),
      mime: meta.mime,
      fileName: meta.fileName,
      mediaKind: meta.mediaKind,
    };
  } catch {
    return null;
  }
}
