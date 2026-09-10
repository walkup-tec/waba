import type {
  MetaPortfolioNumberPublic,
  MetaPortfolioNumberUiStatus,
  MetaPortfolioPublic,
  MetaProfileSyncStatus,
} from "./meta-whatsapp-portfolio.types";
import { META_WHATSAPP_DEFAULT_DISPLAY_NAME } from "./meta-whatsapp-phone-profile";

export const META_PHONE_NUMBER_LIST_FIELDS =
  "id,display_phone_number,verified_name,quality_rating,status,code_verification_status,name_status,new_display_name,new_name_status,health_status";

/**
 * Catálogo do WABA sem campos que a Graph usa para filtrar chip Pendente:
 * health_status, messaging_limit_tier, name_status (beta / certificado).
 */
export const META_PHONE_NUMBER_CATALOG_FIELDS =
  "id,display_phone_number,verified_name,status,code_verification_status";

/** Nome do chip (Ativo). Não usar na listagem do WABA — omite Pendente. */
export const META_PHONE_NUMBER_MEMBERSHIP_FIELDS =
  "id,display_phone_number,verified_name,status,code_verification_status,name_status,new_display_name,new_name_status";

export const META_PHONE_MESSAGING_LIMIT_FIELD = "messaging_limit_tier";

export const META_PHONE_NUMBER_LIST_FIELDS_WITH_LIMIT =
  `${META_PHONE_NUMBER_LIST_FIELDS},${META_PHONE_MESSAGING_LIMIT_FIELD}`;

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

export function isGenericMetaBusinessName(value: string | null | undefined): boolean {
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

/** Path estável da CDN da Meta — query string muda o tempo todo na mesma foto. */
export function shouldRefreshCachedPhonePhoto(
  identity: { photoExt?: string | null; photoSource?: string | null } | null | undefined,
  graphUrl: string | null | undefined,
): boolean {
  const url = String(graphUrl || "").trim();
  if (!/^https:\/\//i.test(url)) return false;
  const nextKey = graphPhotoSourceKey(url);
  if (!nextKey) return false;
  if (identity?.photoExt && identity.photoSource && identity.photoSource === nextKey) return false;
  return true;
}

export function graphPhotoSourceKey(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    return parsed.pathname.replace(/\/+$/, "") || parsed.hostname;
  } catch {
    return raw.slice(0, 160);
  }
}

export function safePublicPhotoUrl(value: unknown): string | null {
  return httpsUrl(value, false);
}

export function isMetaPhoneConnected(metaStatus: string | null): boolean {
  return String(metaStatus || "").trim().toUpperCase() === "CONNECTED";
}

const META_PHONE_RESTRICTED_STATUSES = new Set([
  "BANNED",
  "RESTRICTED",
  "FLAGGED",
  "RATE_LIMITED",
  "DISABLED",
  "LOCKED",
  "DELETED",
]);

/** Graph `health_status.can_send_message`: AVAILABLE | LIMITED | BLOCKED. */
export function parseMetaHealthCanSend(json: unknown): string | null {
  const row = asRecord(json);
  const health = asRecord(row.health_status);
  const entities = Array.isArray(health.entities) ? health.entities : [];
  const values = [text(health.can_send_message)];
  for (const entity of entities) {
    const item = asRecord(entity);
    const type = String(item.entity_type || "").trim().toUpperCase();
    if (type === "PHONE_NUMBER" || type === "WABA" || type === "BUSINESS") {
      values.push(text(item.can_send_message));
    }
  }
  const upper = values.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean);
  if (upper.includes("BLOCKED")) return "BLOCKED";
  if (upper.includes("LIMITED")) return "LIMITED";
  return text(health.can_send_message);
}

/**
 * status da Graph (CONNECTED/RESTRICTED/BANNED/…) + health_status.
 * DISCONNECTED mesmo com SMS verificado ainda precisa do PIN de registro Cloud.
 * Só restrição/banimento da Meta esconde o PIN.
 */
