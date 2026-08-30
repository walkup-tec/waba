import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";
import type { MetaPortfolioPublic } from "./meta-whatsapp-portfolio.types";

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

export function writePortfolioBusinessPhoto(
  tenantId: string,
  businessId: string,
  photo: { ext: "png" | "jpg"; bytes: Buffer },
): string | null {
  const base = businessPhotoBase(tenantId, businessId);
  if (!base) return null;
  ensureDir();
  for (const ext of ["png", "jpg"] as const) {
    const previous = `${base}.${ext}`;
    if (ext !== photo.ext && existsSync(previous)) unlinkSync(previous);
  }
  writeFileSync(`${base}.${photo.ext}`, photo.bytes);
  const updatedAt = new Date().toISOString();
  writeFileSync(`${base}.json`, JSON.stringify({ photoExt: photo.ext, updatedAt }), "utf8");
  return `/integrations/meta/whatsapp/portfolio/photo?businessId=${encodeURIComponent(String(businessId).trim())}&v=${encodeURIComponent(updatedAt)}`;
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

export function purgePortfolioIdentity(tenantId: string): void {
  try {
    const id = safeTenantId(tenantId);
    for (const file of [`${id}.json`, `${id}.png`, `${id}.jpg`]) {
      const full = path.join(identityDir(), file);
      if (existsSync(full)) unlinkSync(full);
    }
  } catch {
    // ignore
  }
}
