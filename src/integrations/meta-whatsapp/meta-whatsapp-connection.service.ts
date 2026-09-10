import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import {
  isMetaTechProviderConfigured,
  readMetaAppId,
  readMetaAppSecret,
  readMetaConfigId,
  readMetaJsSdkGraphVersion,
} from "./meta-config";
import { decryptMetaToken, encryptMetaToken, MetaTokenCryptoError } from "./meta-token-crypto";
import { exchangeEmbeddedSignupCode, metaOauthExpiresAt } from "./meta-whatsapp-oauth";
import { callMetaGraphJson, type MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import {
  logMetaWhatsappSafe,
  MetaWhatsappError,
} from "./meta-whatsapp-errors";
import type {
  MetaWhatsappConnectionRecord,
  MetaWhatsappPublicConnection,
  MetaWhatsappTenant,
  MetaWhatsappUiStatus,
} from "./meta-whatsapp-connection.types";
import type {
  MetaPortfolioAssetsPublic,
  MetaPortfolioNumberPublic,
  MetaPortfolioPublic,
} from "./meta-whatsapp-portfolio.types";
import {
  mapMetaPhoneListToPortfolioNumbers,
  mergePortfolioIdentity,
  unionPortfolioNumbers,
  dedupePortfolioCards,
  isRenderablePortfolioCard,
  businessIdNotWaba,
  isMetaPhoneConnected,
  mapPhoneNameFields,
  resolvePhoneNameSync,
  resolveMetaPhoneUiStatus,
  canActivateMetaPhoneNumber,
  namesEqual,
  graphPhotoDownloadUrl,
  graphPhotoSourceKey,
  safePublicPhotoUrl,
  META_PHONE_NUMBER_LIST_FIELDS_WITH_LIMIT,
  META_PHONE_NUMBER_CATALOG_FIELDS,
  META_PHONE_NAME_FIELDS,
} from "./meta-whatsapp-portfolio.map";
import { filterWabaIdsOwnedByBusiness, extraWabaIdsFromConnections } from "./meta-whatsapp-template-waba-ids";
import {
  clearPortfolioGraphInflight,
  invalidateCachedPortfolioGraph,
  readCachedPortfolioGraph,
  readStaleCachedPortfolioGraph,
  readPortfolioGraphInflight,
  setPortfolioGraphInflight,
  shouldUsePortfolioGraphCache,
  writeCachedPortfolioGraph,
} from "./meta-whatsapp-portfolio-graph-cache";
import {
  isKnownClientWabaForBusiness,
  knownOwnedWabaIdsForBusiness,
  knownPendingPhoneGraphRow,
  knownPendingPhonesForBusiness,
  knownWabaIdForPendingPhone,
  knownWabaNameForId,
} from "./meta-whatsapp-known-owned-wabas";
import { publicMetaGraphRegisterMessage } from "./meta-whatsapp-graph-errors";
import { isMetaGraphUploadCooldown } from "./meta-whatsapp-graph-cooldown";
import {
  fetchWabaOwner,
  fetchBusinessFromGraph,
  fetchAssignedBusinesses,
  directoryFromAssigned,
  pickMetaBusinessNode,
  fillPageNameById,
} from "./meta-whatsapp-portfolio-graph";
import {
  applyLocalPortfolioBusinessPhoto,
  applyLocalPortfolioBusinessIdentity,
  localPortfolioBusinessPhotoUrl,
  shouldRefreshPortfolioBusinessPhoto,
  readPortfolioPhoto,
  readPortfolioBusinessPhoto,
  writePortfolioBusinessPhoto,
  writePortfolioBusinessIdentity,
  purgePortfolioIdentity,
} from "./meta-whatsapp-portfolio-identity.store";
import {
  applyLocalPhoneIdentities,
  readPhoneIdentity,
  readPhonePhoto,
  writePhoneIdentity,
  purgePhoneIdentities,
  localPhonePhotoUrl,
} from "./meta-whatsapp-phone-identity.store";
import {
  mapWhatsappBusinessProfile,
  fetchHttpsProfileImage,
  parseDisplayName,
  parseProfilePhoto,
  parseProfilePhotoFromBytes,
  META_WHATSAPP_DEFAULT_DISPLAY_NAME,
  parseVertical,
  parseDescription,
  parseAddress,
  parseEmail,
} from "./meta-whatsapp-phone-profile";
import { publishMetaPageProfilePicture, uploadMetaResumableImage } from "./meta-whatsapp-resumable-upload";
import { MetaWhatsappWebhookSubscriptionService } from "./meta-whatsapp-webhook-subscription.service";
import { applyCloudPhoneOccupancy, listBusyCloudPhoneNumberIds } from "./meta-whatsapp-phone-occupancy";

const SENSITIVE_KEY =
  /^(access_token|accessToken|app_secret|appSecret|client_secret|clientSecret|authorization_code|access_token_encrypted|accessTokenEncrypted|encrypted_token|encryptedToken|system_user_token|systemUserToken|refresh_token|refreshToken)$/i;

export type MetaWhatsappOauthPort = {
  exchangeEmbeddedSignupCode: typeof exchangeEmbeddedSignupCode;
};

export function toMetaWhatsappUiStatus(
  status: MetaWhatsappPublicConnection["status"] | null | undefined,
): MetaWhatsappUiStatus {
  if (status === "connected") return "conectado";
  if (status === "pending_token" || status === "pending_confirmation") return "aguardando_confirmacao";
  if (status === "error" || status === "invalid_token") return "erro";
  return "nao_conectado";
}

export function toMetaWhatsappPublicConnection(
  row: MetaWhatsappConnectionRecord | null,
): MetaWhatsappPublicConnection {
  if (!row) {
    return {
      connected: false,
      pending: false,
      wabaId: null,
      phoneNumberId: null,
      businessId: null,
      displayPhoneNumber: null,
      verifiedName: null,
      qualityRating: null,
      status: "disconnected",
      uiStatus: "nao_conectado",
    };
  }
  return {
    connected: row.status === "connected",
    pending: row.status === "pending_token" || row.status === "pending_confirmation",
    wabaId: row.wabaId,
    phoneNumberId: row.phoneNumberId,
    businessId: row.metaBusinessId,
    displayPhoneNumber: row.displayPhoneNumber,
    verifiedName: row.verifiedName,
    qualityRating: row.qualityRating,
    status: row.status,
    uiStatus: toMetaWhatsappUiStatus(row.status),
  };
}

export function stripMetaSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripMetaSecrets(item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue;
    out[key] = stripMetaSecrets(nested);
  }
  return out as T;
}

function requireTenant(auth: WabaRequestAuth): MetaWhatsappTenant {
  try {
    return resolveMetaWhatsappTenant(auth);
  } catch {
    throw new MetaWhatsappError("unauthenticated");
  }
}

function requireConfigured(): void {
  if (!isMetaTechProviderConfigured()) {
    throw new MetaWhatsappError("config_invalid");
  }
}

function withLocalIdentities(
  tenantId: string,
  assets: MetaPortfolioAssetsPublic,
): MetaPortfolioAssetsPublic {
  const localizeCard = (item: MetaPortfolioPublic) =>
    applyLocalPortfolioBusinessPhoto(tenantId, applyLocalPortfolioBusinessIdentity(tenantId, item));
  const busyPhoneIds = listBusyCloudPhoneNumberIds(tenantId);
  const localizeNumbers = (numbers: MetaPortfolioNumberPublic[]) =>
    applyCloudPhoneOccupancy(tenantId, applyLocalPhoneIdentities(tenantId, numbers), busyPhoneIds);
  const portfolio = assets.portfolio ? localizeCard(assets.portfolio) : null;
  const portfolios = (assets.portfolios || []).map((item) => ({
    ...localizeCard(item),
    numbers: localizeNumbers(item.numbers || []),
  }));
  return {
    ...assets,
    portfolios,
    selectedConnectionId: assets.selectedConnectionId ?? null,
    portfolio: portfolio,
    numbers: localizeNumbers(assets.numbers || []),
  };
}

function assetsFromPortfolioCards(
  cards: MetaPortfolioPublic[],
  requested: string,
): MetaPortfolioAssetsPublic {
  const selected =
    cards.find((item) => item.connectionId === requested) ||
    cards.find((item) => item.id && item.id === requested) ||
    cards[0];
  const selectedNumbers = selected?.numbers || [];
  return {
    portfolios: cards,
    selectedConnectionId: selected?.connectionId || null,
    portfolio: selected
      ? {
          id: selected.id,
          name: selected.name,
          primaryPageId: selected.primaryPageId,
          primaryPageName: selected.primaryPageName,
          profilePictureUrl: selected.profilePictureUrl,
          wabaId: selected.wabaId,
          connectionId: selected.connectionId,
        }
      : null,
    numbers: selectedNumbers,
  };
}

function storedNumbersFromConnection(open: MetaWhatsappConnectionRecord): MetaPortfolioNumberPublic[] {
  const phoneNumberId = String(open.phoneNumberId || "").trim();
  const display = String(open.displayPhoneNumber || "").trim();
  if (!display) return [];
  return [
    {
      phoneNumberId: phoneNumberId || display,
      displayPhoneNumber: display || null,
      verifiedName: open.verifiedName,
      qualityRating: open.qualityRating,
      metaStatus: null,
      codeVerificationStatus: null,
      healthCanSend: null,
      uiStatus: open.status === "connected" ? "ativo" : "pendente",
      dispatchStatus: "livre",
      canActivate: open.status !== "connected",
      nameNeedsRegister: false,
      nameStatus: null,
      newDisplayName: null,
      newNameStatus: null,
      profilePictureUrl: null,
      vertical: null,
      description: null,
      address: null,
      email: null,
      requestedName: null,
      nameSyncStatus: null,
      photoSyncStatus: null,
      profileSyncStatus: null,
      inboxEnabled: false,
      wabaId: String(open.wabaId || "").trim() || null,
    },
  ];
}

