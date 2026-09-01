import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";
import type { MetaPortfolioPublic } from "./meta-whatsapp-portfolio.types";
import { graphPhotoSourceKey, isGenericMetaBusinessName } from "./meta-whatsapp-portfolio.map";

const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;

export type MetaPortfolioIdentity = {
  name: string | null;
  photoExt: "png" | "jpg" | null;
  updatedAt: string;
};

function identityDir(): string {
  return path.join(resolveDataDir(), "meta-whatsapp", "portfolio-identity");
}

function safeTenantId(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Identidade do portfólio inválida.");
  if (TENANT_ID_RE.test(id)) return id;
  return createHash("sha256").update(id).digest("hex").slice(0, 40);
}

function jsonPath(tenantId: string): string {
  return path.join(identityDir(), `${safeTenantId(tenantId)}.json`);
}

function photoPath(tenantId: string, ext: "png" | "jpg"): string {
  return path.join(identityDir(), `${safeTenantId(tenantId)}.${ext}`);
}

function ensureDir(): void {
  mkdirSync(identityDir(), { recursive: true });
}

export function readPortfolioIdentity(tenantId: string): MetaPortfolioIdentity | null {
  try {
    const file = jsonPath(tenantId);
    if (!existsSync(file)) return null;
    const row = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const photoExt = row.photoExt === "png" || row.photoExt === "jpg" ? row.photoExt : null;
    const name = String(row.name || "").trim() || null;
    const updatedAt = String(row.updatedAt || "").trim() || new Date().toISOString();
    return { name, photoExt, updatedAt };
  } catch {
    return null;
  }
}

export function writePortfolioIdentity(
  tenantId: string,
  input: { name?: string | null; photo?: { ext: "png" | "jpg"; bytes: Buffer } | null },
): MetaPortfolioIdentity {
  ensureDir();
  const current = readPortfolioIdentity(tenantId) || { name: null, photoExt: null, updatedAt: "" };
  const next: MetaPortfolioIdentity = {
    name: input.name !== undefined ? input.name : current.name,
    photoExt: current.photoExt,
    updatedAt: new Date().toISOString(),
  };
  if (input.photo) {
    if (current.photoExt && current.photoExt !== input.photo.ext) {
      const previous = photoPath(tenantId, current.photoExt);
      if (existsSync(previous)) unlinkSync(previous);
    }
    writeFileSync(photoPath(tenantId, input.photo.ext), input.photo.bytes);
    next.photoExt = input.photo.ext;
  }
  writeFileSync(jsonPath(tenantId), JSON.stringify(next), "utf8");
  return next;
}

export function readPortfolioPhoto(tenantId: string): { mime: string; bytes: Buffer } | null {
  const identity = readPortfolioIdentity(tenantId);
  if (!identity?.photoExt) return null;
  const file = photoPath(tenantId, identity.photoExt);
  if (!existsSync(file)) return null;
  const bytes = readFileSync(file);
  if (!bytes.length) return null;
  return {
    mime: identity.photoExt === "png" ? "image/png" : "image/jpeg",
    bytes,
  };
}

export function localPortfolioPhotoUrl(identity: MetaPortfolioIdentity | null): string | null {
  if (!identity?.photoExt) return null;
  return `/integrations/meta/whatsapp/portfolio/photo?v=${encodeURIComponent(identity.updatedAt)}`;
}

export function applyLocalPortfolioIdentity(
  tenantId: string,
  portfolio: MetaPortfolioPublic,
): MetaPortfolioPublic {
  const identity = readPortfolioIdentity(tenantId);
  if (!identity) return portfolio;
  return {
    ...portfolio,
    name: identity.name || portfolio.name,
    profilePictureUrl: localPortfolioPhotoUrl(identity) || portfolio.profilePictureUrl,
  };
}

function safeBusinessId(businessId: string): string | null {
  const id = String(businessId || "").trim();
  return /^\d{5,20}$/.test(id) ? id : null;
}

function businessPhotoBase(tenantId: string, businessId: string): string | null {
  const biz = safeBusinessId(businessId);
  if (!biz) return null;
  return path.join(identityDir(), `${safeTenantId(tenantId)}-${biz}`);
}

export type MetaPortfolioBusinessIdentity = {
  name: string | null;
  primaryPageId: string | null;
  primaryPageName: string | null;
  wabaId: string | null;
  photoExt: "png" | "jpg" | null;
  updatedAt: string;
  sourcePath: string | null;
};