export function resolveMetaPhoneUiStatus(input: {
  metaStatus?: string | null;
  codeVerificationStatus?: string | null;
  healthCanSend?: string | null;
}): MetaPortfolioNumberUiStatus {
  const status = String(input.metaStatus || "").trim().toUpperCase();
  const health = String(input.healthCanSend || "").trim().toUpperCase();
  if (META_PHONE_RESTRICTED_STATUSES.has(status)) return "restrito";
  if (status === "CONNECTED") {
    return health === "BLOCKED" ? "restrito" : "ativo";
  }
  return "pendente";
}

export function canActivateMetaPhoneNumber(
  uiStatus: MetaPortfolioNumberUiStatus,
  nameNeedsRegister: boolean,
): boolean {
  if (uiStatus === "restrito") return false;
  if (uiStatus === "pendente") return true;
  return Boolean(nameNeedsRegister);
}

function preferMetaPhoneStatus(left: string | null | undefined, right: string | null | undefined): string | null {
  const a = text(left);
  const b = text(right);
  const ua = String(a || "").toUpperCase();
  const ub = String(b || "").toUpperCase();
  if (META_PHONE_RESTRICTED_STATUSES.has(ua)) return a;
  if (META_PHONE_RESTRICTED_STATUSES.has(ub)) return b;
  if (ua === "CONNECTED") return a;
  if (ub === "CONNECTED") return b;
  return a || b;
}

