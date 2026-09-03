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
  const preview = readTemplateHeaderPreview(input.tenantId, input.fromHandle);
  if (!preview) return;
  for (const raw of input.toHandles) {
    const toHandle = String(raw || "").trim();
    if (!toHandle || toHandle === input.fromHandle) continue;
    saveTemplateHeaderPreview({
      tenantId: input.tenantId,
      handle: toHandle,
      mime: preview.mime,
      bytes: preview.bytes,
    });
  }
}

export function readTemplateHeaderPreviewForSend(input: {
  tenantId: string;
  handle?: string;
  templateId?: string;
}): { mime: string; bytes: Buffer } | null {
  const handle = String(input.handle || "").trim();
  const templateId = String(input.templateId || "").trim();
  return (
    (handle ? readTemplateHeaderPreview(input.tenantId, handle) : null) ||
    (templateId ? readTemplateHeaderPreview(input.tenantId, templateId) : null)
  );
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
}): string | null {
  const handle = headerHandleFromComponents(input.components);
  const id = String(input.id || "").trim();
  const hasLocal =
    Boolean(handle && hasTemplateHeaderPreview(input.tenantId, handle)) ||
    Boolean(id && hasTemplateHeaderPreview(input.tenantId, id));
  if (hasLocal && id) {
    return `/integrations/meta/whatsapp/templates/${encodeURIComponent(id)}/header`;
  }
  return headerHttpsUrlFromComponents(input.components);
}
