import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";

const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeTenantId(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) return "";
  if (TENANT_ID_RE.test(id)) return id;
  return createHash("sha256").update(id).digest("hex").slice(0, 40);
}

function handleKey(handle: string): string {
  return createHash("sha256").update(String(handle || "").trim()).digest("hex").slice(0, 40);
}

function headersDir(tenantId: string): string {
  return path.join(resolveDataDir(), "meta-whatsapp", "template-headers", safeTenantId(tenantId));
}

export function headerHandleFromComponents(components: unknown): string {
  if (!Array.isArray(components)) return "";
  for (const item of components) {
    const row = asRecord(item);
    if (String(row.type || "").trim().toUpperCase() !== "HEADER") continue;
    const example = asRecord(row.example);
    const handles = Array.isArray(example.header_handle) ? example.header_handle : [];
    const handle = String(handles[0] || "").trim();
    if (handle) return handle;
  }
  return "";
}

export function headerHttpsUrlFromComponents(components: unknown): string | null {
  const handle = headerHandleFromComponents(components);
  if (/^https:\/\//i.test(handle)) return handle;
  return null;
}

function extFromMime(mime: string, fileName: string): string {
  const type = String(mime || "").trim().toLowerCase();
  const name = String(fileName || "").trim().toLowerCase();
  if (type === "image/png" || name.endsWith(".png")) return "png";
  if (type === "image/jpeg" || type === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (type === "video/mp4" || name.endsWith(".mp4")) return "mp4";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "bin";
}

function mimeFromExt(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "jpg") return "image/jpeg";
  if (ext === "mp4") return "video/mp4";
  if (ext === "pdf") return "application/pdf";
  return "application/octet-stream";
}

function filePath(tenantId: string, handle: string, ext: string): string {
  return path.join(headersDir(tenantId), `${handleKey(handle)}.${ext}`);
}

export function saveTemplateHeaderPreview(input: {
  tenantId: string;
  handle: string;
  mime?: string;
  fileName?: string;
  bytes: Buffer;
}): void {
  const tenantId = safeTenantId(input.tenantId);
  const handle = String(input.handle || "").trim();
  if (!tenantId || !handle || !input.bytes?.length) return;
  const ext = extFromMime(input.mime || "", input.fileName || "");
  mkdirSync(headersDir(input.tenantId), { recursive: true });
  writeFileSync(filePath(input.tenantId, handle, ext), input.bytes);
}

export function copyTemplateHeaderPreview(input: {
  tenantId: string;
  fromHandle: string;
  toHandles: string[];
}): void {
  aliasTemplateHeaderPreview({
    tenantId: input.tenantId,
    fromKeys: [input.fromHandle],
    toKeys: input.toHandles,
  });
}

/** Chaves estáveis: o handle da Graph vira URL lookaside e alguns templates passam a compartilhar a mesma. */
export function templateHeaderPreviewKeys(input: {
  handle?: string | null;
  templateId?: string | null;
  metaTemplateId?: string | null;
  name?: string | null;
  language?: string | null;
}): string[] {
  const name = String(input.name || "").trim().toLowerCase();
  const language = String(input.language || "").trim();
  const keys = [
    String(input.handle || "").trim(),
    String(input.templateId || "").trim(),
    String(input.metaTemplateId || "").trim(),
    name && language ? `${name}::${language}` : "",
    name ? `name:${name}` : "",
  ].filter(Boolean);
  return [...new Set(keys)];
}

export function aliasTemplateHeaderPreview(input: {
  tenantId: string;
  fromKeys: string[];
  toKeys: string[];
}): boolean {
  let preview: { mime: string; bytes: Buffer } | null = null;
  for (const raw of input.fromKeys) {
    preview = readTemplateHeaderPreview(input.tenantId, raw);
    if (preview) break;
  }
  if (!preview) return false;
  for (const raw of input.toKeys) {
    const toHandle = String(raw || "").trim();
    if (!toHandle) continue;
    saveTemplateHeaderPreview({
      tenantId: input.tenantId,
      handle: toHandle,
      mime: preview.mime,
      bytes: preview.bytes,
    });
  }
  return true;
}

export function bindTemplateHeaderPreview(input: {
  tenantId: string;
  handle?: string | null;
  templateId?: string | null;
  metaTemplateId?: string | null;
  name?: string | null;
  language?: string | null;
  previousHandle?: string | null;
}): boolean {
  const toKeys = templateHeaderPreviewKeys(input);
  const fromKeys = templateHeaderPreviewKeys({
    handle: input.previousHandle || input.handle,
    templateId: input.templateId,
    metaTemplateId: input.metaTemplateId,
    name: input.name,
    language: input.language,
  });
  if (input.handle) fromKeys.unshift(String(input.handle).trim());
  if (input.previousHandle) fromKeys.unshift(String(input.previousHandle).trim());
  return aliasTemplateHeaderPreview({
    tenantId: input.tenantId,
    fromKeys: [...new Set(fromKeys.filter(Boolean))],
    toKeys,
  });
}

export function saveTemplateHeaderPreviewAliases(input: {
  tenantId: string;
  mime?: string;
  fileName?: string;
  bytes: Buffer;
  aliases: string[];
}): void {
  for (const alias of [...new Set(input.aliases.map((item) => String(item || "").trim()).filter(Boolean))]) {
    saveTemplateHeaderPreview({
      tenantId: input.tenantId,
      handle: alias,
      mime: input.mime,
      fileName: input.fileName,
      bytes: input.bytes,
    });
  }
}

export function readTemplateHeaderPreviewForSend(input: {
  tenantId: string;
  handle?: string | null;
  templateId?: string | null;
  metaTemplateId?: string | null;
  name?: string | null;
  language?: string | null;
}): { mime: string; bytes: Buffer } | null {
  bindTemplateHeaderPreview(input);
  for (const key of templateHeaderPreviewKeys(input)) {
    const found = readTemplateHeaderPreview(input.tenantId, key);
    if (found) return found;
  }
  return null;
}

export function readTemplateHeaderPreview(
  tenantId: string,
  handle: string,
): { mime: string; bytes: Buffer } | null {
  const id = safeTenantId(tenantId);
  const key = String(handle || "").trim();
  if (!id || !key) return null;
  const dir = headersDir(tenantId);
  if (!existsSync(dir)) return null;
  for (const ext of ["png", "jpg", "mp4", "pdf", "bin"]) {
    const file = filePath(tenantId, key, ext);
    if (!existsSync(file)) continue;
    const bytes = readFileSync(file);
    if (!bytes.length) continue;
    return { mime: mimeFromExt(ext), bytes };
  }
  return null;
}

export function hasTemplateHeaderPreview(tenantId: string, handle: string): boolean {
  return Boolean(readTemplateHeaderPreview(tenantId, handle));
}

export function publicTemplateHeaderPreviewUrl(input: {
  id: string;
  tenantId: string;
  components: unknown;
  metaTemplateId?: string | null;
  name?: string | null;
  language?: string | null;
}): string | null {
  const handle = headerHandleFromComponents(input.components);
  const id = String(input.id || "").trim();
  const hasLocal = Boolean(
    readTemplateHeaderPreviewForSend({
      tenantId: input.tenantId,
      handle,
      templateId: id,
      metaTemplateId: input.metaTemplateId || undefined,
      name: input.name || undefined,
      language: input.language || undefined,
    }),
  );
  if (hasLocal && id) {
    return `/integrations/meta/whatsapp/templates/${encodeURIComponent(id)}/header`;
  }
  return null;
}
