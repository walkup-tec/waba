import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";
import type {
  MetaPortfolioNumberPublic,
  MetaPortfolioNumberUiStatus,
  MetaProfileSyncStatus,
} from "./meta-whatsapp-portfolio.types";
import { META_WHATSAPP_DEFAULT_DISPLAY_NAME } from "./meta-whatsapp-phone-profile";
import { namesEqual, resolvePhoneNameSync, resolveMetaPhoneUiStatus, canActivateMetaPhoneNumber } from "./meta-whatsapp-portfolio.map";
import { isHiddenBusiness } from "./meta-whatsapp-hidden-business.store";
import { metaBusinessIdsMatch } from "./meta-whatsapp-known-owned-wabas";

const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const PHONE_ID_RE = /^[a-zA-Z0-9._-]{4,80}$/;

export type MetaPhoneIdentity = {
  name: string | null;
  photoExt: "png" | "jpg" | null;
  photoSource: string | null;
  vertical: string | null;
  description: string | null;
  address: string | null;
  email: string | null;
  photoMetaApplied: boolean;
  profileMetaApplied: boolean;
  inboxEnabled: boolean | null;
  uiStatus: MetaPortfolioNumberUiStatus | null;
  portfolioHidden: boolean | null;
  businessId: string | null;
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
  inboxEligible: boolean;
};

export type InboxAccountHint = {
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  metaBusinessId?: string | null;
};