function cardFromConnection(open: MetaWhatsappConnectionRecord): MetaPortfolioPublic {
  return {
    id: businessIdNotWaba(open.metaBusinessId, open.wabaId),
    name: null,
    primaryPageId: null,
    primaryPageName: null,
    profilePictureUrl: null,
    wabaId: open.wabaId,
    connectionId: open.id,
    messagingLimit: open.messagingLimit,
  };
}

type HydratedPortfolio = {
  card: MetaPortfolioPublic;
  directory: MetaPortfolioPublic[];
};

const BUSINESS_PHOTO_TTL_MS = 30 * 1000;

async function cacheGraphBusinessPhoto(
  tenantId: string,
  businessId: string | null,
  url: string | null,
): Promise<string | null> {
  const id = String(businessId || "").trim();
  const local = id ? localPortfolioBusinessPhotoUrl(tenantId, id) : null;
  if (process.env.NODE_TEST_CONTEXT) {
    const raw = String(url || "").trim();
    if (!raw || !/^https:\/\//i.test(raw)) return local;
    try {
      const parsed = new URL(raw);
      if (parsed.searchParams.has("access_token")) return local;
      return parsed.toString();
    } catch {
      return local;
    }
  }
  if (!id) return local;
  if (!shouldRefreshPortfolioBusinessPhoto(tenantId, id, url, BUSINESS_PHOTO_TTL_MS)) return local;
  if (!url || !/^https:\/\//i.test(url)) return local;
  const downloaded = await fetchHttpsProfileImage(url);
  if (!downloaded) return local;
  return writePortfolioBusinessPhoto(tenantId, id, downloaded, url) || local;
}

const HYDRATE_GRAPH = { maxAttempts: 1, timeoutMs: 8000 } as const;
const HYDRATE_PHONE_BUDGET_MS = 18_000;

function withHydrateLimits(graph: MetaConnectionGraphCaller): MetaConnectionGraphCaller {
  return (input) =>
    graph({
      ...input,
      maxAttempts: input.maxAttempts ?? HYDRATE_GRAPH.maxAttempts,
      timeoutMs: input.timeoutMs ?? HYDRATE_GRAPH.timeoutMs,
    });
}

async function hydrateOpenConnection(
  graph: MetaConnectionGraphCaller,
  decrypt: (value: string) => string,
  tenantId: string,
  open: MetaWhatsappConnectionRecord,
  extraWabaIds: string[] = [],
): Promise<HydratedPortfolio> {
  const stored = storedNumbersFromConnection(open);
  const fallback = { ...cardFromConnection(open), numbers: stored };
  let token = "";
  try {
    token = decrypt(open.accessTokenEncrypted);
  } catch {
    logMetaWhatsappSafe("portfolio-list-partial", {
      tenantId,
      reason: "decrypt",
      connectionId: open.id,
    });
    return { card: fallback, directory: [] };
  }

  const g = withHydrateLimits(graph);

  const storedWaba = String(open.wabaId || "").trim();
  const storedBm = String(open.metaBusinessId || "").trim();
  if (!storedWaba && !storedBm) {
    return { card: fallback, directory: [] };
  }
  const wabaLookup = storedWaba || storedBm;
  const waba = wabaLookup ? await fetchWabaOwner(g, token, wabaLookup) : { hint: { wabaId: null, wabaName: null, businessId: null, businessName: null, primaryPageId: null, primaryPageName: null, profilePictureUrl: null }, json: null, ok: false };
  if (wabaLookup && !waba.ok) {
    logMetaWhatsappSafe("portfolio-list-partial", {
      tenantId,
      reason: "waba-identity",
      connectionId: open.id,
    });
  }

  const hint = waba.hint;
  const resolvedWaba =
    storedWaba ||
    (hint.businessId && hint.wabaId && hint.wabaId !== hint.businessId ? hint.wabaId : "");
  const resolvedBm =
    hint.businessId || businessIdNotWaba(storedBm, resolvedWaba || storedWaba) || "";

  const [assignedJson, fetchedBm] = await Promise.all([
    fetchAssignedBusinesses(g, token),
    resolvedBm
      ? fetchBusinessFromGraph(g, token, resolvedBm)
      : Promise.resolve({
          card: null as MetaPortfolioPublic | null,
          isWaba: false,
          wabaJson: null as unknown,
          photoDownloadUrl: null as string | null,
        }),
  ]);
  const directory = directoryFromAssigned(assignedJson);
  const matched = pickMetaBusinessNode(assignedJson, [resolvedBm, hint.businessId, storedBm]);

  let card = mergePortfolioIdentity({
    fallback,
    business: matched,
    waba: waba.json || fetchedBm.wabaJson,
  });
  const graphCard =
    fetchedBm.card ||
    directory.find((item) => item.id && (item.id === resolvedBm || item.id === hint.businessId)) ||
    null;
  if (graphCard && (graphCard.name || graphCard.primaryPageName || graphCard.profilePictureUrl || graphCard.id)) {
    card = {
      ...card,
      id: graphCard.id || card.id,
      name: graphCard.name || card.name,
      primaryPageId: graphCard.primaryPageId || hint.primaryPageId || card.primaryPageId,
      primaryPageName: graphCard.primaryPageName || hint.primaryPageName || card.primaryPageName,
      profilePictureUrl: graphCard.profilePictureUrl || card.profilePictureUrl,
      wabaId: graphCard.wabaId || card.wabaId || resolvedWaba || storedWaba,
      connectionId: open.id,
    };
  }
  card = {
    ...card,
    primaryPageId: card.primaryPageId || hint.primaryPageId,
    primaryPageName: card.primaryPageName || hint.primaryPageName,
  };
  if (card.primaryPageId && !card.primaryPageName) {
    card = await fillPageNameById(g, token, card.id || resolvedBm, card);
  }
  card = applyLocalPortfolioBusinessIdentity(tenantId, card);

  const photoDownloadUrl =
    fetchedBm.photoDownloadUrl ||
    graphPhotoDownloadUrl(matched) ||
    graphPhotoDownloadUrl(waba.json) ||
    card.profilePictureUrl;
  const localPhoto = await cacheGraphBusinessPhoto(tenantId, card.id, photoDownloadUrl);
  card = {
    ...card,
    profilePictureUrl: localPhoto || card.profilePictureUrl,
    wabaId: card.wabaId || resolvedWaba || storedWaba,
  };
  writePortfolioBusinessIdentity(tenantId, card);

  const primaryWabaId = resolvedWaba || storedWaba;
  const businessId = String(card.id || resolvedBm || "").trim();

  /**
   * Contas do WhatsApp deste BM = owned ("Propriedade de"). Client (ex.: Rio de Janeiro 01)
   * não entra no card, mesmo se GET owner/on_behalf parecer o BM marcado.
   * WABA irmã (outra conexão do mesmo BM) e debug_token fora do client completam o fan-out
   * quando o token ES 403 no GET da WABA02.
   */
  const wabaIds = new Set<string>();
  const clientIds = new Set<string>();
  if (primaryWabaId) wabaIds.add(primaryWabaId);
  for (const id of extraWabaIds) {
    const wid = String(id || "").trim();
    if (wid) wabaIds.add(wid);
  }
  for (const id of knownOwnedWabaIdsForBusiness(businessId || storedBm)) {
    const wid = String(id || "").trim();
    if (wid) wabaIds.add(wid);
  }

  const phoneRows: unknown[] = [];
  const pushPhones = (rows: unknown[]) => {
    for (const row of rows) phoneRows.push(row);
  };

  const nestedFromCustomer = businessId
    ? await collectNestedPhonesFromBusiness(g, token, businessId)
    : { wabaIds: [] as string[], clientWabaIds: [] as string[], phones: [] as unknown[] };
  const fromThisBm = new Set<string>(nestedFromCustomer.wabaIds);
  for (const id of nestedFromCustomer.clientWabaIds) clientIds.add(id);
  if (businessId) {
    for (const id of await listBusinessWabaIds(g, token, businessId, "owned")) fromThisBm.add(id);
    for (const id of await listBusinessWabaIds(g, token, businessId, "client")) clientIds.add(id);
  }
  for (const id of extraWabaIds) {
    const wid = String(id || "").trim();
    if (wid) fromThisBm.add(wid);
  }
  for (const id of knownOwnedWabaIdsForBusiness(businessId || storedBm)) {
    const wid = String(id || "").trim();
    if (wid) fromThisBm.add(wid);
  }
  for (const id of fromThisBm) wabaIds.add(id);
  pushPhones(nestedFromCustomer.phones);

  const nestedFromMe = await collectNestedPhonesFromMeBusinesses(g, token, businessId);
  for (const id of nestedFromMe.wabaIds) {
    fromThisBm.add(id);
    wabaIds.add(id);
  }
  for (const id of nestedFromMe.clientWabaIds) clientIds.add(id);
  pushPhones(nestedFromMe.phones);

  const debugTargets = await listDebugTokenWhatsappTargets(g, token);
  const debugPhoneNodes = await fetchPhoneNodes(g, token, debugTargets.phoneIds);
  pushPhones(debugPhoneNodes);
  if (businessId) {
    const unknownWabas = new Set<string>();
    for (const id of debugTargets.wabaIds) {
      if (isKnownClientWabaForBusiness(businessId, id)) {
        clientIds.add(id);
        continue;
      }
      if (id && !wabaIds.has(id) && !clientIds.has(id)) unknownWabas.add(id);
    }
    for (const row of debugPhoneNodes) {
      const rec = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const account = rec.whatsapp_business_account;
      const accountId =
        account && typeof account === "object"
          ? String((account as { id?: unknown }).id || "").trim()
          : "";
      const stamped = String(rec._portfolio_waba_id || "").trim();
      const wid = accountId || stamped;
      if (wid && !wabaIds.has(wid) && !clientIds.has(wid)) unknownWabas.add(wid);
    }
    if (unknownWabas.size) {
      const owned = await filterWabaIdsOwnedByBusiness({
        token,
        businessId,
        ids: [...unknownWabas],
        keepOnErrorIds: [...unknownWabas],
        graph: (input) =>
          g({
            ...input,
            method: input.method === "DELETE" ? "GET" : input.method,
          }),
      });
      for (const row of owned) {
        fromThisBm.add(row.id);
        wabaIds.add(row.id);
      }
    }
  } else {
    for (const id of debugTargets.wabaIds) wabaIds.add(id);
  }

  let anyPhonesOk = phoneRows.length > 0;
  let lastPhoneStatus = 0;
  const extraWabas = [...wabaIds].filter((id) => id && id !== primaryWabaId);
  const orderedWabas = [primaryWabaId, ...extraWabas].filter(Boolean);
  const startedAt = Date.now();
  for (const wid of orderedWabas) {
    if (Date.now() - startedAt >= HYDRATE_PHONE_BUDGET_MS && phoneRows.length) {
      logMetaWhatsappSafe("portfolio-hydrate-budget", {
        tenantId,
        connectionId: open.id,
        wabaId: wid,
        listed: phoneRows.length,
      });
      break;
    }
    const phones = await listWabaPhoneNumbersPaged(g, token, wid);
    if (!phones.ok) {
      lastPhoneStatus = phones.status;
      continue;
    }
    anyPhonesOk = true;
    pushPhones(stampPhoneRowsWithWabaId(phones.json.data, wid));
  }
  if (!anyPhonesOk) {
    logMetaWhatsappSafe("portfolio-list-partial", {
      tenantId,
      reason: "phones",
      status: lastPhoneStatus,
      connectionId: open.id,
      wabaCount: wabaIds.size,
    });
    const fallbackKnown = mapMetaPhoneListToPortfolioNumbers({
      data: knownPendingPhonesForBusiness(businessId || storedBm).map(knownPendingPhoneGraphRow),
    });
    return {
      card: {
        ...card,
        numbers: unionPortfolioNumbers(stored, fallbackKnown),
      },
      directory,
    };
  }

  logMetaWhatsappSafe("portfolio-fanout", {
    tenantId,
    connectionId: open.id,
    businessId: businessId || null,
    wabaCount: wabaIds.size,
    phoneRowCount: phoneRows.length,
  });

  const mapped = mapMetaPhoneListToPortfolioNumbers({ data: phoneRows });
  let merged = unionPortfolioNumbers(mapped, stored);
  const claimedPhoneId = String(open.phoneNumberId || "").trim();
  if (claimedPhoneId && !merged.some((row) => String(row.phoneNumberId || "").trim() === claimedPhoneId)) {
    const extra = await fetchPhoneNodes(g, token, [claimedPhoneId], primaryWabaId);
    merged = unionPortfolioNumbers(merged, mapMetaPhoneListToPortfolioNumbers({ data: extra }));
  }
  const knownPending = knownPendingPhonesForBusiness(businessId || storedBm);
  const missingKnownIds = knownPending
    .map((row) => row.phoneNumberId)
    .filter((id) => id && !merged.some((row) => String(row.phoneNumberId || "").trim() === id));
  if (missingKnownIds.length) {
    const extra = await fetchPhoneNodes(g, token, missingKnownIds);
    merged = unionPortfolioNumbers(merged, mapMetaPhoneListToPortfolioNumbers({ data: extra }));
  }
  const stillMissing = knownPending.filter(
    (row) => !merged.some((item) => String(item.phoneNumberId || "").trim() === row.phoneNumberId),
  );
  if (stillMissing.length) {
    merged = unionPortfolioNumbers(
      merged,
      mapMetaPhoneListToPortfolioNumbers({ data: stillMissing.map(knownPendingPhoneGraphRow) }),
    );
  }
  const pending = merged.filter((row) => row.uiStatus !== "ativo");
  const active = merged.filter((row) => row.uiStatus === "ativo");
  const withProfiles = active.length
    ? await attachPhoneBusinessProfiles(g, token, active, tenantId)
    : [];
  let numbers = unionPortfolioNumbers(withProfiles, pending);
  if (fromThisBm.size) {
    numbers = numbers.filter((row) => {
      const id = String(row.phoneNumberId || "").trim();
      if (claimedPhoneId && id === claimedPhoneId) return true;
      const wid = String(row.wabaId || "").trim();
      return wid ? wabaIds.has(wid) : false;
    });
  }
  return {
    card: {
      ...card,
      wabaId: card.wabaId || primaryWabaId || "",
      messagingLimit: open.messagingLimit || card.messagingLimit || null,
      numbers,
    },
    directory,
  };
}

/** WABAs (management) e chips (messaging) liberados no token — Embedded Signup manage-accounts. */
async function listDebugTokenWhatsappTargets(
  graph: MetaConnectionGraphCaller,
  userToken: string,
): Promise<{ wabaIds: string[]; phoneIds: string[] }> {
  const appId = readMetaAppId();
  const appSecret = readMetaAppSecret();
  if (!appId || !appSecret || !userToken) return { wabaIds: [], phoneIds: [] };
  const res = await graph({
    token: `${appId}|${appSecret}`,
    method: "GET",
    path: "debug_token",
    query: { input_token: userToken },
  });
  if (!res.ok) return { wabaIds: [], phoneIds: [] };
  const payload = (res.json && typeof res.json === "object" ? res.json : {}) as {
    data?: { granular_scopes?: Array<{ scope?: unknown; target_ids?: unknown }> };
  };
  const granular = Array.isArray(payload.data?.granular_scopes) ? payload.data!.granular_scopes! : [];
  const wabaIds = new Set<string>();
  const phoneIds = new Set<string>();
  for (const entry of granular) {
    const scope = String(entry?.scope || "").trim();
    const targets = Array.isArray(entry?.target_ids) ? entry.target_ids : [];
    for (const raw of targets) {
      const id = String(raw || "").trim();
      if (!id) continue;
      if (scope === "whatsapp_business_management") wabaIds.add(id);
      else if (scope === "whatsapp_business_messaging") phoneIds.add(id);
    }
  }
  return { wabaIds: [...wabaIds], phoneIds: [...phoneIds] };
}

async function fetchPhoneNodes(
  graph: MetaConnectionGraphCaller,
  token: string,
  phoneIds: string[],
  stampWabaId?: string,
): Promise<unknown[]> {
  const out: unknown[] = [];
  const fallbackWaba = String(stampWabaId || "").trim();
  for (const id of phoneIds) {
    const res = await graph({
      token,
      method: "GET",
      path: id,
      query: { fields: `${META_PHONE_NUMBER_CATALOG_FIELDS},whatsapp_business_account` },
    });
    if (!res.ok || !res.json || typeof res.json !== "object") continue;
    const display = String((res.json as { display_phone_number?: unknown }).display_phone_number || "").trim();
    if (!display) continue;
    const row = res.json as Record<string, unknown>;
    const account = row.whatsapp_business_account;
    const accountId =
      account && typeof account === "object"
        ? String((account as { id?: unknown }).id || "").trim()
        : "";
    out.push(
      fallbackWaba || accountId
        ? { ...row, _portfolio_waba_id: accountId || fallbackWaba }
        : row,
    );
  }
  return out;
}

function extractWabasAndPhonesFromBusinessNode(node: unknown): {
  wabaIds: string[];
  clientWabaIds: string[];
  phones: unknown[];
} {
  const row = node && typeof node === "object" ? (node as Record<string, unknown>) : {};
  const ownedIds = new Set<string>();
  const clientIds = new Set<string>();
  const phones: unknown[] = [];
  const takeEdge = (
    edge: "owned_whatsapp_business_accounts" | "client_whatsapp_business_accounts",
    into: Set<string>,
    takePhones: boolean,
  ) => {
    const bucket = row[edge];
    const data = bucket && typeof bucket === "object" ? (bucket as { data?: unknown }).data : null;
    const list = Array.isArray(data) ? data : [];
    for (const waba of list) {
      const wabaRow = waba && typeof waba === "object" ? (waba as Record<string, unknown>) : {};
      const wid = String(wabaRow.id || "").trim();
      if (wid) into.add(wid);
      if (!takePhones) continue;
      const phoneBucket = wabaRow.phone_numbers;
      const phoneData =
        phoneBucket && typeof phoneBucket === "object"
          ? (phoneBucket as { data?: unknown }).data
          : null;
      if (Array.isArray(phoneData)) {
        for (const phone of stampPhoneRowsWithWabaId(phoneData, wid)) phones.push(phone);
      }
    }
  };
  takeEdge("owned_whatsapp_business_accounts", ownedIds, true);
  takeEdge("client_whatsapp_business_accounts", clientIds, false);
  return { wabaIds: [...ownedIds], clientWabaIds: [...clientIds], phones };
}

async function collectNestedPhonesFromBusiness(
  graph: MetaConnectionGraphCaller,
  token: string,
  businessId: string,
): Promise<{ wabaIds: string[]; clientWabaIds: string[]; phones: unknown[] }> {
  const bm = String(businessId || "").trim();
  if (!bm) return { wabaIds: [], clientWabaIds: [], phones: [] };
  const fields = [
    "id",
    "name",
    `owned_whatsapp_business_accounts{id,name,phone_numbers.limit(100){${META_PHONE_NUMBER_CATALOG_FIELDS}}}`,
    `client_whatsapp_business_accounts{id,name}`,
  ].join(",");
  const res = await graph({
    token,
    method: "GET",
    path: bm,
    query: { fields },
  });
  if (!res.ok) return { wabaIds: [], clientWabaIds: [], phones: [] };
  return extractWabasAndPhonesFromBusinessNode(res.json);
}

async function collectNestedPhonesFromMeBusinesses(
  graph: MetaConnectionGraphCaller,
  token: string,
  onlyBusinessId?: string,
): Promise<{ wabaIds: string[]; clientWabaIds: string[]; phones: unknown[] }> {
  const fields = [
    "id",
    "name",
    `owned_whatsapp_business_accounts{id,name,phone_numbers.limit(100){${META_PHONE_NUMBER_CATALOG_FIELDS}}}`,
    `client_whatsapp_business_accounts{id,name}`,
  ].join(",");
  const res = await graph({
    token,
    method: "GET",
    path: "me/businesses",
    query: { fields, limit: "50" },
  });
  if (!res.ok) return { wabaIds: [], clientWabaIds: [], phones: [] };
  const data = Array.isArray(res.json?.data) ? res.json.data : [];
  const only = String(onlyBusinessId || "").trim();
  const wabaIds = new Set<string>();
  const clientWabaIds = new Set<string>();
  const phones: unknown[] = [];
  for (const node of data) {
    const nodeId = String(
      (node && typeof node === "object" ? (node as { id?: unknown }).id : "") || "",
    ).trim();
    if (only && nodeId !== only) continue;
    const extracted = extractWabasAndPhonesFromBusinessNode(node);
    for (const id of extracted.wabaIds) wabaIds.add(id);
    for (const id of extracted.clientWabaIds) clientWabaIds.add(id);
    for (const phone of extracted.phones) phones.push(phone);
  }
  return { wabaIds: [...wabaIds], clientWabaIds: [...clientWabaIds], phones };
}

/**
 * Lista WABA IDs de um Business Manager (owned = Propriedade de; client = compartilhada).
 * @see https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts/
 * @see https://developers.facebook.com/docs/marketing-api/reference/business/
 */
async function listBusinessWabaIds(
  graph: MetaConnectionGraphCaller,
  token: string,
  businessId: string,
  edge: "owned" | "client" = "owned",
): Promise<string[]> {
  const bm = String(businessId || "").trim();
  if (!bm) return [];
  const pathEdge =
    edge === "client" ? "client_whatsapp_business_accounts" : "owned_whatsapp_business_accounts";
  const ids = new Set<string>();
  const seen = new Set<string>();
  let after = "";
  for (let page = 0; page < 20; page += 1) {
    const query: Record<string, string> = {
      fields: "id,name",
      limit: "100",
    };
    if (after) query.after = after;
    const res = await graph({
      token,
      method: "GET",
      path: `${bm}/${pathEdge}`,
      query,
    });
    if (!res.ok) break;
    const batch = Array.isArray(res.json?.data) ? res.json.data : [];
    for (const row of batch) {
      const id = String((row as { id?: unknown })?.id || "").trim();
      if (id) ids.add(id);
    }
    const nextAfter = String(res.json?.paging?.cursors?.after || "").trim();
    if (!nextAfter || nextAfter === after || seen.has(nextAfter) || !batch.length) break;
    seen.add(nextAfter);
    after = nextAfter;
  }
  return [...ids];
}

async function listWabaPhoneNumbersPagedWithFields(
  graph: MetaConnectionGraphCaller,
  token: string,
  wabaId: string,
  fields?: string,
): Promise<{ ok: true; json: { data: unknown[] } } | { ok: false; status: number }> {
  const data: unknown[] = [];
  const seen = new Set<string>();
  let after = "";
  for (let page = 0; page < 20; page += 1) {
    const query: Record<string, string> = {
      limit: "100",
    };
    if (fields) query.fields = fields;
    if (after) query.after = after;
    const phones = await graph({
      token,
      method: "GET",
      path: `${wabaId}/phone_numbers`,
      query,
    });
    if (!phones.ok) {
      if (!data.length) return { ok: false, status: phones.status };
      break;
    }
    const batch = Array.isArray(phones.json?.data) ? phones.json.data : [];
    for (const row of batch) data.push(row);
    const nextAfter = String(phones.json?.paging?.cursors?.after || "").trim();
    if (!nextAfter || nextAfter === after || seen.has(nextAfter) || !batch.length) break;
    seen.add(nextAfter);
    after = nextAfter;
  }
  return { ok: true, json: { data } };
}

/** Graph `/{wabaId}/phone_numbers` não devolve waba_id; o Disparo Cloud agrupa pelo campo no chip. */
function stampPhoneRowsWithWabaId(rows: unknown[], wabaId: string): unknown[] {
  const wid = String(wabaId || "").trim();
  if (!wid) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    return { ...(row as Record<string, unknown>), _portfolio_waba_id: wid };
  });
}

