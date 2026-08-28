import type {
  MetaPortfolioNumberPublic,
  MetaPortfolioPublic,
} from "./meta-whatsapp-portfolio.types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  const raw = String(value || "").trim();
  return raw || null;
}

function httpsUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function pictureUrl(node: unknown): string | null {
  const row = asRecord(node);
  const data = asRecord(row.data);
  if (data.is_silhouette === true) return null;
  return httpsUrl(data.url) || httpsUrl(row.url);
}

export function isMetaPhoneConnected(metaStatus: string | null): boolean {
  return String(metaStatus || "").trim().toUpperCase() === "CONNECTED";
}

export function mapMetaBusinessToPortfolio(
  json: unknown,
  fallback: { id?: string | null; wabaId?: string | null },
): MetaPortfolioPublic {
  const row = asRecord(json);
  const page = asRecord(row.primary_page);
  return {
    id: text(row.id) || text(fallback.id),
    name: text(row.name),
    primaryPageId: text(page.id),
    primaryPageName: text(page.name),
    profilePictureUrl: httpsUrl(row.profile_picture_uri) || pictureUrl(page.picture),
    wabaId: text(fallback.wabaId),
  };
}

export function firstOwnedPageId(json: unknown): string | null {
  const data = asRecord(json).data;
  const rows = Array.isArray(data) ? data : [];
  for (const item of rows) {
    const id = text(asRecord(item).id);
    if (id) return id;
  }
  return null;
}

export function mapMetaPhoneToPortfolioNumber(
  json: unknown,
  busyPhoneIds: ReadonlySet<string> = new Set(),
): MetaPortfolioNumberPublic | null {
  const row = asRecord(json);
  const phoneNumberId = text(row.id);
  if (!phoneNumberId) return null;
  const metaStatus = text(row.status);
  const connected = isMetaPhoneConnected(metaStatus);
  const busy = busyPhoneIds.has(phoneNumberId);
  return {
    phoneNumberId,
    displayPhoneNumber: text(row.display_phone_number),
    verifiedName: text(row.verified_name),
    qualityRating: text(row.quality_rating),
    metaStatus,
    codeVerificationStatus: text(row.code_verification_status),
    uiStatus: connected ? "ativo" : "pendente",
    dispatchStatus: busy ? "em_disparo" : "livre",
    canActivate: !connected,
    profilePictureUrl: null,
    vertical: null,
    description: null,
    address: null,
    email: null,
  };
}

export function mapMetaPhoneListToPortfolioNumbers(
  json: unknown,
  busyPhoneIds: ReadonlySet<string> = new Set(),
): MetaPortfolioNumberPublic[] {
  const data = asRecord(json).data;
  const rows = Array.isArray(data) ? data : [];
  const out: MetaPortfolioNumberPublic[] = [];
  for (const item of rows) {
    const mapped = mapMetaPhoneToPortfolioNumber(item, busyPhoneIds);
    if (mapped) out.push(mapped);
  }
  return out;
}
