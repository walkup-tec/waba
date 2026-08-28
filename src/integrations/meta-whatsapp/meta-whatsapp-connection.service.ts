import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import {
  isMetaTechProviderConfigured,
  readMetaAppId,
  readMetaBusinessId,
  readMetaConfigId,
  readMetaGraphVersion,
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
import type { MetaPortfolioAssetsPublic, MetaPortfolioNumberPublic } from "./meta-whatsapp-portfolio.types";
import {
  mapMetaBusinessToPortfolio,
  mapMetaPhoneListToPortfolioNumbers,
  firstOwnedPageId,
  isMetaPhoneConnected,
} from "./meta-whatsapp-portfolio.map";
import {
  applyLocalPortfolioIdentity,
  readPortfolioPhoto,
  writePortfolioIdentity,
} from "./meta-whatsapp-portfolio-identity.store";
import {
  applyLocalPhoneIdentities,
  readPhonePhoto,
  writePhoneIdentity,
} from "./meta-whatsapp-phone-identity.store";
import {
  parseDisplayName,
  parseProfilePhoto,
  parseDescription,
  parseAddress,
  parseEmail,
  parseVertical,
  mapWhatsappBusinessProfile,
} from "./meta-whatsapp-phone-profile";
import { publishMetaPageProfilePicture, uploadMetaResumableImage } from "./meta-whatsapp-resumable-upload";

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
  return {
    portfolio: assets.portfolio ? applyLocalPortfolioIdentity(tenantId, assets.portfolio) : null,
    numbers: applyLocalPhoneIdentities(tenantId, assets.numbers || []),
  };
}

