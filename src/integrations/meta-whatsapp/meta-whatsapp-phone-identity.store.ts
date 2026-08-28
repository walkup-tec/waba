import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";
import type { MetaPortfolioNumberPublic, MetaProfileSyncStatus } from "./meta-whatsapp-portfolio.types";
import { isMetaPhoneConnected, resolvePhoneNameSync } from "./meta-whatsapp-portfolio.map";

const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const PHONE_ID_RE = /^[a-zA-Z0-9._-]{4,80}$/;

export type MetaPhoneIdentity = {
  name: string | null;
  photoExt: "png" | "jpg" | null;
  vertical: string | null;
  description: string | null;
  address: string | null;
  email: string | null;
  photoMetaApplied: boolean;
  profileMetaApplied: boolean;
  inboxEnabled: boolean | null;
  displayPhoneNumber: string | null;
  channelName: string | null;
  updatedAt: string;
};

export type MetaPhoneInboxChannel = {
  phoneNumberId: string;
  name: string | null;
  displayPhoneNumber: string | null;
  profilePictureUrl: string | null;
  inboxEnabled: boolean;
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
    const vertical = String(row.vertical || "").trim() || null;
    const description = row.description === undefined || row.description === null ? null : String(row.description);
    const address = row.address === undefined || row.address === null ? null : String(row.address);
    const email = String(row.email || "").trim() || null;
    const photoMetaApplied = row.photoMetaApplied === true;
    const profileMetaApplied = row.profileMetaApplied === true;
    const inboxEnabled = row.inboxEnabled === false ? false : row.inboxEnabled === true ? true : null;
    const displayPhoneNumber = String(row.displayPhoneNumber || "").trim() || null;
    const channelName = String(row.channelName || "").trim() || null;
    const updatedAt = String(row.updatedAt || "").trim() || new Date().toISOString();
    return {
      name,
      photoExt,
      vertical,
      description,
      address,
      email,
      photoMetaApplied,
      profileMetaApplied,
      inboxEnabled,
      displayPhoneNumber,
      channelName,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function writePhoneIdentity(
  tenantId: string,
  phoneNumberId: string,
  input: {
    name?: string | null;
    photo?: { ext: "png" | "jpg"; bytes: Buffer } | null;
    vertical?: string | null;
    description?: string | null;
    address?: string | null;
    email?: string | null;
    photoMetaApplied?: boolean;
    profileMetaApplied?: boolean;
    inboxEnabled?: boolean;
    displayPhoneNumber?: string | null;
    channelName?: string | null;
  },
): MetaPhoneIdentity {
  ensureDir(tenantId);
  const current = readPhoneIdentity(tenantId, phoneNumberId) || {
    name: null,
    photoExt: null,
    vertical: null,
    description: null,
    address: null,
    email: null,
    photoMetaApplied: false,
    profileMetaApplied: false,
    inboxEnabled: null,
    displayPhoneNumber: null,
    channelName: null,
    updatedAt: "",
  };
  const bizTouched =
    input.vertical !== undefined ||
    input.description !== undefined ||
    input.address !== undefined ||
    input.email !== undefined;
  const next: MetaPhoneIdentity = {
    name: input.name !== undefined ? input.name : current.name,
    photoExt: current.photoExt,
    vertical: input.vertical !== undefined ? input.vertical : current.vertical,
    description: input.description !== undefined ? input.description : current.description,
    address: input.address !== undefined ? input.address : current.address,
    email: input.email !== undefined ? input.email : current.email,
    photoMetaApplied:
      input.photoMetaApplied !== undefined
        ? input.photoMetaApplied
        : input.photo
          ? false
          : current.photoMetaApplied,
    profileMetaApplied:
      input.profileMetaApplied !== undefined
        ? input.profileMetaApplied
        : bizTouched
          ? false
          : current.profileMetaApplied,
    inboxEnabled: input.inboxEnabled !== undefined ? input.inboxEnabled : current.inboxEnabled,
    displayPhoneNumber:
      input.displayPhoneNumber !== undefined ? input.displayPhoneNumber : current.displayPhoneNumber,
    channelName: input.channelName !== undefined ? input.channelName : current.channelName,
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

function textsMatch(local: string | null, meta: string | null): boolean {
  return String(local || "").trim() === String(meta || "").trim() && Boolean(String(local || "").trim());
}

export function phoneIdentitySyncStatus(input: {
  localPhoto: boolean;
  localDescription: string | null;
  metaDescription: string | null;
  photoMetaApplied?: boolean;
  profileMetaApplied?: boolean;
}): {
  photoSyncStatus: MetaProfileSyncStatus | null;
  profileSyncStatus: MetaProfileSyncStatus | null;
} {
  return {
    photoSyncStatus: input.localPhoto ? (input.photoMetaApplied ? "applied" : "pending") : null,
    profileSyncStatus: input.localDescription
      ? input.profileMetaApplied || textsMatch(input.localDescription, input.metaDescription)
        ? "applied"
        : "pending"
      : null,
  };
}

export function isPhoneInboxEnabled(identity: MetaPhoneIdentity | null): boolean {
  return identity?.inboxEnabled === true;
}

export function listPhoneInboxChannels(tenantId: string): MetaPhoneInboxChannel[] {
  try {
    const dir = tenantDir(tenantId);
    if (!existsSync(dir)) return [];
    const out: MetaPhoneInboxChannel[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const phoneNumberId = file.slice(0, -5);
      const identity = readPhoneIdentity(tenantId, phoneNumberId);
      if (!identity) continue;
      out.push({
        phoneNumberId,
        name: identity.channelName || identity.name,
        displayPhoneNumber: identity.displayPhoneNumber,
        profilePictureUrl: localPhonePhotoUrl(phoneNumberId, identity),
        inboxEnabled: isPhoneInboxEnabled(identity),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function applyLocalPhoneIdentities(
  tenantId: string,
  numbers: MetaPortfolioNumberPublic[],
): MetaPortfolioNumberPublic[] {
  return numbers.map((row) => {
    const identity = readPhoneIdentity(tenantId, row.phoneNumberId);
    const nameSync = resolvePhoneNameSync({
      verifiedName: row.verifiedName,
      nameStatus: row.nameStatus,
      newDisplayName: row.newDisplayName || identity?.name || null,
      newNameStatus: row.newNameStatus,
      localName: identity?.name || null,
    });
    const connected = isMetaPhoneConnected(row.metaStatus);
    if (!identity) {
      return {
        ...row,
        requestedName: nameSync.requestedName,
        nameSyncStatus: nameSync.nameSyncStatus,
        nameNeedsRegister: nameSync.nameNeedsRegister,
        canActivate: !connected || nameSync.nameNeedsRegister,
        photoSyncStatus: null,
        profileSyncStatus: null,
        inboxEnabled: false,
      };
    }
    const sync = phoneIdentitySyncStatus({
      localPhoto: Boolean(identity.photoExt),
      localDescription: String(identity.description || "").trim() || null,
      metaDescription: row.description,
      photoMetaApplied: identity.photoMetaApplied,
      profileMetaApplied: identity.profileMetaApplied,
    });
    const photoApplied = sync.photoSyncStatus === "applied";
    const profileApplied = sync.profileSyncStatus === "applied";
    const localPhoto = localPhonePhotoUrl(row.phoneNumberId, identity);
    return {
      ...row,
      requestedName: nameSync.requestedName,
      verifiedName: row.verifiedName,
      profilePictureUrl: localPhoto || null,
      vertical: profileApplied ? identity.vertical || row.vertical : row.vertical,
      description: profileApplied ? identity.description ?? row.description : row.description,
      address: profileApplied ? identity.address ?? row.address : row.address,
      email: profileApplied ? identity.email || row.email : row.email,
      nameSyncStatus: nameSync.nameSyncStatus,
      nameNeedsRegister: nameSync.nameNeedsRegister,
      canActivate: !connected || nameSync.nameNeedsRegister,
      photoSyncStatus: photoApplied || localPhoto ? (photoApplied ? "applied" : sync.photoSyncStatus) : null,
      profileSyncStatus: sync.profileSyncStatus,
      inboxEnabled: isPhoneInboxEnabled(identity),
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
