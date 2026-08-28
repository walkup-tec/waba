import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";
import type { MetaPortfolioNumberPublic } from "./meta-whatsapp-portfolio.types";

const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const PHONE_ID_RE = /^[a-zA-Z0-9._-]{4,80}$/;

export type MetaPhoneIdentity = {
  name: string | null;
  photoExt: "png" | "jpg" | null;
  updatedAt: string;
};

function safeTenantId(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("Identidade do número inválida.");
  if (TENANT_ID_RE.test(id)) return id;
  return createHash("sha256").update(id).digest("hex").slice(0, 40);
}

function safePhoneId(phoneNumberId: string): string {
  const id = String(phoneNumberId || "").trim();
  if (!PHONE_ID_RE.test(id)) throw new Error("Identidade do número inválida.");
  return id;
}

function tenantDir(tenantId: string): string {
  return path.join(resolveDataDir(), "meta-whatsapp", "phone-identity", safeTenantId(tenantId));
}

function jsonPath(tenantId: string, phoneNumberId: string): string {
  return path.join(tenantDir(tenantId), `${safePhoneId(phoneNumberId)}.json`);
}

function photoPath(tenantId: string, phoneNumberId: string, ext: "png" | "jpg"): string {
  return path.join(tenantDir(tenantId), `${safePhoneId(phoneNumberId)}.${ext}`);
}

function ensureDir(tenantId: string): void {
  mkdirSync(tenantDir(tenantId), { recursive: true });
}

export function readPhoneIdentity(tenantId: string, phoneNumberId: string): MetaPhoneIdentity | null {
  try {
    const file = jsonPath(tenantId, phoneNumberId);
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

export function writePhoneIdentity(
  tenantId: string,
  phoneNumberId: string,
  input: { name?: string | null; photo?: { ext: "png" | "jpg"; bytes: Buffer } | null },
): MetaPhoneIdentity {
  ensureDir(tenantId);
  const current = readPhoneIdentity(tenantId, phoneNumberId) || {
    name: null,
    photoExt: null,
    updatedAt: "",
  };
  const next: MetaPhoneIdentity = {
    name: input.name !== undefined ? input.name : current.name,
    photoExt: current.photoExt,
    updatedAt: new Date().toISOString(),
  };
  if (input.photo) {
    if (current.photoExt && current.photoExt !== input.photo.ext) {
      const previous = photoPath(tenantId, phoneNumberId, current.photoExt);
      if (existsSync(previous)) unlinkSync(previous);
    }
    writeFileSync(photoPath(tenantId, phoneNumberId, input.photo.ext), input.photo.bytes);
    next.photoExt = input.photo.ext;
  }
  writeFileSync(jsonPath(tenantId, phoneNumberId), JSON.stringify(next), "utf8");
  return next;
}

export function readPhonePhoto(
  tenantId: string,
  phoneNumberId: string,
): { mime: string; bytes: Buffer } | null {
  const identity = readPhoneIdentity(tenantId, phoneNumberId);
  if (!identity?.photoExt) return null;
  const file = photoPath(tenantId, phoneNumberId, identity.photoExt);
  if (!existsSync(file)) return null;
  const bytes = readFileSync(file);
  if (!bytes.length) return null;
  return {
    mime: identity.photoExt === "png" ? "image/png" : "image/jpeg",
    bytes,
  };
}

export function localPhonePhotoUrl(
  phoneNumberId: string,
  identity: MetaPhoneIdentity | null,
): string | null {
  if (!identity?.photoExt) return null;
  return `/integrations/meta/whatsapp/phone-numbers/photo?id=${encodeURIComponent(phoneNumberId)}&v=${encodeURIComponent(identity.updatedAt)}`;
}

export function applyLocalPhoneIdentities(
  tenantId: string,
  numbers: MetaPortfolioNumberPublic[],
): MetaPortfolioNumberPublic[] {
  return numbers.map((row) => {
    const identity = readPhoneIdentity(tenantId, row.phoneNumberId);
    if (!identity) return row;
    return {
      ...row,
      verifiedName: identity.name || row.verifiedName,
      profilePictureUrl: localPhonePhotoUrl(row.phoneNumberId, identity) || row.profilePictureUrl,
    };
  });
}

export function purgePhoneIdentities(tenantId: string): void {
  try {
    const dir = tenantDir(tenantId);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
