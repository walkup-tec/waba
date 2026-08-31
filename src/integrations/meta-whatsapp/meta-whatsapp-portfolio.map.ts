import type {
  MetaPortfolioNumberPublic,
  MetaPortfolioPublic,
  MetaProfileSyncStatus,
} from "./meta-whatsapp-portfolio.types";

export const META_PHONE_NUMBER_LIST_FIELDS =
  "id,display_phone_number,verified_name,quality_rating,status,code_verification_status,name_status,new_display_name,new_name_status";

export const META_PHONE_NAME_FIELDS = "verified_name,name_status,new_display_name,new_name_status";

export const META_WABA_IDENTITY_FIELDS =
  "id,name,owner_business_info{id,name,profile_picture_uri,primary_page{id,name,picture}},on_behalf_of_business_info{id,name,profile_picture_uri,primary_page{id,name,picture}}";

export const META_WABA_IDENTITY_FIELDS_MINIMAL =
  "id,name,owner_business_info{id,name,primary_page{id,name}},on_behalf_of_business_info{id,name}";

export const META_BUSINESS_IDENTITY_FIELDS =
  "id,name,profile_picture_uri,primary_page{id,name,picture}";

export const META_BUSINESS_IDENTITY_FIELDS_MINIMAL =
  "id,name,profile_picture_uri,primary_page{id,name}";

export const META_OWNED_PAGES_FIELDS = "id,name,picture";