function mergePhoneNumberRows(...lists: unknown[][]): unknown[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const list of lists) {
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const id = String(rec.id || "").trim();
      if (!id) continue;
      const prev = byId.get(id) || {};
      byId.set(id, { ...prev, ...rec, id });
    }
  }
  return [...byId.values()];
}

/** Lista todos os chips do WABA. Une catálogo (Pendente) com health/tier/nome dos Ativos. */
async function listWabaPhoneNumbersPaged(
  graph: MetaConnectionGraphCaller,
  token: string,
  wabaId: string,
): Promise<{ ok: true; json: { data: unknown[] } } | { ok: false; status: number }> {
  const [defaults, catalog, withLimit] = await Promise.all([
    listWabaPhoneNumbersPagedWithFields(graph, token, wabaId),
    listWabaPhoneNumbersPagedWithFields(graph, token, wabaId, META_PHONE_NUMBER_CATALOG_FIELDS),
    listWabaPhoneNumbersPagedWithFields(graph, token, wabaId, META_PHONE_NUMBER_LIST_FIELDS_WITH_LIMIT),
  ]);
  const merged = mergePhoneNumberRows(
    defaults.ok ? defaults.json.data : [],
    catalog.ok ? catalog.json.data : [],
    withLimit.ok ? withLimit.json.data : [],
  );
  if (merged.length) return { ok: true, json: { data: merged } };
  if (catalog.ok) return catalog;
  if (defaults.ok) return defaults;
  return withLimit;
}