async function attachPhoneBusinessProfiles(
  graph: MetaConnectionGraphCaller,
  token: string,
  numbers: MetaPortfolioNumberPublic[],
): Promise<MetaPortfolioNumberPublic[]> {
  if (!numbers.length) return numbers;
  const limited = numbers.slice(0, 20);
  const rest = numbers.slice(20);
  const withProfiles = await Promise.all(
    limited.map(async (row) => {
      const profile = await graph({
        token,
        method: "GET",
        path: `${row.phoneNumberId}/whatsapp_business_profile`,
        query: { fields: "about,address,description,email,profile_picture_url,vertical" },
      });
      if (!profile.ok) return row;
      const mapped = mapWhatsappBusinessProfile(profile.json);
      return {
        ...row,
        profilePictureUrl: mapped.profilePictureUrl || row.profilePictureUrl,
        vertical: mapped.vertical,
        description: mapped.description,
        address: mapped.address,
        email: mapped.email,
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

export class MetaWhatsappConnectionService {
  constructor(
    private readonly repository = new MetaWhatsappConnectionRepository(),
    private readonly oauth: MetaWhatsappOauthPort = { exchangeEmbeddedSignupCode },
    private readonly graph: MetaConnectionGraphCaller = (input) => callMetaGraphJson(input),
    private readonly decrypt = decryptMetaToken,
    private readonly uploadImage = uploadMetaResumableImage,
    private readonly setPagePicture = publishMetaPageProfilePicture,
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
      graphVersion: readMetaGraphVersion(),
      callbackPath: "/integrations/meta/whatsapp/callback",
    };
  }

  async getPublicStatus(auth: WabaRequestAuth): Promise<MetaWhatsappPublicConnection> {
    const tenant = requireTenant(auth);
    const row = await this.repository.findOpenByTenant(tenant.tenantId);
    return toMetaWhatsappPublicConnection(row);
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
        metaBusinessId: readMetaBusinessId() || null,
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
    const open = await this.repository.findOpenByTenant(tenant.tenantId);
    if (!open) {
      throw new MetaWhatsappError("no_pending_connection");
    }
    const wabaId = String(open.wabaId || input.wabaId || "").trim();
    const phoneNumberId = String(open.phoneNumberId || input.phoneNumberId || "").trim();
    const businessId = String(open.metaBusinessId || input.businessId || "").trim();
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

  async listPortfolioAssets(auth: WabaRequestAuth): Promise<MetaPortfolioAssetsPublic> {
    const tenant = requireTenant(auth);
    const open = await this.repository.findOpenByTenant(tenant.tenantId);
    if (!open) {
      return withLocalIdentities(tenant.tenantId, { portfolio: null, numbers: [] });
    }

    const fallbackPortfolio = mapMetaBusinessToPortfolio(
      { id: open.metaBusinessId, name: null, primary_page: null },
      { id: open.metaBusinessId, wabaId: open.wabaId },
    );

    let token = "";
    try {
      token = this.decrypt(open.accessTokenEncrypted);
    } catch {
      logMetaWhatsappSafe("portfolio-list-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
      throw new MetaWhatsappError("invalid_token");
    }

    let portfolio = fallbackPortfolio;
    const businessId = String(open.metaBusinessId || "").trim();
    if (businessId) {
      const identity = { id: open.metaBusinessId, wabaId: open.wabaId };
      const business = await this.graph({
        token,
        method: "GET",
        path: businessId,
        query: {
          fields: "id,name,profile_picture_uri,primary_page{id,name,picture}",
        },
      });
      if (business.ok) {
        portfolio = mapMetaBusinessToPortfolio(business.json, identity);
      } else if (business.status === 401) {
        logMetaWhatsappSafe("portfolio-list-failed", { tenantId: tenant.tenantId, reason: "business" });
        throw new MetaWhatsappError("invalid_token");
      } else {
        const fallbackBusiness = await this.graph({
          token,
          method: "GET",
          path: businessId,
          query: { fields: "id,name,primary_page{id,name}" },
        });
        if (fallbackBusiness.ok) {
          portfolio = mapMetaBusinessToPortfolio(fallbackBusiness.json, identity);
        } else if (fallbackBusiness.status === 401) {
          logMetaWhatsappSafe("portfolio-list-failed", { tenantId: tenant.tenantId, reason: "business" });
          throw new MetaWhatsappError("invalid_token");
        } else {
          logMetaWhatsappSafe("portfolio-list-partial", {
            tenantId: tenant.tenantId,
            reason: "business",
            status: business.status,
          });
        }
      }
    }

    const wabaId = String(open.wabaId || "").trim();
    if (!wabaId) {
      return withLocalIdentities(tenant.tenantId, {
        portfolio: portfolio.id ? portfolio : null,
        numbers: [],
      });
    }

    const phones = await this.graph({
      token,
      method: "GET",
      path: `${wabaId}/phone_numbers`,
      query: {
        fields: "id,display_phone_number,verified_name,quality_rating,status,code_verification_status",
      },
    });
    if (!phones.ok) {
      logMetaWhatsappSafe("portfolio-list-failed", {
        tenantId: tenant.tenantId,
        reason: "phones",
        status: phones.status,
      });
      if (phones.status === 401) throw new MetaWhatsappError("invalid_token");
      return withLocalIdentities(tenant.tenantId, {
        portfolio: portfolio.id ? portfolio : null,
        numbers: [],
      });
    }

    const numbers = await attachPhoneBusinessProfiles(
      this.graph,
      token,
      mapMetaPhoneListToPortfolioNumbers(phones.json),
    );
    logMetaWhatsappSafe("portfolio-listed", {
      tenantId: tenant.tenantId,
      hasBusiness: Boolean(portfolio.id),
      numbers: numbers.length,
    });
    return withLocalIdentities(tenant.tenantId, {
      portfolio: portfolio.id ? portfolio : null,
      numbers,
    });
  }

  async registerPhoneFromAuth(
    auth: WabaRequestAuth,
    input: { phoneNumberId?: string; pin?: string },
  ): Promise<MetaPortfolioAssetsPublic> {
    const tenant = requireTenant(auth);
    const open = await this.repository.findOpenByTenant(tenant.tenantId);
    if (!open) throw new MetaWhatsappError("no_pending_connection");

    const phoneNumberId = String(input.phoneNumberId || open.phoneNumberId || "").trim();
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

    if (open.wabaId && open.phoneNumberId && open.status !== "connected") {
      try {
        await this.confirmFromAuth(auth);
      } catch {
        logMetaWhatsappSafe("phone-register-confirm-skip", { tenantId: tenant.tenantId });
      }
    }

    return this.listPortfolioAssets(auth);
  }

  async updatePhoneProfileFromAuth(
    auth: WabaRequestAuth,
    input: {
      phoneNumberId?: string;
      displayName?: string;
      photoBase64?: string;
      photoMime?: string;
      vertical?: string;
      description?: string;
      address?: string;
      email?: string;
    },
  ): Promise<
    MetaPortfolioAssetsPublic & {
      namePending: boolean;
      nameUpdated: boolean;
      photoUpdated: boolean;
      profileUpdated: boolean;
      warning?: string;
    }
  > {
    const tenant = requireTenant(auth);
    const phoneNumberId = String(input.phoneNumberId || "").trim();
    const displayName = parseDisplayName(input.displayName);
    const photo = parseProfilePhoto({ photoBase64: input.photoBase64, photoMime: input.photoMime });
    const vertical = parseVertical(input.vertical);
    const description = parseDescription(input.description);
    const address = parseAddress(input.address);
    const email = parseEmail(input.email);
    if (vertical === null || description === null || address === null || email === null) {
      throw new MetaWhatsappError("invalid_payload");
    }
    const hasBiz =
      vertical !== undefined || description !== undefined || address !== undefined || email !== undefined;
    if (!phoneNumberId || (!displayName && !photo && !hasBiz)) {
      throw new MetaWhatsappError("invalid_payload");
    }

    const assets = await this.listPortfolioAssets(auth);
    const numberRow = assets.numbers.find((row) => row.phoneNumberId === phoneNumberId);
    if (!numberRow) {
      throw new MetaWhatsappError("invalid_payload");
    }

    const open = await this.repository.findOpenByTenant(tenant.tenantId);
    if (!open) throw new MetaWhatsappError("no_pending_connection");

    let token = "";
    try {
      token = this.decrypt(open.accessTokenEncrypted);
    } catch {
      logMetaWhatsappSafe("phone-profile-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
      throw new MetaWhatsappError("invalid_token");
    }

    const connected = isMetaPhoneConnected(numberRow.metaStatus);
    if (!connected) {
      logMetaWhatsappSafe("phone-profile-failed", {
        tenantId: tenant.tenantId,
        reason: "not_registered",
      });
      throw new MetaWhatsappError("phone_not_registered");
    }

    let namePending = false;
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
        if (renamed.status === 401) throw new MetaWhatsappError("invalid_token");
        throw new MetaWhatsappError("profile_update_failed");
      }
      namePending = true;
    }

    const profileBody: Record<string, unknown> = { messaging_product: "whatsapp" };
    if (vertical) profileBody.vertical = vertical;
    if (description) profileBody.description = description;
    if (address) profileBody.address = address;
    if (email) profileBody.email = email;

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
        throw new MetaWhatsappError("profile_update_failed");
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
        throw new MetaWhatsappError("profile_update_failed");
      }
    }

    writePhoneIdentity(tenant.tenantId, phoneNumberId, {
      name: displayName || undefined,
      photo: photo
        ? { ext: photo.mime.includes("png") ? "png" : "jpg", bytes: photo.bytes }
        : undefined,
      vertical: vertical !== undefined ? vertical || null : undefined,
      description: description !== undefined ? description : undefined,
      address: address !== undefined ? address : undefined,
      email: email !== undefined ? email || null : undefined,
      ...(profileBody.profile_picture_handle ? { photoMetaApplied: true } : {}),
      ...(vertical || description || address || email ? { profileMetaApplied: true } : {}),
    });
    const nameUpdated = Boolean(displayName);
    const photoUpdated = Boolean(photo);
    const profileUpdated = hasBiz || photoUpdated;

    logMetaWhatsappSafe("phone-profile-updated", {
      tenantId: tenant.tenantId,
      namePending,
      nameUpdated,
      photoUpdated,
      profileUpdated,
      metaWarning: false,
    });
    const listed = await this.listPortfolioAssets(auth);
    return {
      ...listed,
      namePending,
      nameUpdated,
      photoUpdated,
      profileUpdated,
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
    input: { phoneNumberId?: string; enabled?: boolean },
  ): Promise<MetaPortfolioAssetsPublic> {
    const tenant = requireTenant(auth);
    const phoneNumberId = String(input.phoneNumberId || "").trim();
    if (!phoneNumberId || typeof input.enabled !== "boolean") {
      throw new MetaWhatsappError("invalid_payload");
    }
    const assets = await this.listPortfolioAssets(auth);
    const numberRow = assets.numbers.find((row) => row.phoneNumberId === phoneNumberId);
    if (!numberRow) throw new MetaWhatsappError("invalid_payload");
    writePhoneIdentity(tenant.tenantId, phoneNumberId, {
      inboxEnabled: input.enabled,
      displayPhoneNumber: numberRow.displayPhoneNumber,
      channelName: numberRow.verifiedName || numberRow.requestedName,
    });
    logMetaWhatsappSafe("phone-inbox-updated", { tenantId: tenant.tenantId, enabled: input.enabled });
    return this.listPortfolioAssets(auth);
  }

  async updatePortfolioFromAuth(
    auth: WabaRequestAuth,
    input: { displayName?: string; photoBase64?: string; photoMime?: string },
  ): Promise<
    MetaPortfolioAssetsPublic & { nameUpdated: boolean; photoUpdated: boolean; warning?: string }
  > {
    const tenant = requireTenant(auth);
    const displayName = parseDisplayName(input.displayName);
    const photo = parseProfilePhoto({ photoBase64: input.photoBase64, photoMime: input.photoMime });
    if (!displayName && !photo) {
      throw new MetaWhatsappError("invalid_payload");
    }

    const open = await this.repository.findOpenByTenant(tenant.tenantId);
    if (!open) throw new MetaWhatsappError("no_pending_connection");
    const businessId = String(open.metaBusinessId || "").trim();
    if (!businessId) throw new MetaWhatsappError("invalid_payload");

    let token = "";
    try {
      token = this.decrypt(open.accessTokenEncrypted);
    } catch {
      logMetaWhatsappSafe("portfolio-profile-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
      throw new MetaWhatsappError("invalid_token");
    }

    writePortfolioIdentity(tenant.tenantId, {
      name: displayName || undefined,
      photo: photo
        ? { ext: photo.mime.includes("png") ? "png" : "jpg", bytes: photo.bytes }
        : undefined,
    });
    const nameUpdated = Boolean(displayName);
    const photoUpdated = Boolean(photo);
    const warnings: string[] = [];

    if (displayName) {
      const renamed = await this.graph({
        token,
        method: "POST",
        path: businessId,
        body: { name: displayName },
      });
      if (!renamed.ok) {
        logMetaWhatsappSafe("portfolio-profile-failed", {
          tenantId: tenant.tenantId,
          reason: "name",
          status: renamed.status,
          graphCode: renamed.graphCode,
        });
        if (renamed.status === 401) throw new MetaWhatsappError("invalid_token");
        warnings.push("A Meta não aceitou o nome neste token.");
      }
    }

    if (photo) {
      const business = await this.graph({
        token,
        method: "GET",
        path: businessId,
        query: { fields: "id,primary_page{id,name}" },
      });
      const page =
        business.ok && business.json && typeof business.json === "object"
          ? (business.json as { primary_page?: { id?: unknown } }).primary_page
          : undefined;
      let pageId = String(page?.id || "").trim();
      if (!pageId) {
        const pages = await this.graph({
          token,
          method: "GET",
          path: `${businessId}/owned_pages`,
          query: { fields: "id,name" },
        });
        pageId = firstOwnedPageId(pages.json) || "";
      }
      if (!pageId) {
        logMetaWhatsappSafe("portfolio-profile-failed", {
          tenantId: tenant.tenantId,
          reason: "no_page",
        });
        warnings.push("A Meta não grava a foto do Business sem uma Página.");
      } else {
        try {
          await this.setPagePicture({
            token,
            pageId,
            fileName: photo.fileName,
            mime: photo.mime,
            bytes: photo.bytes,
          });
        } catch (error) {
          logMetaWhatsappSafe("portfolio-profile-failed", {
            tenantId: tenant.tenantId,
            reason: "photo",
            target: pageId,
            detail: String((error as { message?: string })?.message || "").slice(0, 80),
          });
          warnings.push("A Meta não aplicou a foto na Página.");
        }
      }
    }

    logMetaWhatsappSafe("portfolio-profile-updated", {
      tenantId: tenant.tenantId,
      nameUpdated,
      photoUpdated,
      metaWarning: Boolean(warnings.length),
    });
    const listed = await this.listPortfolioAssets(auth);
    const warning = warnings.join(" ").trim();
    return { ...listed, nameUpdated, photoUpdated, ...(warning ? { warning } : {}) };
  }

  async readPortfolioPhotoFromAuth(auth: WabaRequestAuth): Promise<{ mime: string; bytes: Buffer } | null> {
    const tenant = requireTenant(auth);
    return readPortfolioPhoto(tenant.tenantId);
  }

}