function phoneDigits(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

function phonesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = phoneDigits(left);
  const b = phoneDigits(right);
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

function parseStoredUiStatus(value: unknown): MetaPortfolioNumberUiStatus | null {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "ativo" || raw === "pendente" || raw === "restrito") return raw;
  return null;
}

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
    const photoSource = String(row.photoSource || "").trim() || null;
    const name = String(row.name || "").trim() || null;
    const vertical = String(row.vertical || "").trim() || null;
    const description = row.description === undefined || row.description === null ? null : String(row.description);
    const address = row.address === undefined || row.address === null ? null : String(row.address);
    const email = String(row.email || "").trim() || null;
    const photoMetaApplied = row.photoMetaApplied === true;
    const profileMetaApplied = row.profileMetaApplied === true;
    const inboxEnabled = row.inboxEnabled === false ? false : row.inboxEnabled === true ? true : null;
    const uiStatus = parseStoredUiStatus(row.uiStatus);
    const portfolioHidden = row.portfolioHidden === true ? true : row.portfolioHidden === false ? false : null;
    const businessId = String(row.businessId || "").replace(/\D/g, "") || null;
    const displayPhoneNumber = String(row.displayPhoneNumber || "").trim() || null;
    const channelName = String(row.channelName || "").trim() || null;
    const updatedAt = String(row.updatedAt || "").trim() || new Date().toISOString();
    return {
      name,
      photoExt,
      photoSource,
      vertical,
      description,
      address,
      email,
      photoMetaApplied,
      profileMetaApplied,
      inboxEnabled,
      uiStatus,
      portfolioHidden,
      businessId,
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
    photoSource?: string | null;
    vertical?: string | null;
    description?: string | null;
    address?: string | null;
    email?: string | null;
    photoMetaApplied?: boolean;
    profileMetaApplied?: boolean;
    inboxEnabled?: boolean;
    uiStatus?: MetaPortfolioNumberUiStatus | null;
    portfolioHidden?: boolean | null;
    businessId?: string | null;
    displayPhoneNumber?: string | null;
    channelName?: string | null;
  },
): MetaPhoneIdentity {
  ensureDir(tenantId);
  const current = readPhoneIdentity(tenantId, phoneNumberId) || {
    name: null,
    photoExt: null,
    photoSource: null,
    vertical: null,
    description: null,
    address: null,
    email: null,
    photoMetaApplied: false,
    profileMetaApplied: false,
    inboxEnabled: null,
    uiStatus: null,
    portfolioHidden: null,
    businessId: null,
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
    photoSource: input.photoSource !== undefined ? input.photoSource : current.photoSource,
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
    uiStatus: input.uiStatus !== undefined ? input.uiStatus : current.uiStatus,
    portfolioHidden:
      input.portfolioHidden !== undefined ? input.portfolioHidden : current.portfolioHidden,
    businessId:
      input.businessId !== undefined
        ? String(input.businessId || "").replace(/\D/g, "") || null
        : current.businessId,
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

function connectionMatchesPhone(
  row: InboxAccountHint,
  phoneNumberId: string,
  identity: MetaPhoneIdentity | null,
): boolean {
  const chip = String(row.phoneNumberId || "").trim();
  if (chip && chip === phoneNumberId) return true;
  if (phonesMatch(row.displayPhoneNumber, identity?.displayPhoneNumber)) return true;
  return false;
}

function accountIsRestricted(
  tenantId: string,
  phoneNumberId: string,
  identity: MetaPhoneIdentity | null,
  connections?: InboxAccountHint[] | null,
): boolean {
  if (identity?.portfolioHidden === true) return true;
  if (identity?.businessId && isHiddenBusiness(tenantId, identity.businessId)) return true;
  for (const row of connections || []) {
    if (!connectionMatchesPhone(row, phoneNumberId, identity)) continue;
    if (row.metaBusinessId && isHiddenBusiness(tenantId, row.metaBusinessId)) return true;
  }
  return false;
}

/** Atendimento: Inbox ligado, chip Ativo e conta/WABA fora de Restritas. */
export function isPhoneInboxEligible(
  identity: MetaPhoneIdentity | null,
  tenantId?: string,
  connections?: InboxAccountHint[] | null,
  phoneNumberId?: string,
): boolean {
  if (!isPhoneInboxEnabled(identity) || !identity) return false;
  if (identity.uiStatus === "pendente" || identity.uiStatus === "restrito") return false;
  const tenant = String(tenantId || "").trim();
  const phone = String(phoneNumberId || "").trim();
  if (tenant && accountIsRestricted(tenant, phone, identity, connections)) return false;
  return true;
}

export function phoneInboxDisplayName(
  identity: MetaPhoneIdentity | null,
  verifiedNameFromMeta?: string | null,
): string | null {
  const meta = String(verifiedNameFromMeta || "").trim();
  if (meta) return meta;
  const channel = String(identity?.channelName || "").trim();
  if (channel) return channel;
  const saved = String(identity?.name || "").trim();
  return saved || null;
}

/** Mantém o rótulo do Inbox alinhado ao verified_name da Meta (ignora nome local do Editar). */
export function syncInboxChannelNameFromMeta(
  tenantId: string,
  phoneNumberId: string,
  verifiedName: string | null | undefined,
  displayPhoneNumber?: string | null,
): void {
  const id = String(phoneNumberId || "").trim();
  const name = String(verifiedName || "").trim();
  if (!id || !name) return;
  const current = readPhoneIdentity(tenantId, id);
  if (!current || current.inboxEnabled !== true) return;
  const phone =
    displayPhoneNumber !== undefined ? String(displayPhoneNumber || "").trim() || null : undefined;
  if (current.channelName === name && (phone === undefined || current.displayPhoneNumber === phone)) {
    return;
  }
  writePhoneIdentity(tenantId, id, {
    channelName: name,
    ...(phone !== undefined ? { displayPhoneNumber: phone } : {}),
  });
}

function lookupVerifiedName(
  verifiedNameByPhone: ReadonlyMap<string, string> | Record<string, string | null | undefined> | undefined,
  phoneNumberId: string,
): string | undefined {
  if (!verifiedNameByPhone) return undefined;
  if (verifiedNameByPhone instanceof Map) {
    return verifiedNameByPhone.get(phoneNumberId);
  }
  const record = verifiedNameByPhone as Record<string, string | null | undefined>;
  const name = String(record[phoneNumberId] || "").trim();
  return name || undefined;
}

export function listPhoneInboxChannels(
  tenantId: string,
  verifiedNameByPhone?: ReadonlyMap<string, string> | Record<string, string | null | undefined>,
  connections?: InboxAccountHint[] | null,
): MetaPhoneInboxChannel[] {
  try {
    const dir = tenantDir(tenantId);
    if (!existsSync(dir)) return [];
    const out: MetaPhoneInboxChannel[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const phoneNumberId = file.slice(0, -5);
      const identity = readPhoneIdentity(tenantId, phoneNumberId);
      if (!identity) continue;
      const metaVerified = lookupVerifiedName(verifiedNameByPhone, phoneNumberId);
      out.push({
        phoneNumberId,
        name: phoneInboxDisplayName(identity, metaVerified),
        displayPhoneNumber: identity.displayPhoneNumber,
        profilePictureUrl: localPhonePhotoUrl(phoneNumberId, identity),
        inboxEnabled: isPhoneInboxEnabled(identity),
        inboxEligible: isPhoneInboxEligible(identity, tenantId, connections, phoneNumberId),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function listEnabledInboxPhoneIds(
  tenantId: string,
  connections?: InboxAccountHint[] | null,
): string[] {
  const id = String(tenantId || "").trim();
  return listPhoneInboxChannels(id, undefined, connections)
    .filter((row) => row.inboxEligible)
    .map((row) => String(row.phoneNumberId || "").trim())
    .filter(Boolean);
}

export function markPhoneIdentitiesRestrictedForBusiness(
  tenantId: string,
  businessId: string,
  connections?: InboxAccountHint[] | null,
): number {
  const id = String(tenantId || "").trim();
  const business = String(businessId || "").replace(/\D/g, "");
  if (!id || business.length < 6) return 0;
  try {
    const dir = tenantDir(id);
    if (!existsSync(dir)) return 0;
    let count = 0;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const phoneNumberId = file.slice(0, -5);
      const identity = readPhoneIdentity(id, phoneNumberId);
      if (!identity) continue;
      const byBusiness = Boolean(identity.businessId && metaBusinessIdsMatch(identity.businessId, business));
      const byConnection = (connections || []).some(
        (row) =>
          metaBusinessIdsMatch(String(row.metaBusinessId || ""), business) &&
          connectionMatchesPhone(row, phoneNumberId, identity),
      );
      if (!byBusiness && !byConnection) continue;
      writePhoneIdentity(id, phoneNumberId, { portfolioHidden: true, businessId: business });
      count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

function asPhoneIds(value?: string | string[] | null): string[] {
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const id = String(item || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function inboxQueryPhoneIds(
  tenantId: string,
  connectionPhoneNumberId?: string | string[] | null,
  selectedPhoneNumberId?: string | null,
  connections?: InboxAccountHint[] | null,
): string[] {
  const enabled = listEnabledInboxPhoneIds(tenantId, connections);
  const conns = asPhoneIds(connectionPhoneNumberId);
  const selected = String(selectedPhoneNumberId || "").trim();
  const extras = enabled.length === 1 ? conns.filter((id) => !enabled.includes(id)) : [];
  const aliases = [...enabled, ...extras];
  if (!selected) return aliases;
  if (enabled.length === 1 && aliases.includes(selected)) return aliases;
  return enabled.includes(selected) ? [selected] : [];
}

export function isInboxPhoneAllowed(
  tenantId: string,
  phoneNumberId: string | null | undefined,
  connectionPhoneNumberId?: string | string[] | null,
  connections?: InboxAccountHint[] | null,
): boolean {
  const id = String(phoneNumberId || "").trim();
  if (!id) return false;
  const enabled = listEnabledInboxPhoneIds(tenantId, connections);
  if (enabled.includes(id)) return true;
  const conns = asPhoneIds(connectionPhoneNumberId);
  return enabled.length === 1 && conns.includes(id) && enabled[0] !== id;
}

export function resolveInboxSendPhoneNumberId(input: {
  tenantId: string;
  connectionPhoneNumberId?: string | null;
  requestedPhoneNumberId?: string | null;
  conversationPhoneNumberId?: string | null;
  connections?: InboxAccountHint[] | null;
}): string | null {
  const enabled = listEnabledInboxPhoneIds(input.tenantId, input.connections);
  const conversation = String(input.conversationPhoneNumberId || "").trim();
  const requested = String(input.requestedPhoneNumberId || "").trim();
  const connection = String(input.connectionPhoneNumberId || "").trim();
  if (conversation && enabled.includes(conversation)) return conversation;
  if (conversation && enabled.length === 1 && conversation === connection) return enabled[0] || null;
  if (requested && enabled.includes(requested)) return requested;
  if (connection && enabled.includes(connection)) return connection;
  if (enabled.length === 1) return enabled[0] || null;
  return connection || null;
}

export function applyLocalPhoneIdentities(
  tenantId: string,
  numbers: MetaPortfolioNumberPublic[],
  placeholderName?: string | null,
  options?: { hidden?: boolean | null; businessId?: string | null },
): MetaPortfolioNumberPublic[] {
  return numbers.map((row) => {
    const identity = readPhoneIdentity(tenantId, row.phoneNumberId);
    const nameSync = resolvePhoneNameSync({
      verifiedName: row.verifiedName,
      nameStatus: row.nameStatus,
      newDisplayName: row.newDisplayName,
      newNameStatus: row.newNameStatus,
      localName: identity?.name || null,
      placeholderName,
    });
    if (
      nameSync.nameSyncStatus === "applied" &&
      namesEqual(identity?.name, META_WHATSAPP_DEFAULT_DISPLAY_NAME) &&
      row.verifiedName &&
      !namesEqual(row.verifiedName, META_WHATSAPP_DEFAULT_DISPLAY_NAME)
    ) {
      try {
        writePhoneIdentity(tenantId, row.phoneNumberId, { name: row.verifiedName });
      } catch {
        // Identidade local não pode abortar a listagem.
      }
    }
    const uiStatus = resolveMetaPhoneUiStatus({
      metaStatus: row.metaStatus,
      codeVerificationStatus: row.codeVerificationStatus,
      healthCanSend: row.healthCanSend,
    });
    const localPhoto = localPhonePhotoUrl(row.phoneNumberId, identity);
    const portfolioHidden = options?.hidden === true;
    const businessId = String(options?.businessId || "").replace(/\D/g, "") || null;
    try {
      writePhoneIdentity(tenantId, row.phoneNumberId, {
        uiStatus,
        portfolioHidden,
        ...(businessId ? { businessId } : {}),
      });
    } catch {
      // Identidade local não pode abortar a listagem.
    }
    if (isPhoneInboxEnabled(identity) && row.verifiedName) {
      syncInboxChannelNameFromMeta(
        tenantId,
        row.phoneNumberId,
        row.verifiedName,
        row.displayPhoneNumber,
      );
    }
    const stored = readPhoneIdentity(tenantId, row.phoneNumberId);
    return {
      ...row,
      requestedName: nameSync.requestedName,
      nameSyncStatus: nameSync.nameSyncStatus,
      nameNeedsRegister: nameSync.nameNeedsRegister,
      canActivate: canActivateMetaPhoneNumber(uiStatus, nameSync.nameNeedsRegister),
      uiStatus,
      profilePictureUrl: localPhoto || row.profilePictureUrl,
      inboxEnabled: isPhoneInboxEnabled(stored),
      photoSyncStatus: localPhoto ? "applied" : row.photoSyncStatus,
      profileSyncStatus: row.profileSyncStatus,
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
