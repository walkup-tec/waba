import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import {
  isMetaTechProviderConfigured,
  readMetaAppId,
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
  mergePortfolioNumbers,
  dedupePortfolioCards,
  businessIdNotWaba,
  isMetaPhoneConnected,
  mapPhoneNameFields,
  resolvePhoneNameSync,
  graphPhotoDownloadUrl,
  graphPhotoSourceKey,
  safePublicPhotoUrl,
  META_PHONE_NUMBER_LIST_FIELDS,
  META_PHONE_NAME_FIELDS,
} from "./meta-whatsapp-portfolio.map";
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
} from "./meta-whatsapp-phone-profile";
import { publishMetaPageProfilePicture, uploadMetaResumableImage } from "./meta-whatsapp-resumable-upload";
import { MetaWhatsappWebhookSubscriptionService } from "./meta-whatsapp-webhook-subscription.service";

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
  const portfolio = assets.portfolio ? localizeCard(assets.portfolio) : null;
  const portfolios = (assets.portfolios || []).map((item) => ({
    ...localizeCard(item),
    numbers: applyLocalPhoneIdentities(tenantId, item.numbers || []),
  }));
  return {
    ...assets,
    portfolios,
    selectedConnectionId: assets.selectedConnectionId ?? null,
    portfolio: portfolio,
    numbers: applyLocalPhoneIdentities(tenantId, assets.numbers || []),
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

async function hydrateOpenConnection(
  graph: MetaConnectionGraphCaller,
  decrypt: (value: string) => string,
  tenantId: string,
  open: MetaWhatsappConnectionRecord,
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

  const storedWaba = String(open.wabaId || "").trim();
  const storedBm = String(open.metaBusinessId || "").trim();
  const wabaLookup = storedWaba || storedBm;
  const waba = wabaLookup ? await fetchWabaOwner(graph, token, wabaLookup) : { hint: { wabaId: null, wabaName: null, businessId: null, businessName: null, primaryPageId: null, primaryPageName: null, profilePictureUrl: null }, json: null, ok: false };
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
    fetchAssignedBusinesses(graph, token),
    resolvedBm
      ? fetchBusinessFromGraph(graph, token, resolvedBm)
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
    card = await fillPageNameById(graph, token, card.id || resolvedBm, card);
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

  const wabaId = resolvedWaba || storedWaba;
  if (!wabaId) return { card, directory };

  const phones = await graph({
    token,
    method: "GET",
    path: `${wabaId}/phone_numbers`,
    query: { fields: META_PHONE_NUMBER_LIST_FIELDS },
  });
  if (!phones.ok) {
    logMetaWhatsappSafe("portfolio-list-partial", {
      tenantId,
      reason: "phones",
      status: phones.status,
      connectionId: open.id,
    });
    return { card, directory };
  }

  const mapped = mapMetaPhoneListToPortfolioNumbers(phones.json);
  const merged = mergePortfolioNumbers(mapped, stored);
  const numbers = await attachPhoneBusinessProfiles(graph, token, merged, tenantId);
  return { card: { ...card, numbers }, directory };
}

async function cacheGraphPhonePhoto(
  tenantId: string,
  phoneNumberId: string,
  url: string | null,
): Promise<string | null> {
  const local = localPhonePhotoUrl(phoneNumberId, readPhoneIdentity(tenantId, phoneNumberId));
  if (process.env.NODE_TEST_CONTEXT) return local;
  if (!url || !/^https:\/\//i.test(url)) return local;
  const identity = readPhoneIdentity(tenantId, phoneNumberId);
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
        canActivate: !isMetaPhoneConnected(row.metaStatus) || nameSync.nameNeedsRegister,
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
    return toMetaWhatsappPublicConnection(connected);
  }

  async listPortfolioAssets(
    auth: WabaRequestAuth,
    opts?: { connectionId?: string },
  ): Promise<MetaPortfolioAssetsPublic> {
    const tenant = requireTenant(auth);
    const repo = this.repository as MetaWhatsappConnectionRepository;
    const rows =
      typeof repo.listOpenByTenant === "function"
        ? await repo.listOpenByTenant(tenant.tenantId)
        : [await this.repository.findOpenByTenant(tenant.tenantId)].filter(
            (item): item is MetaWhatsappConnectionRecord => Boolean(item),
          );
    if (!rows.length) {
      return withLocalIdentities(tenant.tenantId, {
        portfolios: [],
        selectedConnectionId: null,
        portfolio: null,
        numbers: [],
      });
    }

    const requested = String(opts?.connectionId || "").trim();
    const hydrated = await Promise.all(
      rows.map((row) => hydrateOpenConnection(this.graph, this.decrypt, tenant.tenantId, row)),
    );
    const cards = dedupePortfolioCards(hydrated.map((item) => item.card));
    const selected =
      cards.find((item) => item.connectionId === requested) ||
      cards.find((item) => item.id && item.id === String(opts?.connectionId || "").trim()) ||
      cards[0];
    const selectedNumbers = selected?.numbers || [];
    logMetaWhatsappSafe("portfolio-listed", {
      tenantId: tenant.tenantId,
      hasBusiness: Boolean(selected?.id),
      numbers: selectedNumbers.length,
    });
    return withLocalIdentities(tenant.tenantId, {
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
    });
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

    let token = "";
    try {
      token = this.decrypt(open.accessTokenEncrypted);
    } catch {
      logMetaWhatsappSafe("phone-register-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
      throw new MetaWhatsappError("invalid_token");
    }

    const registered = await this.graph({
      token,
      method: "POST",
      path: `${phoneNumberId}/register`,
      body: { messaging_product: "whatsapp", pin },
    });
    if (!registered.ok) {
      logMetaWhatsappSafe("phone-register-failed", {
        tenantId: tenant.tenantId,
        reason: "graph",
        status: registered.status,
      });
      if (registered.status === 401) throw new MetaWhatsappError("invalid_token");
      throw new MetaWhatsappError("register_failed");
    }

    logMetaWhatsappSafe("phone-registered", {
      tenantId: tenant.tenantId,
      connectionId: open.id,
    });

    if (open.wabaId && open.phoneNumberId && open.status !== "connected" && rows[0]?.id === open.id) {
      try {
        await this.confirmFromAuth(auth);
      } catch {
        logMetaWhatsappSafe("phone-register-confirm-skip", { tenantId: tenant.tenantId });
      }
    }

    return this.listPortfolioAssets(auth);
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