const NAME_READY = new Set(["APPROVED", "AVAILABLE_WITHOUT_REVIEW"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  const raw = String(value || "").trim();
  return raw || null;
}

function isGenericMetaBusinessName(value: string | null | undefined): boolean {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return true;
  return (
    raw === "portfólio empresarial" ||
    raw === "portfolio empresarial" ||
    raw === "business portfolio" ||
    raw === "whatsapp business account"
  );
}

function preferredName(...values: unknown[]): string | null {
  for (const value of values) {
    const raw = text(value);
    if (raw && !isGenericMetaBusinessName(raw)) return raw;
  }
  return null;
}

function httpsUrl(value: unknown, allowAccessToken = false): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    if (parsed.searchParams.has("access_token") && !allowAccessToken) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function pictureUrl(node: unknown, allowAccessToken = false): string | null {
  const row = asRecord(node);
  const data = asRecord(row.data);
  if (data.is_silhouette === true) return null;
  return httpsUrl(data.url, allowAccessToken) || httpsUrl(row.url, allowAccessToken);
}

/** URL só para o servidor baixar. Não devolver ao front se tiver access_token. */
export function graphPhotoDownloadUrl(json: unknown): string | null {
  const row = asRecord(json);
  return (
    httpsUrl(row.profile_picture_uri, true) ||
    pictureUrl(row, true) ||
    pictureUrl(asRecord(row.data), true) ||
    httpsUrl(row.url, true)
  );
}

export function isMetaPhoneConnected(metaStatus: string | null): boolean {
  return String(metaStatus || "").trim().toUpperCase() === "CONNECTED";
}

export function namesEqual(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return Boolean(a) && a === b;
}

export function mapPhoneNameFields(json: unknown): {
  verifiedName: string | null;
  nameStatus: string | null;
  newDisplayName: string | null;
  newNameStatus: string | null;
} {
  const row = asRecord(json);
  return {
    verifiedName: text(row.verified_name),
    nameStatus: text(row.name_status),
    newDisplayName: text(row.new_display_name),
    newNameStatus: text(row.new_name_status),
  };
}

export function resolvePhoneNameSync(input: {
  verifiedName: string | null;
  nameStatus?: string | null;
  newDisplayName: string | null;
  newNameStatus: string | null;
  localName?: string | null;
}): {
  requestedName: string | null;
  nameSyncStatus: MetaProfileSyncStatus | null;
  nameNeedsRegister: boolean;
} {
  const verified = text(input.verifiedName);
  const incoming = text(input.newDisplayName) || text(input.localName);
  const newStatus = String(input.newNameStatus || "").trim().toUpperCase();
  if (!incoming && !verified) {
    return { requestedName: null, nameSyncStatus: null, nameNeedsRegister: false };
  }
  if (incoming && namesEqual(incoming, verified)) {
    return { requestedName: null, nameSyncStatus: "applied", nameNeedsRegister: false };
  }
  if (incoming && !namesEqual(incoming, verified)) {
    if (newStatus === "DECLINED") {
      return { requestedName: incoming, nameSyncStatus: "declined", nameNeedsRegister: false };
    }
    if (NAME_READY.has(newStatus)) {
      return { requestedName: incoming, nameSyncStatus: "ready", nameNeedsRegister: true };
    }
    return { requestedName: incoming, nameSyncStatus: "pending", nameNeedsRegister: false };
  }
  return { requestedName: null, nameSyncStatus: verified ? "applied" : null, nameNeedsRegister: false };
}

export function businessIdNotWaba(
  id: string | null | undefined,
  wabaId: string | null | undefined,
): string | null {
  const biz = String(id || "").trim();
  const waba = String(wabaId || "").trim();
  if (!biz || (waba && biz === waba)) return null;
  return biz;
}

export type MetaWabaIdentityHint = {
  wabaId: string | null;
  wabaName: string | null;
  businessId: string | null;
  businessName: string | null;
  primaryPageId: string | null;
  primaryPageName: string | null;
  profilePictureUrl: string | null;
};

export function mapMetaWabaIdentity(json: unknown): MetaWabaIdentityHint {
  const row = asRecord(json);
  const owner = asRecord(row.owner_business_info);
  const behalf = asRecord(row.on_behalf_of_business_info);
  const biz = text(owner.id) ? owner : behalf;
  const page = asPageRef(asRecord(biz).primary_page);
  return {
    wabaId: text(row.id),
    wabaName: text(row.name),
    businessId: text(asRecord(biz).id),
    businessName: text(asRecord(biz).name),
    primaryPageId: page.id,
    primaryPageName: page.name,
    profilePictureUrl:
      httpsUrl(asRecord(biz).profile_picture_uri) ||
      httpsUrl(row.profile_picture_uri) ||
      pictureUrl(page.picture),
  };
}

export function listMetaBusinessNodes(json: unknown): unknown[] {
  const data = asRecord(json).data;
  return Array.isArray(data) ? data : [];
}

export function pickMetaBusinessNode(
  json: unknown,
  ids: Array<string | null | undefined>,
): unknown {
  const wanted = new Set(ids.map((id) => String(id || "").trim()).filter(Boolean));
  if (!wanted.size) return null;
  for (const row of listMetaBusinessNodes(json)) {
    const id = text(asRecord(row).id);
    if (id && wanted.has(id)) return row;
  }
  return null;
}

export function asPageRef(value: unknown): { id: string | null; name: string | null; picture: unknown } {
  if (typeof value === "string" || typeof value === "number") {
    return { id: text(value), name: null, picture: null };
  }
  const row = asRecord(value);
  return { id: text(row.id), name: text(row.name), picture: row.picture };
}

function firstOwnedPageRecord(json: unknown): Record<string, unknown> {
  const data = asRecord(json).data;
  const rows = Array.isArray(data) ? data : [];
  for (const item of rows) {
    const rec = asRecord(item);
    if (text(rec.id) || text(rec.name)) return rec;
  }
  return {};
}

export function mapMetaBusinessToPortfolio(
  json: unknown,
  fallback: { id?: string | null; wabaId?: string | null; connectionId?: string | null },
): MetaPortfolioPublic {
  const row = asRecord(json);
  const page = asPageRef(row.primary_page);
  const owned = firstOwnedPageRecord(row.owned_pages);
  const owner = asRecord(row.owner_business_info);
  const pageNode =
    page.id || page.name || page.picture
      ? page
      : { id: text(owned.id), name: text(owned.name), picture: owned.picture };
  return {
    id: text(owner.id) || text(row.id) || text(fallback.id),
    name: preferredName(row.name, owner.name),
    primaryPageId: pageNode.id,
    primaryPageName: pageNode.name,
    profilePictureUrl:
      httpsUrl(row.profile_picture_uri) ||
      pictureUrl(row.picture) ||
      pictureUrl(asRecord(pageNode).picture),
    wabaId: text(fallback.wabaId),
    connectionId: text(fallback.connectionId),
  };
}

export function mergePortfolioIdentity(input: {
  fallback: MetaPortfolioPublic;
  business?: unknown;
  waba?: unknown;
  ownedPages?: unknown;
  picture?: unknown;
}): MetaPortfolioPublic {
  const hint = mapMetaWabaIdentity(input.waba);
  const mapped = input.business
    ? mapMetaBusinessToPortfolio(input.business, {
        id: input.fallback.id,
        wabaId: input.fallback.wabaId,
        connectionId: input.fallback.connectionId,
      })
    : input.fallback;
  const owned = firstOwnedPageRecord(input.ownedPages);
  const resolvedWaba =
    text(input.fallback.wabaId) ||
    (hint.businessId && hint.wabaId && hint.wabaId !== hint.businessId ? hint.wabaId : null);
  const rawId = hint.businessId || mapped.id || input.fallback.id;
  return {
    ...input.fallback,
    id: businessIdNotWaba(rawId, resolvedWaba),
    name: preferredName(mapped.name, hint.businessName, input.fallback.name),
    primaryPageId: mapped.primaryPageId || hint.primaryPageId || text(owned.id) || input.fallback.primaryPageId,
    primaryPageName: mapped.primaryPageName || hint.primaryPageName || text(owned.name) || input.fallback.primaryPageName,
    profilePictureUrl:
      mapped.profilePictureUrl ||
      hint.profilePictureUrl ||
      pictureUrl(owned.picture) ||
      pictureUrl(input.picture) ||
      input.fallback.profilePictureUrl,
    wabaId: resolvedWaba || input.fallback.wabaId,
    connectionId: input.fallback.connectionId,
  };
}

function isListedPortfolioNumber(item: MetaPortfolioNumberPublic): boolean {
  if (String(item.displayPhoneNumber || "").trim()) return true;
  return isMetaPhoneConnected(item.metaStatus);
}

export function mergePortfolioNumbers(
  graphNumbers: MetaPortfolioNumberPublic[],
  stored: MetaPortfolioNumberPublic[],
): MetaPortfolioNumberPublic[] {
  const fromGraph = graphNumbers.filter(isListedPortfolioNumber);
  if (fromGraph.length) return fromGraph;
  return stored.filter(isListedPortfolioNumber);
}

export function dedupePortfolioCards(cards: MetaPortfolioPublic[]): MetaPortfolioPublic[] {
  if (cards.length < 2) return cards;
  const list = cards.map((card) => ({ ...card, numbers: (card.numbers || []).slice() }));

  const absorb = (host: MetaPortfolioPublic, extra: MetaPortfolioPublic): void => {
    host.name = host.name || extra.name;
    host.primaryPageName = host.primaryPageName || extra.primaryPageName;
    host.primaryPageId = host.primaryPageId || extra.primaryPageId;
    host.profilePictureUrl = host.profilePictureUrl || extra.profilePictureUrl;
    host.wabaId = host.wabaId || extra.wabaId;
    host.numbers = mergePortfolioNumbers(host.numbers || [], extra.numbers || []);
  };

  const dropped = new Set<string>();
  for (const card of list) {
    const id = String(card.id || "").trim();
    const conn = String(card.connectionId || "");
    if (!id) continue;
    const host = list.find((other) => other !== card && String(other.wabaId || "").trim() === id);
    if (!host) continue;
    absorb(host, card);
    dropped.add(conn);
  }

  const remaining = list.filter((card) => !dropped.has(String(card.connectionId || "")));
  const byBiz = new Map<string, MetaPortfolioPublic>();
  const noId: MetaPortfolioPublic[] = [];
  for (const card of remaining) {
    const id = String(card.id || "").trim();
    if (!id) {
      noId.push(card);
      continue;
    }
    const prev = byBiz.get(id);
    if (!prev) {
      byBiz.set(id, card);
      continue;
    }
    absorb(prev, card);
  }

  const usedWabas = new Set(
    [...byBiz.values()].map((card) => String(card.wabaId || "").trim()).filter(Boolean),
  );
  const extras: MetaPortfolioPublic[] = [];
  for (const card of noId) {
    const waba = String(card.wabaId || "").trim();
    const host = waba ? [...byBiz.values()].find((item) => String(item.wabaId || "").trim() === waba) : undefined;
    if (host && usedWabas.has(waba)) {
      absorb(host, card);
      continue;
    }
    extras.push(card);
  }
  const merged = [...byBiz.values(), ...extras];
  if (merged.length < 2) return merged;
  const byWaba = new Map<string, MetaPortfolioPublic>();
  const rest: MetaPortfolioPublic[] = [];
  for (const card of merged) {
    const waba = String(card.wabaId || "").trim();
    if (!waba) {
      rest.push(card);
      continue;
    }
    const prev = byWaba.get(waba);
    if (!prev) {
      byWaba.set(waba, card);
      continue;
    }
    const keep = businessIdNotWaba(prev.id, waba) ? prev : card;
    const extra = keep === prev ? card : prev;
    absorb(keep, extra);
    byWaba.set(waba, keep);
  }
  return [...byWaba.values(), ...rest];
}

export function firstOwnedPageId(json: unknown): string | null {
  return text(firstOwnedPageRecord(json).id);
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
  const verifiedName = text(row.verified_name);
  const nameStatus = text(row.name_status);
  const newDisplayName = text(row.new_display_name);
  const newNameStatus = text(row.new_name_status);
  const nameSync = resolvePhoneNameSync({
    verifiedName,
    nameStatus,
    newDisplayName,
    newNameStatus,
  });
  return {
    phoneNumberId,
    displayPhoneNumber: text(row.display_phone_number),
    verifiedName,
    qualityRating: text(row.quality_rating),
    metaStatus,
    codeVerificationStatus: text(row.code_verification_status),
    uiStatus: connected ? "ativo" : "pendente",
    dispatchStatus: busy ? "em_disparo" : "livre",
    canActivate: !connected || nameSync.nameNeedsRegister,
    nameNeedsRegister: nameSync.nameNeedsRegister,
    nameStatus,
    newDisplayName,
    newNameStatus,
    profilePictureUrl: null,
    vertical: null,
    description: null,
    address: null,
    email: null,
    requestedName: nameSync.requestedName,
    nameSyncStatus: nameSync.nameSyncStatus,
    photoSyncStatus: null,
    profileSyncStatus: null,
    inboxEnabled: false,
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