function readBusinessMeta(
  tenantId: string,
  businessId: string,
): MetaPortfolioBusinessIdentity | null {
  const base = businessPhotoBase(tenantId, businessId);
  if (!base || !existsSync(`${base}.json`)) return null;
  try {
    const row = JSON.parse(readFileSync(`${base}.json`, "utf8")) as Record<string, unknown>;
    const photoExt = row.photoExt === "png" || row.photoExt === "jpg" ? row.photoExt : null;
    return {
      name: String(row.name || "").trim() || null,
      primaryPageId: String(row.primaryPageId || "").trim() || null,
      primaryPageName: String(row.primaryPageName || "").trim() || null,
      wabaId: String(row.wabaId || "").trim() || null,
      photoExt,
      updatedAt: String(row.updatedAt || "").trim() || new Date().toISOString(),
      sourcePath: String(row.sourcePath || "").trim() || null,
    };
  } catch {
    return null;
  }
}

function writeBusinessMeta(
  tenantId: string,
  businessId: string,
  patch: Partial<MetaPortfolioBusinessIdentity>,
): MetaPortfolioBusinessIdentity | null {
  const base = businessPhotoBase(tenantId, businessId);
  if (!base) return null;
  ensureDir();
  const current = readBusinessMeta(tenantId, businessId) || {
    name: null,
    primaryPageId: null,
    primaryPageName: null,
    wabaId: null,
    photoExt: null,
    updatedAt: "",
    sourcePath: null,
  };
  const next: MetaPortfolioBusinessIdentity = {
    name: patch.name !== undefined ? patch.name : current.name,
    primaryPageId: patch.primaryPageId !== undefined ? patch.primaryPageId : current.primaryPageId,
    primaryPageName: patch.primaryPageName !== undefined ? patch.primaryPageName : current.primaryPageName,
    wabaId: patch.wabaId !== undefined ? patch.wabaId : current.wabaId,
    photoExt: patch.photoExt !== undefined ? patch.photoExt : current.photoExt,
    updatedAt: patch.updatedAt || new Date().toISOString(),
    sourcePath: patch.sourcePath !== undefined ? patch.sourcePath : current.sourcePath,
  };
  writeFileSync(`${base}.json`, JSON.stringify(next), "utf8");
  return next;
}

export function writePortfolioBusinessPhoto(
  tenantId: string,
  businessId: string,
  photo: { ext: "png" | "jpg"; bytes: Buffer },
  sourceUrl?: string | null,
): string | null {
  const base = businessPhotoBase(tenantId, businessId);
  if (!base) return null;
  ensureDir();
  for (const ext of ["png", "jpg"] as const) {
    const previous = `${base}.${ext}`;
    if (ext !== photo.ext && existsSync(previous)) unlinkSync(previous);
  }
  writeFileSync(`${base}.${photo.ext}`, photo.bytes);
  const current = readBusinessMeta(tenantId, businessId);
  const sourcePath = graphPhotoSourceKey(sourceUrl) || current?.sourcePath || null;
  const sameSource = Boolean(sourcePath && current?.sourcePath && sourcePath === current.sourcePath);
  const updatedAt = sameSource && current?.updatedAt ? current.updatedAt : new Date().toISOString();
  writeBusinessMeta(tenantId, businessId, { photoExt: photo.ext, updatedAt, sourcePath });
  return `/integrations/meta/whatsapp/portfolio/photo?businessId=${encodeURIComponent(String(businessId).trim())}&v=${encodeURIComponent(updatedAt)}`;
}

function readPortfolioBusinessPhotoMeta(
  tenantId: string,
  businessId: string,
): { photoExt: "png" | "jpg" | null; updatedAt: string | null; sourcePath: string | null } | null {
  const meta = readBusinessMeta(tenantId, businessId);
  if (!meta) return null;
  return { photoExt: meta.photoExt, updatedAt: meta.updatedAt, sourcePath: meta.sourcePath };
}

export function writePortfolioBusinessIdentity(
  tenantId: string,
  portfolio: MetaPortfolioPublic,
): void {
  const id = String(portfolio.id || "").trim();
  if (!safeBusinessId(id)) return;
  const name = isGenericMetaBusinessName(portfolio.name) ? null : String(portfolio.name || "").trim() || null;
  const primaryPageId = String(portfolio.primaryPageId || "").trim() || null;
  const primaryPageName = String(portfolio.primaryPageName || "").trim() || null;
  const wabaId = String(portfolio.wabaId || "").trim() || null;
  const patch: Partial<MetaPortfolioBusinessIdentity> = {};
  if (name) patch.name = name;
  if (primaryPageId) patch.primaryPageId = primaryPageId;
  if (primaryPageName) patch.primaryPageName = primaryPageName;
  if (wabaId) patch.wabaId = wabaId;
  if (!Object.keys(patch).length) return;
  writeBusinessMeta(tenantId, id, patch);
}