function preferHealthCanSend(left: string | null | undefined, right: string | null | undefined): string | null {
  const a = text(left);
  const b = text(right);
  if (String(a || "").toUpperCase() === "BLOCKED" || String(b || "").toUpperCase() === "BLOCKED") {
    return "BLOCKED";
  }
  return a || b;
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

function namesLooselyRelated(left: string | null | undefined, right: string | null | undefined): boolean {
  if (namesEqual(left, right)) return true;
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  if (!a || !b || a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

export function isStaleDefaultDisplayNameRequest(input: {
  verifiedName?: string | null;
  incomingName?: string | null;
  placeholderName?: string | null;
}): boolean {
  const verified = text(input.verifiedName);
  const incoming = text(input.incomingName);
  if (!verified || !incoming) return false;
  if (!namesEqual(incoming, META_WHATSAPP_DEFAULT_DISPLAY_NAME)) return false;
  if (namesEqual(verified, META_WHATSAPP_DEFAULT_DISPLAY_NAME)) return false;
  if (namesLooselyRelated(verified, input.placeholderName)) return false;
  return true;
}

export function resolvePhoneNameSync(input: {
  verifiedName: string | null;
  nameStatus?: string | null;
  newDisplayName: string | null;
  newNameStatus: string | null;
  localName?: string | null;
  placeholderName?: string | null;
}): {
  requestedName: string | null;
  nameSyncStatus: MetaProfileSyncStatus | null;
  nameNeedsRegister: boolean;
} {
  const verified = text(input.verifiedName);
  const rawIncoming = text(input.newDisplayName) || text(input.localName);
  const incoming = isStaleDefaultDisplayNameRequest({
    verifiedName: verified,
    incomingName: rawIncoming,
    placeholderName: input.placeholderName,
  })
    ? null
    : rawIncoming;
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

/** Nome visível no card: o pedido em análise/aprovado, senão o verified_name da Meta. */
export function phoneNumberCardName(input: {
  verifiedName?: string | null;
  requestedName?: string | null;
  nameSyncStatus?: MetaProfileSyncStatus | null;
  fallback?: string | null;
}): string | null {
  const requested = text(input.requestedName);
  const status = String(input.nameSyncStatus || "");
  if (requested && (status === "pending" || status === "ready")) return requested;
  return text(input.verifiedName) || text(input.fallback);
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
    name: preferredName(mapped.name, hint.businessName, hint.wabaName, input.fallback.name),
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

/**
 * Graph vs cache local: se a Graph trouxe chips listáveis, eles mandam.
 * Senão, cai no que já estava gravado.
 */
export function mergePortfolioNumbers(
  graphNumbers: MetaPortfolioNumberPublic[],
  stored: MetaPortfolioNumberPublic[],
): MetaPortfolioNumberPublic[] {
  const fromGraph = graphNumbers.filter(isListedPortfolioNumber);
  if (fromGraph.length) return fromGraph;
  return stored.filter(isListedPortfolioNumber);
}

/**
 * Une listas de números por phoneNumberId (ex.: várias conexões Embedded Signup
 * do mesmo Business Manager). Não descarta a segunda lista só porque a primeira
 * já tem itens — isso escondia chips da Quantum/outros portfólios.
 */
export function unionPortfolioNumbers(
  ...lists: MetaPortfolioNumberPublic[][]
): MetaPortfolioNumberPublic[] {
  const byId = new Map<string, MetaPortfolioNumberPublic>();
  for (const list of lists) {
    for (const item of (list || []).filter(isListedPortfolioNumber)) {
      const id = String(item.phoneNumberId || "").trim();
      if (!id) continue;
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, { ...item, phoneNumberId: id });
        continue;
      }
      // Prefer CONNECTED: não deixar stored (metaStatus null / ui pendente)
      // apagar o status da Graph ao só completar verifiedName/display.
      const metaStatus = preferMetaPhoneStatus(prev.metaStatus, item.metaStatus);
      const healthCanSend = preferHealthCanSend(prev.healthCanSend, item.healthCanSend);
      const codeVerificationStatus =
        text(item.codeVerificationStatus) || text(prev.codeVerificationStatus);
      const uiStatus = resolveMetaPhoneUiStatus({
        metaStatus,
        codeVerificationStatus,
        healthCanSend,
      });
      const nameNeedsRegister = Boolean(item.nameNeedsRegister || prev.nameNeedsRegister);
      byId.set(id, {
        ...prev,
        ...item,
        phoneNumberId: id,
        displayPhoneNumber: text(item.displayPhoneNumber) || text(prev.displayPhoneNumber),
        // Graph primeiro: o verified_name gravado na conexão no Embedded Signup
        // não pode tapar o nome novo que a listagem acabou de ler.
        verifiedName: text(prev.verifiedName) || text(item.verifiedName),
        nameStatus: text(prev.nameStatus) || text(item.nameStatus),
        newDisplayName: text(prev.newDisplayName) || text(item.newDisplayName),
        newNameStatus: text(prev.newNameStatus) || text(item.newNameStatus),
        requestedName: text(prev.requestedName) || text(item.requestedName),
        nameSyncStatus: prev.nameSyncStatus || item.nameSyncStatus,
        metaStatus,
        healthCanSend,
        codeVerificationStatus,
        uiStatus,
        canActivate: canActivateMetaPhoneNumber(uiStatus, nameNeedsRegister),
        nameNeedsRegister,
        wabaId: text(item.wabaId) || text(prev.wabaId) || null,
      });
    }
  }
  return [...byId.values()];
}

export function isRenderablePortfolioCard(card: MetaPortfolioPublic | null | undefined): boolean {
  if (!card) return false;
  if (String(card.id || "").trim()) return true;
  if (String(card.wabaId || "").trim()) return true;
  if (String(card.primaryPageId || "").trim()) return true;
  if (String(card.primaryPageName || "").trim()) return true;
  return (card.numbers || []).some((item) => Boolean(String(item.displayPhoneNumber || "").trim()));
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
    host.numbers = unionPortfolioNumbers(host.numbers || [], extra.numbers || []);
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
  const codeVerificationStatus = text(row.code_verification_status);
  const healthCanSend = parseMetaHealthCanSend(row);
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
  const uiStatus = resolveMetaPhoneUiStatus({
    metaStatus,
    codeVerificationStatus,
    healthCanSend,
  });
  return {
    phoneNumberId,
    displayPhoneNumber: text(row.display_phone_number),
    verifiedName,
    qualityRating: text(row.quality_rating),
    metaStatus,
    codeVerificationStatus,
    healthCanSend,
    uiStatus,
    dispatchStatus: busy ? "em_disparo" : "livre",
    canActivate: canActivateMetaPhoneNumber(uiStatus, nameSync.nameNeedsRegister),
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
    wabaId:
      text(row._portfolio_waba_id) ||
      text(row.waba_id) ||
      text(asRecord(row.whatsapp_business_account).id) ||
      null,
    messagingLimit: text(row.messaging_limit_tier) || text(row.messaging_limit) || null,
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