async function cacheGraphPhonePhoto(
  tenantId: string,
  phoneNumberId: string,
  url: string | null,
): Promise<string | null> {
  const identity = readPhoneIdentity(tenantId, phoneNumberId);
  const local = localPhonePhotoUrl(phoneNumberId, identity);
  if (process.env.NODE_TEST_CONTEXT) return local;
  if (identity?.photoMetaApplied && identity.photoExt) return local;
  if (!url || !/^https:\/\//i.test(url)) return local;
  const nextKey = graphPhotoSourceKey(url);
  if (identity?.photoExt && identity.photoSource && nextKey && identity.photoSource === nextKey) {
    return localPhonePhotoUrl(phoneNumberId, identity);
  }
  const downloaded = await fetchHttpsProfileImage(url);
  if (!downloaded) return local;
  const saved = writePhoneIdentity(tenantId, phoneNumberId, {
    photo: downloaded,
    photoSource: nextKey,
    photoMetaApplied: true,
  });
  return localPhonePhotoUrl(phoneNumberId, saved) || local;
}

async function attachPhoneBusinessProfiles(
  graph: MetaConnectionGraphCaller,
  token: string,
  numbers: MetaPortfolioNumberPublic[],
  tenantId: string,
): Promise<MetaPortfolioNumberPublic[]> {
  if (!numbers.length) return numbers;
  const limited = numbers.slice(0, 20);
  const rest = numbers.slice(20);
  const withProfiles = await Promise.all(
    limited.map(async (row) => {
      const [nameNode, profile] = await Promise.all([
        graph({
          token,
          method: "GET",
          path: row.phoneNumberId,
          query: { fields: META_PHONE_NAME_FIELDS },
        }),
        graph({
          token,
          method: "GET",
          path: `${row.phoneNumberId}/whatsapp_business_profile`,
          query: { fields: "about,address,description,email,profile_picture_url,vertical" },
        }),
      ]);
      const named = nameNode.ok ? mapPhoneNameFields(nameNode.json) : {
        verifiedName: null,
        nameStatus: null,
        newDisplayName: null,
        newNameStatus: null,
      };
      const verifiedName = named.verifiedName || row.verifiedName;
      const nameStatus = named.nameStatus || row.nameStatus;
      const newDisplayName = named.newDisplayName || row.newDisplayName;
      const newNameStatus = named.newNameStatus || row.newNameStatus;
      const nameSync = resolvePhoneNameSync({
        verifiedName,
        nameStatus,
        newDisplayName,
        newNameStatus,
      });
      const mapped = profile.ok ? mapWhatsappBusinessProfile(profile.json) : null;
      const localPhoto = await cacheGraphPhonePhoto(tenantId, row.phoneNumberId, mapped?.profilePictureUrl || null);
      return {
        ...row,
        verifiedName,
        nameStatus,
        newDisplayName,
        newNameStatus,
        requestedName: nameSync.requestedName,
        nameSyncStatus: nameSync.nameSyncStatus,
        nameNeedsRegister: nameSync.nameNeedsRegister,
        canActivate: canActivateMetaPhoneNumber(
          resolveMetaPhoneUiStatus({
            metaStatus: row.metaStatus,
            codeVerificationStatus: row.codeVerificationStatus,
            healthCanSend: row.healthCanSend,
          }),
          nameSync.nameNeedsRegister,
        ),
        profilePictureUrl: localPhoto || safePublicPhotoUrl(mapped?.profilePictureUrl),
        vertical: mapped?.vertical ?? row.vertical,
        description: mapped?.description ?? row.description,
        address: mapped?.address ?? row.address,
        email: mapped?.email ?? row.email,
      };
    }),
  );
  return rest.length ? withProfiles.concat(rest) : withProfiles;
}

export type MetaConnectionGraphCaller = (input: {
  token: string;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  maxAttempts?: number;
  timeoutMs?: number;
}) => Promise<MetaGraphJsonResult>;

function wabaIdFromPhoneJson(json: unknown): string {
  const row = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const nested = row.whatsapp_business_account;
  if (nested && typeof nested === "object") {
    return String((nested as { id?: unknown }).id || "").trim();
  }
  return "";
}

/** Uma conexão elegível por WABA (preferred connectionId / phoneNumberId primeiro). */
export function pickConnectionsForWebhookSubscribe(
  open: MetaWhatsappConnectionRecord[],
  opts?: { connectionId?: string | null; phoneNumberId?: string | null },
): MetaWhatsappConnectionRecord[] {
  const preferredId = String(opts?.connectionId || "").trim();
  const phone = String(opts?.phoneNumberId || "").trim();
  const eligible = open.filter((row) => {
    if (row.disconnectedAt) return false;
    if (!String(row.wabaId || "").trim()) return false;
    return row.status === "connected" || row.status === "pending_confirmation";
  });
  const score = (row: MetaWhatsappConnectionRecord): number => {
    let n = 0;
    if (preferredId && row.id === preferredId) n += 2;
    if (phone && String(row.phoneNumberId || "").trim() === phone) n += 1;
    return n;
  };
  const sorted = [...eligible].sort((a, b) => score(b) - score(a) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const seen = new Set<string>();
  const out: MetaWhatsappConnectionRecord[] = [];
  for (const row of sorted) {
    const waba = String(row.wabaId || "").trim();
    if (seen.has(waba)) continue;
    seen.add(waba);
    out.push(row);
  }
  return out;
}

function rememberOfficialPhoneDisplayName(tenantId: string, phoneNumberId: string): void {
  const id = String(phoneNumberId || "").trim();
  if (!id) return;
  try {
    writePhoneIdentity(tenantId, id, {
      name: META_WHATSAPP_DEFAULT_DISPLAY_NAME,
      channelName: META_WHATSAPP_DEFAULT_DISPLAY_NAME,
    });
  } catch {
    // Identidade local não pode abortar o cadastro do número.
  }
}

async function requestOfficialPhoneDisplayName(
  graph: MetaConnectionGraphCaller,
  input: { token: string; tenantId: string; phoneNumberId: string; currentVerifiedName?: string | null },
): Promise<void> {
  rememberOfficialPhoneDisplayName(input.tenantId, input.phoneNumberId);
  if (namesEqual(input.currentVerifiedName, META_WHATSAPP_DEFAULT_DISPLAY_NAME)) return;
  const renamed = await graph({
    token: input.token,
    method: "POST",
    path: input.phoneNumberId,
    query: { new_display_name: META_WHATSAPP_DEFAULT_DISPLAY_NAME },
  });
  if (!renamed.ok) {
    logMetaWhatsappSafe("phone-default-name-failed", {
      tenantId: input.tenantId,
      status: renamed.status,
      graphCode: renamed.graphCode,
    });
    return;
  }
  logMetaWhatsappSafe("phone-default-name-requested", { tenantId: input.tenantId });
}

export class MetaWhatsappConnectionService {
  constructor(
    private readonly repository = new MetaWhatsappConnectionRepository(),
    private readonly oauth: MetaWhatsappOauthPort = { exchangeEmbeddedSignupCode },
    private readonly graph: MetaConnectionGraphCaller = (input) => callMetaGraphJson(input),
    private readonly decrypt = decryptMetaToken,
    private readonly uploadImage = uploadMetaResumableImage,
    private readonly setPagePicture = publishMetaPageProfilePicture,
    private readonly webhookSubscriptions = new MetaWhatsappWebhookSubscriptionService(),
  ) {}

  startAuthenticatedFlow(auth: WabaRequestAuth): {
    ok: true;
    appId: string;
    configId: string;
    graphVersion: string;
    callbackPath: string;
  } {
    const tenant = requireTenant(auth);
    requireConfigured();
    logMetaWhatsappSafe("start", { tenantId: tenant.tenantId });
    return {
      ok: true,
      appId: readMetaAppId(),
      configId: readMetaConfigId(),
      graphVersion: readMetaJsSdkGraphVersion(),
      callbackPath: "/integrations/meta/whatsapp/callback",
    };
  }

  async getPublicStatus(auth: WabaRequestAuth): Promise<MetaWhatsappPublicConnection> {
    const tenant = requireTenant(auth);
    const row = await this.repository.findOpenByTenant(tenant.tenantId);
    return toMetaWhatsappPublicConnection(row);
  }

  async disconnectOfficialLabFromAuth(auth: WabaRequestAuth): Promise<{
    disconnected: number;
    portfolios: MetaPortfolioPublic[];
    selectedConnectionId: string | null;
    portfolio: MetaPortfolioPublic | null;
    numbers: MetaPortfolioNumberPublic[];
  }> {
    const tenant = requireTenant(auth);
    const repo = this.repository as MetaWhatsappConnectionRepository;
    if (typeof repo.disconnectOpenByTenant !== "function") {
      throw new MetaWhatsappError("persist_failed");
    }
    const disconnected = await repo.disconnectOpenByTenant(tenant.tenantId, tenant.ownerEmail);
    invalidateCachedPortfolioGraph(tenant.tenantId);
    purgePortfolioIdentity(tenant.tenantId);
    purgePhoneIdentities(tenant.tenantId);
    logMetaWhatsappSafe("portfolio-disconnected", {
      tenantId: tenant.tenantId,
      disconnected,
    });
    return {
      disconnected,
      portfolios: [],
      selectedConnectionId: null,
      portfolio: null,
      numbers: [],
    };
  }

  async exchangeCodeAndStore(
    auth: WabaRequestAuth,
    input: { code?: string; redirectUri?: string; tenantId?: string; ownerEmail?: string },
  ): Promise<MetaWhatsappPublicConnection> {
    const tenant = requireTenant(auth);
    requireConfigured();
    const code = String(input.code || "").trim();
    if (!code) {
      throw new MetaWhatsappError("code_missing");
    }
    if (input.tenantId || input.ownerEmail) {
      logMetaWhatsappSafe("ignored-client-tenant", { tenantId: tenant.tenantId });
    }

    let exchanged: Awaited<ReturnType<typeof exchangeEmbeddedSignupCode>>;
    try {
      exchanged = await this.oauth.exchangeEmbeddedSignupCode({
        code,
        redirectUri: input.redirectUri,
      });
    } catch (error) {
      logMetaWhatsappSafe("exchange-failed", {
        tenantId: tenant.tenantId,
        status: Number((error as { status?: number })?.status) || 0,
      });
      const msg = String((error as { message?: string })?.message || "");
      if (/access_token|invalid.?token/i.test(msg)) {
        throw new MetaWhatsappError("invalid_token");
      }
      throw new MetaWhatsappError("exchange_failed");
    }

    let encrypted: string;
    try {
      encrypted = encryptMetaToken(exchanged.accessToken);
    } catch (error) {
      logMetaWhatsappSafe("encrypt-failed", {
        tenantId: tenant.tenantId,
        crypto: error instanceof MetaTokenCryptoError,
      });
      throw new MetaWhatsappError("persist_failed");
    }

    try {
      const row = await this.repository.upsertPendingToken({
        tenantId: tenant.tenantId,
        ownerEmail: tenant.ownerEmail,
        accessTokenEncrypted: encrypted,
        tokenType: exchanged.tokenType,
        tokenExpiresAt: metaOauthExpiresAt(exchanged.expiresIn),
        configId: readMetaConfigId() || null,
        metaBusinessId: null,
        actorEmail: tenant.ownerEmail,
      });
      logMetaWhatsappSafe("token-stored", {
        tenantId: tenant.tenantId,
        status: row.status,
        connectionId: row.id,
      });
      return toMetaWhatsappPublicConnection(row);
    } catch (error) {
      logMetaWhatsappSafe("persist-failed", { tenantId: tenant.tenantId });
      throw new MetaWhatsappError("persist_failed");
    }
  }

  async attachSessionAssets(
    auth: WabaRequestAuth,
    input: {
      wabaId?: string;
      phoneNumberId?: string;
      businessId?: string;
      displayPhoneNumber?: string;
      verifiedName?: string;
      tenantId?: string;
      ownerEmail?: string;
    },
  ): Promise<MetaWhatsappPublicConnection> {
    const tenant = requireTenant(auth);
    if (input.tenantId || input.ownerEmail) {
      logMetaWhatsappSafe("ignored-client-tenant", { tenantId: tenant.tenantId });
    }
    const incomingBusinessId = String(input.businessId || "").trim();
    const open =
      (incomingBusinessId
        ? await this.repository.findByBusinessId(tenant.tenantId, incomingBusinessId)
        : null) ??
      (await this.repository.latestPendingToken(tenant.tenantId));
    if (!open) {
      throw new MetaWhatsappError("no_pending_connection");
    }
    const wabaId = String(input.wabaId || open.wabaId || "").trim();
    const phoneNumberId = String(input.phoneNumberId || open.phoneNumberId || "").trim();
    const businessId = String(input.businessId || open.metaBusinessId || "").trim();
    if (!wabaId && !phoneNumberId && !businessId) {
      return toMetaWhatsappPublicConnection(open);
    }
    try {
      const row = await this.repository.attachClaimedAssets(tenant.tenantId, open.id, {
        wabaId: wabaId || null,
        phoneNumberId: phoneNumberId || null,
        metaBusinessId: businessId || null,
        displayPhoneNumber: input.displayPhoneNumber || open.displayPhoneNumber,
        verifiedName: input.verifiedName || open.verifiedName,
        actorEmail: tenant.ownerEmail,
      });
      logMetaWhatsappSafe("assets-claimed", {
        tenantId: tenant.tenantId,
        connectionId: row.id,
        hasWaba: Boolean(row.wabaId),
        hasPhone: Boolean(row.phoneNumberId),
        hasBusiness: Boolean(row.metaBusinessId),
        status: row.status,
      });
      const repo = this.repository as MetaWhatsappConnectionRepository;
      if (typeof repo.disconnectEmptyPendingTokens === "function") {
        await repo.disconnectEmptyPendingTokens(tenant.tenantId, tenant.ownerEmail, row.id);
      }
      if (phoneNumberId) {
        rememberOfficialPhoneDisplayName(tenant.tenantId, phoneNumberId);
      }
      return toMetaWhatsappPublicConnection(row);
    } catch {
      throw new MetaWhatsappError("persist_failed");
    }
  }

  /**
   * Só marca connected após Graph confirmar WABA + Phone Number da mesma conta.
   */
  async confirmFromAuth(auth: WabaRequestAuth): Promise<MetaWhatsappPublicConnection> {
    const tenant = requireTenant(auth);
    const open = await this.repository.findOpenByTenant(tenant.tenantId);
    if (!open) throw new MetaWhatsappError("no_pending_connection");
    if (open.status === "connected") return toMetaWhatsappPublicConnection(open);
    const wabaId = String(open.wabaId || "").trim();
    const phoneNumberId = String(open.phoneNumberId || "").trim();
    if (!wabaId || !phoneNumberId) {
      logMetaWhatsappSafe("graph-validation-skip", {
        tenantId: tenant.tenantId,
        reason: "missing_assets",
        hasWaba: Boolean(wabaId),
        hasPhone: Boolean(phoneNumberId),
      });
      return toMetaWhatsappPublicConnection(open);
    }

    let token = "";
    try {
      token = this.decrypt(open.accessTokenEncrypted);
    } catch {
      logMetaWhatsappSafe("graph-validation-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
      throw new MetaWhatsappError("invalid_token");
    }

    const waba = await this.graph({
      token,
      method: "GET",
      path: wabaId,
      query: { fields: "id" },
    });
    if (!waba.ok) {
      logMetaWhatsappSafe("graph-validation-failed", {
        tenantId: tenant.tenantId,
        reason: "waba",
        status: waba.status,
      });
      if (waba.status === 401) throw new MetaWhatsappError("invalid_token");
      throw new MetaWhatsappError("persist_failed");
    }
    const phone = await this.graph({
      token,
      method: "GET",
      path: phoneNumberId,
      query: { fields: "id,display_phone_number,verified_name,quality_rating,whatsapp_business_account" },
    });
    if (!phone.ok) {
      logMetaWhatsappSafe("graph-validation-failed", {
        tenantId: tenant.tenantId,
        reason: "phone",
        status: phone.status,
      });
      if (phone.status === 401) throw new MetaWhatsappError("invalid_token");
      throw new MetaWhatsappError("persist_failed");
    }

    const phoneWaba = wabaIdFromPhoneJson(phone.json);
    const graphWabaId = String((waba.json as { id?: unknown })?.id || "").trim();
    if (!graphWabaId || graphWabaId !== wabaId || (phoneWaba && phoneWaba !== wabaId)) {
      logMetaWhatsappSafe("graph-validation-failed", {
        tenantId: tenant.tenantId,
        reason: "phone_not_in_waba",
      });
      throw new MetaWhatsappError("persist_failed");
    }

    const connected = await this.repository.markConnected(tenant.tenantId, open.id, {
      displayPhoneNumber: String((phone.json as { display_phone_number?: unknown })?.display_phone_number || open.displayPhoneNumber || "").trim() || null,
      verifiedName: String((phone.json as { verified_name?: unknown })?.verified_name || open.verifiedName || "").trim() || null,
      qualityRating: String((phone.json as { quality_rating?: unknown })?.quality_rating || "").trim() || null,
      actorEmail: tenant.ownerEmail,
    });
    if (!connected) throw new MetaWhatsappError("persist_failed");
    logMetaWhatsappSafe("graph-validated", {
      tenantId: tenant.tenantId,
      connectionId: connected.id,
      hasWaba: true,
      hasPhone: true,
      hasQuality: Boolean(connected.qualityRating),
      status: connected.status,
    });
    try {
      await requestOfficialPhoneDisplayName(this.graph, {
        token,
        tenantId: tenant.tenantId,
        phoneNumberId,
        currentVerifiedName: connected.verifiedName,
      });
    } catch {
      logMetaWhatsappSafe("phone-default-name-skip", { tenantId: tenant.tenantId });
    }
    return toMetaWhatsappPublicConnection(connected);
  }

  async listPortfolioAssets(
    auth: WabaRequestAuth,
    opts?: { connectionId?: string; fresh?: boolean },
  ): Promise<MetaPortfolioAssetsPublic> {
    const tenant = requireTenant(auth);
    const requested = String(opts?.connectionId || "").trim();
    if (isMetaGraphUploadCooldown()) {
      const stale = readStaleCachedPortfolioGraph(tenant.tenantId);
      if (stale?.portfolios?.length) {
        return withLocalIdentities(tenant.tenantId, assetsFromPortfolioCards(stale.portfolios, requested));
      }
      return withLocalIdentities(tenant.tenantId, await this.loadStoredPortfolioAssets(tenant.tenantId, requested));
    }
    const useCache = shouldUsePortfolioGraphCache() && !opts?.fresh;
    if (useCache) {
      const cached = readCachedPortfolioGraph(tenant.tenantId);
      if (cached?.portfolios?.length) {
        return withLocalIdentities(tenant.tenantId, assetsFromPortfolioCards(cached.portfolios, requested));
      }
      const pending = readPortfolioGraphInflight(tenant.tenantId);
      if (pending) {
        const raw = await pending;
        return withLocalIdentities(tenant.tenantId, assetsFromPortfolioCards(raw.portfolios || [], requested));
      }
    }
    const work = this.loadPortfolioGraphAssets(tenant.tenantId, requested);
    if (useCache) setPortfolioGraphInflight(tenant.tenantId, work);
    try {
      const raw = await work;
      if (shouldUsePortfolioGraphCache()) writeCachedPortfolioGraph(tenant.tenantId, raw);
      return withLocalIdentities(tenant.tenantId, raw);
    } finally {
      clearPortfolioGraphInflight(tenant.tenantId);
    }
  }

  private async loadStoredPortfolioAssets(
    tenantId: string,
    requested: string,
  ): Promise<MetaPortfolioAssetsPublic> {
    const repo = this.repository as MetaWhatsappConnectionRepository;
    const rows =
      typeof repo.listOpenByTenant === "function"
        ? await repo.listOpenByTenant(tenantId)
        : [await this.repository.findOpenByTenant(tenantId)].filter(
            (item): item is MetaWhatsappConnectionRecord => Boolean(item),
          );
    const cards = dedupePortfolioCards(
      rows.map((row) => ({ ...cardFromConnection(row), numbers: storedNumbersFromConnection(row) })),
    ).filter(isRenderablePortfolioCard);
    return assetsFromPortfolioCards(cards, requested);
  }

  private async loadPortfolioGraphAssets(
    tenantId: string,
    requested: string,
  ): Promise<MetaPortfolioAssetsPublic> {
    const repo = this.repository as MetaWhatsappConnectionRepository;
    const rows =
      typeof repo.listOpenByTenant === "function"
        ? await repo.listOpenByTenant(tenantId)
        : [await this.repository.findOpenByTenant(tenantId)].filter(
            (item): item is MetaWhatsappConnectionRecord => Boolean(item),
          );
    if (!rows.length) {
      return {
        portfolios: [],
        selectedConnectionId: null,
        portfolio: null,
        numbers: [],
      };
    }

    const hydrated = await Promise.all(
      rows.map((row) =>
        hydrateOpenConnection(
          this.graph,
          this.decrypt,
          tenantId,
          row,
          extraWabaIdsFromConnections(rows, row),
        ),
      ),
    );
    const cards = dedupePortfolioCards(hydrated.map((item) => item.card)).filter(isRenderablePortfolioCard);
    const raw = assetsFromPortfolioCards(cards, requested);
    logMetaWhatsappSafe("portfolio-listed", {
      tenantId,
      hasBusiness: Boolean(raw.portfolio?.id),
      numbers: raw.numbers.length,
    });
    return raw;
  }

  async registerPhoneFromAuth(
    auth: WabaRequestAuth,
    input: { phoneNumberId?: string; pin?: string; connectionId?: string },
  ): Promise<MetaPortfolioAssetsPublic> {
    const tenant = requireTenant(auth);
    const repo = this.repository as MetaWhatsappConnectionRepository;
    const rows =
      typeof repo.listOpenByTenant === "function"
        ? await repo.listOpenByTenant(tenant.tenantId)
        : [await this.repository.findOpenByTenant(tenant.tenantId)].filter(
            (item): item is MetaWhatsappConnectionRecord => Boolean(item),
          );
    const connectionId = String(input.connectionId || "").trim();
    const requestedPhone = String(input.phoneNumberId || "").trim();
    const open =
      (connectionId ? rows.find((item) => item.id === connectionId) : null) ||
      rows.find((item) => String(item.phoneNumberId || "").trim() === requestedPhone) ||
      rows[0] ||
      null;
    if (!open) throw new MetaWhatsappError("no_pending_connection");
    const phoneNumberId = requestedPhone || String(open.phoneNumberId || "").trim();
    const pin = String(input.pin || "").trim();
    if (!phoneNumberId) throw new MetaWhatsappError("invalid_payload");
    if (!/^\d{6}$/.test(pin)) throw new MetaWhatsappError("invalid_pin");

    const sameBm = rows.filter((row) => {
      const bm = String(row.metaBusinessId || "").trim();
      const selectedBm = String(open.metaBusinessId || "").trim();
      if (selectedBm && bm && bm !== selectedBm) return false;
      return true;
    });
    const phoneWabaId =
      knownWabaIdForPendingPhone(phoneNumberId) ||
      String(
        sameBm.find((row) => String(row.phoneNumberId || "").trim() === phoneNumberId)?.wabaId || "",
      ).trim();
    const candidates = [...sameBm].sort((left, right) => {
      const leftWaba = String(left.wabaId || "").trim();
      const rightWaba = String(right.wabaId || "").trim();
      const leftMatch = phoneWabaId && leftWaba === phoneWabaId ? 0 : 1;
      const rightMatch = phoneWabaId && rightWaba === phoneWabaId ? 0 : 1;
      if (leftMatch !== rightMatch) return leftMatch - rightMatch;
      if (left.id === open.id) return -1;
      if (right.id === open.id) return 1;
      return 0;
    });

    let token = "";
    let used = open;
    let registered: Awaited<ReturnType<MetaConnectionGraphCaller>> | null = null;
    for (const candidate of candidates.length ? candidates : [open]) {
      try {
        token = this.decrypt(candidate.accessTokenEncrypted);
      } catch {
        continue;
      }
      if (!token) continue;
      used = candidate;
      registered = await this.graph({
        token,
        method: "POST",
        path: `${phoneNumberId}/register`,
        body: { messaging_product: "whatsapp", pin },
      });
      if (registered.ok) break;
      const code = String(
        registered.graphCode ||
          (registered.json && typeof registered.json === "object"
            ? (registered.json as { error?: { code?: unknown } }).error?.code
            : "") ||
          "",
      ).trim();
      if (code === "133005" || code === "133006" || code === "133008" || code === "133009") break;
    }
    if (!token) {
      logMetaWhatsappSafe("phone-register-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
      throw new MetaWhatsappError("invalid_token");
    }
    if (!registered || !registered.ok) {
      const graphCode = String(registered?.graphCode || "").trim();
      logMetaWhatsappSafe("phone-register-failed", {
        tenantId: tenant.tenantId,
        reason: "graph",
        status: registered?.status || 0,
        graphCode,
        phoneWabaId: phoneWabaId || null,
        connectionWabaId: String(used.wabaId || "").trim() || null,
      });
      if (registered?.status === 401) throw new MetaWhatsappError("invalid_token");
      throw new MetaWhatsappError(
        "register_failed",
        undefined,
        publicMetaGraphRegisterMessage({
          status: registered?.status || 0,
          json: registered?.json,
          graphCode,
          phoneWabaId,
          phoneWabaName: knownWabaNameForId(phoneWabaId),
        }),
      );
    }

    logMetaWhatsappSafe("phone-registered", {
      tenantId: tenant.tenantId,
      connectionId: used.id,
    });

    if (open.wabaId && open.phoneNumberId && open.status !== "connected" && rows[0]?.id === open.id) {
      try {
        await this.confirmFromAuth(auth);
      } catch {
        logMetaWhatsappSafe("phone-register-confirm-skip", { tenantId: tenant.tenantId });
      }
    }

    try {
      await requestOfficialPhoneDisplayName(this.graph, {
        token,
        tenantId: tenant.tenantId,
        phoneNumberId,
        currentVerifiedName: open.verifiedName,
      });
    } catch {
      logMetaWhatsappSafe("phone-default-name-skip", { tenantId: tenant.tenantId });
    }

    invalidateCachedPortfolioGraph(tenant.tenantId);
    return this.listPortfolioAssets(auth, { fresh: true });
  }

  async updatePhoneProfileFromAuth(
    auth: WabaRequestAuth,
    input: {
      phoneNumberId?: string;
      connectionId?: string;
      displayName?: string;
      photoBase64?: string;
      photoMime?: string;
      photoBytes?: Buffer;
      vertical?: string;
      description?: string;
      address?: string;
      email?: string;
    },
  ): Promise<
    MetaPortfolioAssetsPublic & {
      namePending: boolean;
      nameNeedsRegister: boolean;
      nameUpdated: boolean;
      photoUpdated: boolean;
      profileUpdated: boolean;
      nameRejected: boolean;
      nameRejectMessage: string | null;
    }
  > {
    const tenant = requireTenant(auth);
    const phoneNumberId = String(input.phoneNumberId || "").trim();
    const displayName = parseDisplayName(input.displayName);
    const sentPhoto = Boolean(
      (input.photoBytes && input.photoBytes.length) || String(input.photoBase64 || "").trim(),
    );
    const photo = input.photoBytes?.length
      ? parseProfilePhotoFromBytes(input.photoBytes, input.photoMime)
      : parseProfilePhoto({ photoBase64: input.photoBase64, photoMime: input.photoMime });
    const vertical = parseVertical(input.vertical);
    const description = parseDescription(input.description);
    const address = parseAddress(input.address);
    const email = parseEmail(input.email);
    if (vertical === null || description === null || address === null || email === null) {
      throw new MetaWhatsappError("invalid_payload");
    }
    // "" do front = campo omitido/sem mudança; não dispara POST de perfil sozinho.
    const hasBiz = Boolean(vertical || description || address || email);
    if (sentPhoto && !photo) {
      throw new MetaWhatsappError("profile_photo_update_failed");
    }
    if (!phoneNumberId || (!displayName && !photo && !hasBiz)) {
      throw new MetaWhatsappError("invalid_payload");
    }

    const repo = this.repository as MetaWhatsappConnectionRepository;
    const rows =
      typeof repo.listOpenByTenant === "function"
        ? await repo.listOpenByTenant(tenant.tenantId)
        : [await this.repository.findOpenByTenant(tenant.tenantId)].filter(
            (item): item is MetaWhatsappConnectionRecord => Boolean(item),
          );
    const connectionId = String(input.connectionId || "").trim();
    const open =
      (connectionId ? rows.find((item) => item.id === connectionId) : null) ||
      rows.find((item) => String(item.phoneNumberId || "").trim() === phoneNumberId) ||
      rows[0] ||
      null;
    if (!open) throw new MetaWhatsappError("no_pending_connection");

    const assets = await this.listPortfolioAssets(auth, { connectionId: open.id });
    const allNumbers = [
      ...assets.numbers,
      ...(assets.portfolios || []).flatMap((item) => item.numbers || []),
    ];
    const numberRow = allNumbers.find((row) => row.phoneNumberId === phoneNumberId);
    if (!numberRow) throw new MetaWhatsappError("invalid_payload");

    let token = "";
    try {
      token = this.decrypt(open.accessTokenEncrypted);
    } catch {
      logMetaWhatsappSafe("phone-profile-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
      throw new MetaWhatsappError("invalid_token");
    }

    if (!isMetaPhoneConnected(numberRow.metaStatus)) {
      logMetaWhatsappSafe("phone-profile-failed", {
        tenantId: tenant.tenantId,
        reason: "not_registered",
      });
      throw new MetaWhatsappError("phone_not_registered");
    }

    let namePending = false;
    let nameNeedsRegister = false;
    let nameUpdated = false;
    let nameFailure: "invalid_token" | "display_name_update_failed" | null = null;
    const wantsProfile = Boolean(photo) || hasBiz;

    if (displayName) {
      const renamed = await this.graph({
        token,
        method: "POST",
        path: phoneNumberId,
        query: { new_display_name: displayName },
      });
      if (!renamed.ok) {
        logMetaWhatsappSafe("phone-profile-failed", {
          tenantId: tenant.tenantId,
          reason: "name",
          status: renamed.status,
          graphCode: renamed.graphCode,
        });
        if (renamed.status === 401) {
          // Token morto: sem sentido tentar foto/perfil.
          throw new MetaWhatsappError("invalid_token");
        }
        nameFailure = "display_name_update_failed";
        // Nome e foto são independentes na Graph — segue com foto/dados se houver.
        if (!wantsProfile) throw new MetaWhatsappError("display_name_update_failed");
      } else {
        nameUpdated = true;
        const nameNode = await this.graph({
          token,
          method: "GET",
          path: phoneNumberId,
          query: { fields: META_PHONE_NAME_FIELDS },
        });
        const named = nameNode.ok
          ? mapPhoneNameFields(nameNode.json)
          : {
              verifiedName: null,
              nameStatus: null,
              newDisplayName: null,
              newNameStatus: null,
            };
        const nameSync = resolvePhoneNameSync({
          verifiedName: named.verifiedName,
          nameStatus: named.nameStatus,
          newDisplayName: named.newDisplayName || displayName,
          newNameStatus: named.newNameStatus,
          localName: displayName,
        });
        namePending = nameSync.nameSyncStatus === "pending";
        nameNeedsRegister = nameSync.nameNeedsRegister;
      }
    }

    const profileBody: Record<string, unknown> = { messaging_product: "whatsapp" };
    if (vertical) profileBody.vertical = vertical;
    if (description) profileBody.description = description;
    if (address) profileBody.address = address;
    if (email) profileBody.email = email;

    let photoUpdated = false;
    let profileUpdated = false;
    if (photo) {
      const appId = readMetaAppId();
      if (!appId) throw new MetaWhatsappError("config_invalid");
      try {
        const uploaded = await this.uploadImage({
          token,
          appId,
          fileName: photo.fileName,
          mime: photo.mime,
          bytes: photo.bytes,
        });
        const handle = String(uploaded.handle || "").trim();
        if (!handle) throw new Error("upload-handle vazio");
        profileBody.profile_picture_handle = handle;
      } catch (error) {
        if (error instanceof MetaWhatsappError) throw error;
        logMetaWhatsappSafe("phone-profile-failed", {
          tenantId: tenant.tenantId,
          reason: "upload",
          detail: String((error as { message?: string })?.message || "").slice(0, 80),
        });
        // Se o nome já foi aceito, reporta falha só da foto.
        if (nameUpdated) throw new MetaWhatsappError("profile_photo_update_failed");
        if (nameFailure) throw new MetaWhatsappError("profile_update_failed");
        throw new MetaWhatsappError("profile_photo_update_failed");
      }
    }

    if (Object.keys(profileBody).length > 1) {
      const profile = await this.graph({
        token,
        method: "POST",
        path: `${phoneNumberId}/whatsapp_business_profile`,
        body: profileBody,
      });
      if (!profile.ok) {
        logMetaWhatsappSafe("phone-profile-failed", {
          tenantId: tenant.tenantId,
          reason: "profile",
          status: profile.status,
          graphCode: profile.graphCode,
        });
        if (profile.status === 401) throw new MetaWhatsappError("invalid_token");
        if (nameUpdated) throw new MetaWhatsappError("profile_photo_update_failed");
        if (nameFailure) throw new MetaWhatsappError("profile_update_failed");
        throw new MetaWhatsappError(photo ? "profile_photo_update_failed" : "profile_update_failed");
      }
      photoUpdated = Boolean(photo);
      profileUpdated = true;
    }

    writePhoneIdentity(tenant.tenantId, phoneNumberId, {
      name: nameUpdated ? displayName || undefined : undefined,
      channelName: nameUpdated ? displayName || undefined : undefined,
      photo: photoUpdated && photo
        ? { ext: photo.mime.includes("png") ? "png" : "jpg", bytes: photo.bytes }
        : undefined,
      vertical: profileUpdated && vertical !== undefined ? vertical || null : undefined,
      description: profileUpdated && description !== undefined ? description : undefined,
      address: profileUpdated && address !== undefined ? address : undefined,
      email: profileUpdated && email !== undefined ? email || null : undefined,
      ...(photoUpdated ? { photoMetaApplied: true, photoSource: "local-upload" as const } : {}),
      ...(profileUpdated && (vertical || description || address || email)
        ? { profileMetaApplied: true }
        : {}),
    });

    logMetaWhatsappSafe("phone-profile-updated", {
      tenantId: tenant.tenantId,
      namePending,
      nameNeedsRegister,
      nameUpdated,
      photoUpdated,
      profileUpdated,
      nameFailure: nameFailure || null,
    });
    invalidateCachedPortfolioGraph(tenant.tenantId);
    const listed = await this.listPortfolioAssets(auth, { connectionId: open.id, fresh: true });
    // Foto/dados ok + nome recusado: sucesso parcial (não mascara a foto aplicada).
    return {
      ...listed,
      namePending,
      nameNeedsRegister:
        nameNeedsRegister ||
        listed.numbers.some((row) => row.phoneNumberId === phoneNumberId && row.nameNeedsRegister),
      nameUpdated,
      photoUpdated,
      profileUpdated,
      nameRejected: Boolean(nameFailure),
      nameRejectMessage: nameFailure
        ? "A Meta recusou o novo nome de exibição. A foto e os dados da empresa foram enviados."
        : null,
    };
  }

  async readPhonePhotoFromAuth(
    auth: WabaRequestAuth,
    phoneNumberId: string,
  ): Promise<{ mime: string; bytes: Buffer } | null> {
    const tenant = requireTenant(auth);
    const id = String(phoneNumberId || "").trim();
    if (!id) return null;
    return readPhonePhoto(tenant.tenantId, id);
  }

  async setPhoneInboxFromAuth(
    auth: WabaRequestAuth,
    input: {
      phoneNumberId?: string;
      enabled?: boolean;
      displayPhoneNumber?: string;
      channelName?: string;
      connectionId?: string;
    },
  ): Promise<{
    phoneNumberId: string;
    inboxEnabled: boolean;
    displayPhoneNumber: string | null;
    channelName: string | null;
  }> {
    const tenant = requireTenant(auth);
    const phoneNumberId = String(input.phoneNumberId || "").trim();
    if (!phoneNumberId || typeof input.enabled !== "boolean") {
      throw new MetaWhatsappError("invalid_payload");
    }
    const openRows = await this.repository.listOpenByTenant(tenant.tenantId);
    const preferredId = String(input.connectionId || "").trim();
    const open =
      (preferredId ? openRows.find((row) => row.id === preferredId) : undefined) ||
      openRows.find((row) => String(row.phoneNumberId || "").trim() === phoneNumberId) ||
      openRows[0] ||
      null;
    if (!open) throw new MetaWhatsappError("no_pending_connection");
    const current = readPhoneIdentity(tenant.tenantId, phoneNumberId);
    const displayPhoneNumber =
      String(input.displayPhoneNumber || "").trim() ||
      current?.displayPhoneNumber ||
      open.displayPhoneNumber ||
      null;
    const channelName =
      String(input.channelName || "").trim() ||
      current?.channelName ||
      open.verifiedName ||
      null;
    const saved = writePhoneIdentity(tenant.tenantId, phoneNumberId, {
      inboxEnabled: input.enabled,
      displayPhoneNumber,
      channelName,
    });
    logMetaWhatsappSafe("phone-inbox-updated", { tenantId: tenant.tenantId, enabled: input.enabled });
    return {
      phoneNumberId,
      inboxEnabled: input.enabled,
      displayPhoneNumber: saved.displayPhoneNumber,
      channelName: saved.channelName,
    };
  }

  async subscribeWebhooksFromAuth(
    auth: WabaRequestAuth,
    opts?: { connectionId?: string | null; phoneNumberId?: string | null },
  ): Promise<{
    subscribed: boolean;
    alreadySubscribed: boolean;
    detail?: string;
    wabaCount?: number;
  }> {
    const tenant = requireTenant(auth);
    const openRows = await this.repository.listOpenByTenant(tenant.tenantId);
    const targets = pickConnectionsForWebhookSubscribe(openRows, opts);
    if (!targets.length) {
      return {
        subscribed: false,
        alreadySubscribed: false,
        detail: "WABA ainda não confirmada.",
        wabaCount: 0,
      };
    }
    let anyOk = false;
    let allAlready = true;
    const details: string[] = [];
    for (const connection of targets) {
      const result = await this.webhookSubscriptions.ensureSubscribed(connection);
      if (result.ok) anyOk = true;
      if (!result.alreadySubscribed) allAlready = false;
      if (result.detail) details.push(result.detail);
      if (!result.ok) {
        logMetaWhatsappSafe("webhook-subscribe-failed", {
          tenantId: tenant.tenantId,
          connectionId: connection.id,
        });
      }
    }
    return {
      subscribed: anyOk,
      alreadySubscribed: anyOk && allAlready,
      detail: anyOk ? undefined : details[0] || "Falha ao inscrever webhooks.",
      wabaCount: targets.length,
    };
  }


  async readPortfolioPhotoFromAuth(
    auth: WabaRequestAuth,
    businessId?: string,
  ): Promise<{ mime: string; bytes: Buffer } | null> {
    const tenant = requireTenant(auth);
    const biz = String(businessId || "").trim();
    if (biz) return readPortfolioBusinessPhoto(tenant.tenantId, biz);
    return readPortfolioPhoto(tenant.tenantId);
  }

}