export function applyLocalPortfolioBusinessIdentity(
  tenantId: string,
  portfolio: MetaPortfolioPublic,
): MetaPortfolioPublic {
  const id = String(portfolio.id || "").trim();
  if (!id) return portfolio;
  const stored = readBusinessMeta(tenantId, id);
  if (!stored) return portfolio;
  const liveName = isGenericMetaBusinessName(portfolio.name) ? null : portfolio.name;
  return {
    ...portfolio,
    name: liveName || stored.name || portfolio.name,
    primaryPageId: portfolio.primaryPageId || stored.primaryPageId,
    primaryPageName: portfolio.primaryPageName || stored.primaryPageName,
    wabaId: portfolio.wabaId || stored.wabaId,
  };
}

export function readPortfolioBusinessPhoto(
  tenantId: string,
  businessId: string,
): { mime: string; bytes: Buffer } | null {
  const base = businessPhotoBase(tenantId, businessId);
  if (!base) return null;
  try {
    const meta = existsSync(`${base}.json`)
      ? (JSON.parse(readFileSync(`${base}.json`, "utf8")) as { photoExt?: unknown })
      : {};
    const ext = meta.photoExt === "png" || meta.photoExt === "jpg" ? meta.photoExt : existsSync(`${base}.png`) ? "png" : existsSync(`${base}.jpg`) ? "jpg" : null;
    if (!ext) return null;
    const file = `${base}.${ext}`;
    if (!existsSync(file)) return null;
    const bytes = readFileSync(file);
    if (!bytes.length) return null;
    return { mime: ext === "png" ? "image/png" : "image/jpeg", bytes };
  } catch {
    return null;
  }
}

export function localPortfolioBusinessPhotoUrl(tenantId: string, businessId: string): string | null {
  const base = businessPhotoBase(tenantId, businessId);
  if (!base || !existsSync(`${base}.json`)) {
    if (base && (existsSync(`${base}.png`) || existsSync(`${base}.jpg`))) {
      return `/integrations/meta/whatsapp/portfolio/photo?businessId=${encodeURIComponent(String(businessId).trim())}`;
    }
    return null;
  }
  try {
    const row = JSON.parse(readFileSync(`${base}.json`, "utf8")) as { updatedAt?: unknown; photoExt?: unknown };
    if (row.photoExt !== "png" && row.photoExt !== "jpg") return null;
    const updatedAt = String(row.updatedAt || "").trim();
    return `/integrations/meta/whatsapp/portfolio/photo?businessId=${encodeURIComponent(String(businessId).trim())}${updatedAt ? `&v=${encodeURIComponent(updatedAt)}` : ""}`;
  } catch {
    return null;
  }
}

export function applyLocalPortfolioBusinessPhoto(
  tenantId: string,
  portfolio: MetaPortfolioPublic,
): MetaPortfolioPublic {
  const id = String(portfolio.id || "").trim();
  const local = id ? localPortfolioBusinessPhotoUrl(tenantId, id) : null;
  if (!local) return portfolio;
  return { ...portfolio, profilePictureUrl: local };
}

const BUSINESS_PHOTO_TTL_MS = 30 * 1000;

export function isPortfolioBusinessPhotoFresh(
  tenantId: string,
  businessId: string,
  ttlMs: number = BUSINESS_PHOTO_TTL_MS,
): boolean {
  const id = String(businessId || "").trim();
  if (!id || !readPortfolioBusinessPhoto(tenantId, id)) return false;
  const meta = readPortfolioBusinessPhotoMeta(tenantId, id);
  if (!meta?.updatedAt) return false;
  const age = Date.now() - Date.parse(meta.updatedAt);
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
}

export function shouldRefreshPortfolioBusinessPhoto(
  tenantId: string,
  businessId: string,
  sourceUrl: string | null,
  ttlMs: number = BUSINESS_PHOTO_TTL_MS,
): boolean {
  const id = String(businessId || "").trim();
  if (!id) return false;
  if (!readPortfolioBusinessPhoto(tenantId, id)) return true;
  const next = graphPhotoSourceKey(sourceUrl);
  const stored = readPortfolioBusinessPhotoMeta(tenantId, id)?.sourcePath || null;
  if (next && stored && next === stored) return false;
  if (next && stored && next !== stored) return true;
  if (next && !stored) return true;
  return !isPortfolioBusinessPhotoFresh(tenantId, id, ttlMs);
}

export function purgePortfolioIdentity(tenantId: string): void {
  try {
    const id = safeTenantId(tenantId);
    const dir = identityDir();
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir)) {
      if (file === `${id}.json` || file === `${id}.png` || file === `${id}.jpg` || file.startsWith(`${id}-`)) {
        unlinkSync(path.join(dir, file));
      }
    }
  } catch {
    // ignore
  }
}
