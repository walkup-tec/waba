import assert from "node:assert/strict";
import { describe, it, before, after, afterEach } from "node:test";
import { randomBytes } from "node:crypto";
import { MetaWhatsappConnectionService } from "./meta-whatsapp-connection.service";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import {
  mapMetaBusinessToPortfolio,
  mapMetaPhoneListToPortfolioNumbers,
  mapMetaPhoneToPortfolioNumber,
  resolvePhoneNameSync,
  META_PHONE_NUMBER_LIST_FIELDS,
} from "./meta-whatsapp-portfolio.map";
import { encryptMetaToken, decryptMetaToken } from "./meta-token-crypto";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { parseDisplayName, parseProfilePhoto, parseVertical, parseDescription, parseEmail, mapWhatsappBusinessProfile, fetchHttpsProfileImage } from "./meta-whatsapp-phone-profile";
import { callMetaGraphJson } from "./meta-whatsapp-graph.client";
import { purgePortfolioIdentity } from "./meta-whatsapp-portfolio-identity.store";
import { applyLocalPhoneIdentities, listPhoneInboxChannels, purgePhoneIdentities, writePhoneIdentity } from "./meta-whatsapp-phone-identity.store";

describe("meta portfolio mapper", () => {
  it("mapeia card do portfólio sem vazar token", () => {
    const portfolio = mapMetaBusinessToPortfolio(
      {
        id: "1247508354180311",
        name: "Grupo Walkup",
        primary_page: { id: "page-1", name: "Soma Promotora" },
        access_token: "EAABsecret",
      },
      { wabaId: "waba-1" },
    );
    const json = JSON.stringify(portfolio);
    assert.equal(portfolio.id, "1247508354180311");
    assert.equal(portfolio.name, "Grupo Walkup");
    assert.equal(portfolio.primaryPageName, "Soma Promotora");
    assert.equal(portfolio.primaryPageId, "page-1");
    assert.equal(portfolio.profilePictureUrl, null);
    assert.equal(portfolio.wabaId, "waba-1");
    assert.doesNotMatch(json, /EAABsecret|access_token/);
  });

  it("usa a foto do Business e ignora URL insegura", () => {
    const withPhoto = mapMetaBusinessToPortfolio(
      {
        id: "1041827648719609",
        name: "Portfólio empresarial",
        profile_picture_uri: "https://scontent.xx.fbcdn.net/v/portfolio.jpg",
        primary_page: {
          picture: { data: { url: "https://scontent.xx.fbcdn.net/v/page.jpg", is_silhouette: false } },
        },
      },
      {},
    );
    assert.equal(withPhoto.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/portfolio.jpg");

    const fromPage = mapMetaBusinessToPortfolio(
      {
        id: "1",
        primary_page: {
          picture: { data: { url: "https://scontent.xx.fbcdn.net/v/page.jpg", is_silhouette: false } },
        },
      },
      {},
    );
    assert.equal(fromPage.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/page.jpg");

    const silhouette = mapMetaBusinessToPortfolio(
      {
        id: "1",
        primary_page: {
          picture: { data: { url: "https://scontent.xx.fbcdn.net/v/empty.jpg", is_silhouette: true } },
        },
      },
      {},
    );
    assert.equal(silhouette.profilePictureUrl, null);

    const unsafe = mapMetaBusinessToPortfolio(
      { id: "1", profile_picture_uri: "javascript:alert(1)" },
      {},
    );
    assert.equal(unsafe.profilePictureUrl, null);
  });

  it("CONNECTED fica ativo e livre até haver disparo", () => {
    const row = mapMetaPhoneToPortfolioNumber({
      id: "phone-1",
      display_phone_number: "+55 51 8200-1279",
      verified_name: "Walkup",
      status: "CONNECTED",
      code_verification_status: "VERIFIED",
    });
    assert.equal(row?.uiStatus, "ativo");
    assert.equal(row?.dispatchStatus, "livre");
    assert.equal(row?.canActivate, false);
    assert.equal(row?.nameNeedsRegister, false);
    assert.equal(row?.nameSyncStatus, "applied");
    assert.equal(row?.photoSyncStatus, null);
    assert.equal(row?.profileSyncStatus, null);
    assert.equal(row?.inboxEnabled, false);
  });

  it("PENDING fica pendente e pode ativar", () => {
    const row = mapMetaPhoneToPortfolioNumber({
      id: "phone-2",
      display_phone_number: "+55 51 90000-0000",
      status: "PENDING",
      code_verification_status: "VERIFIED",
    });
    assert.equal(row?.uiStatus, "pendente");
    assert.equal(row?.canActivate, true);
  });

  it("lê new_display_name e exige PIN quando a Meta já aprovou", () => {
    const pending = mapMetaPhoneToPortfolioNumber({
      id: "phone-1",
      verified_name: "Mms Marketing E Sistemas Digitais Ltda",
      status: "CONNECTED",
      new_display_name: "Drax Sistema",
      new_name_status: "PENDING_REVIEW",
    });
    assert.equal(pending?.verifiedName, "Mms Marketing E Sistemas Digitais Ltda");
    assert.equal(pending?.requestedName, "Drax Sistema");
    assert.equal(pending?.nameSyncStatus, "pending");
    assert.equal(pending?.nameNeedsRegister, false);
    assert.equal(pending?.canActivate, false);

    const ready = mapMetaPhoneToPortfolioNumber({
      id: "phone-1",
      verified_name: "Mms Marketing E Sistemas Digitais Ltda",
      status: "CONNECTED",
      new_display_name: "Drax Sistema",
      new_name_status: "AVAILABLE_WITHOUT_REVIEW",
    });
    assert.equal(ready?.nameSyncStatus, "ready");
    assert.equal(ready?.nameNeedsRegister, true);
    assert.equal(ready?.canActivate, true);
    assert.equal(ready?.requestedName, "Drax Sistema");

    assert.equal(
      resolvePhoneNameSync({
        verifiedName: "Drax Sistema",
        newDisplayName: "Drax Sistema",
        newNameStatus: "APPROVED",
      }).nameSyncStatus,
      "applied",
    );
    assert.equal(
      resolvePhoneNameSync({
        verifiedName: "Antigo",
        newDisplayName: "Novo",
        newNameStatus: "DECLINED",
      }).nameSyncStatus,
      "declined",
    );
  });

  it("marca em_disparo só quando o id está ocupado", () => {
    const rows = mapMetaPhoneListToPortfolioNumbers(
      {
        data: [
          { id: "phone-1", status: "CONNECTED" },
          { id: "phone-2", status: "CONNECTED" },
        ],
      },
      new Set(["phone-2"]),
    );
    assert.equal(rows[0].dispatchStatus, "livre");
    assert.equal(rows[1].dispatchStatus, "em_disparo");
  });

  it("valida nome e foto do perfil do número", () => {
    assert.equal(parseDisplayName("So"), null);
    assert.equal(parseDisplayName("Soma Promotora"), "Soma Promotora");
    assert.equal(parseProfilePhoto({ photoBase64: "abc", photoMime: "image/gif" }), null);
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    assert.equal(parseProfilePhoto({ photoBase64: png, photoMime: "image/png" })?.mime, "image/png");
    assert.equal(parseVertical("OTHER"), "OTHER");
    assert.equal(parseVertical("nope"), null);
    assert.equal(parseDescription("a".repeat(513)), null);
    assert.equal(parseEmail("nao-email"), null);
    assert.equal(parseEmail("contato@drax.com"), "contato@drax.com");
  });

  it("mapeia o perfil comercial do WhatsApp", () => {
    const mapped = mapWhatsappBusinessProfile({
      data: [
        {
          profile_picture_url: "https://pps.whatsapp.net/v/pic.jpg",
          vertical: "OTHER",
          description: "Empresa de sistemas",
          address: "Rua 1",
          email: "contato@drax.com",
        },
      ],
    });
    assert.equal(mapped.profilePictureUrl, "https://pps.whatsapp.net/v/pic.jpg");
    assert.equal(mapped.vertical, "OTHER");
    assert.equal(mapped.description, "Empresa de sistemas");
    assert.equal(mapped.address, "Rua 1");
    assert.equal(mapped.email, "contato@drax.com");
  });

  it("marca sincronização pendente até a Meta refletir nome e foto", () => {
    const tenantId = deriveStableMetaTenantId("sync-card@exemplo.com");
    purgePhoneIdentities(tenantId);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    writePhoneIdentity(tenantId, "phone-1", {
      name: "Drax",
      photo: { ext: "png", bytes: png },
    });
    const pending = applyLocalPhoneIdentities(tenantId, [
      {
        phoneNumberId: "phone-1",
        displayPhoneNumber: "+55 51 8200-1279",
        verifiedName: "Mms Marketing E Sistemas Digitais Ltda",
        qualityRating: null,
        metaStatus: "CONNECTED",
        codeVerificationStatus: "VERIFIED",
        uiStatus: "ativo",
        dispatchStatus: "livre",
        canActivate: false,
        nameNeedsRegister: false,
        nameStatus: null,
        newDisplayName: null,
        newNameStatus: "PENDING_REVIEW",
        profilePictureUrl: null,
        vertical: null,
        description: null,
        address: null,
        email: null,
        requestedName: null,
        nameSyncStatus: null,
        photoSyncStatus: null,
        profileSyncStatus: null,
        inboxEnabled: true,
      },
    ]);
    assert.equal(pending[0]?.verifiedName, "Mms Marketing E Sistemas Digitais Ltda");
    assert.equal(pending[0]?.requestedName, "Drax");
    assert.equal(pending[0]?.nameSyncStatus, "pending");
    assert.equal(pending[0]?.photoSyncStatus, "pending");
    assert.match(String(pending[0]?.profilePictureUrl || ""), /\/integrations\/meta\/whatsapp\/phone-numbers\/photo/);
    assert.equal(pending[0]?.inboxEnabled, false);

    writePhoneIdentity(tenantId, "phone-1", { inboxEnabled: false });
    assert.equal(applyLocalPhoneIdentities(tenantId, pending)[0]?.inboxEnabled, false);

    writePhoneIdentity(tenantId, "phone-1", { photoMetaApplied: true, profileMetaApplied: true, inboxEnabled: true });
    const posted = applyLocalPhoneIdentities(tenantId, [
      {
        ...pending[0],
        verifiedName: "Mms Marketing E Sistemas Digitais Ltda",
        profilePictureUrl: null,
        nameSyncStatus: null,
        photoSyncStatus: null,
        profileSyncStatus: null,
        inboxEnabled: true,
      },
    ]);
    assert.equal(posted[0]?.photoSyncStatus, "applied");
    assert.equal(posted[0]?.nameSyncStatus, "pending");
    assert.match(String(posted[0]?.profilePictureUrl || ""), /\/integrations\/meta\/whatsapp\/phone-numbers\/photo/);

    const applied = applyLocalPhoneIdentities(tenantId, [
      {
        ...pending[0],
        verifiedName: "Drax",
        profilePictureUrl: "https://pps.whatsapp.net/v/pic.jpg",
        nameSyncStatus: null,
        photoSyncStatus: null,
        profileSyncStatus: null,
        inboxEnabled: true,
      },
    ]);
    assert.equal(applied[0]?.nameSyncStatus, "applied");
    assert.equal(applied[0]?.photoSyncStatus, "applied");
    assert.match(String(applied[0]?.profilePictureUrl || ""), /\/integrations\/meta\/whatsapp\/phone-numbers\/photo/);
    purgePhoneIdentities(tenantId);
  });
});

describe("meta portfolio service", () => {
  const previous = {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    configId: process.env.META_CONFIG_ID,
    enc: process.env.META_TOKEN_ENCRYPTION_KEY,
  };
  const auth: WabaRequestAuth = { email: "portfolio@exemplo.com", role: "subscriber" };
  const tenantId = deriveStableMetaTenantId("portfolio@exemplo.com");

  before(() => {
    process.env.META_APP_ID = "1279182514183979";
    process.env.META_APP_SECRET = "test-app-secret";
    process.env.META_CONFIG_ID = "1467449278208212";
    process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  });

  after(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore("META_APP_ID", previous.appId);
    restore("META_APP_SECRET", previous.appSecret);
    restore("META_CONFIG_ID", previous.configId);
    restore("META_TOKEN_ENCRYPTION_KEY", previous.enc);
    purgePortfolioIdentity(tenantId);
    purgePhoneIdentities(tenantId);
  });

  afterEach(() => {
    purgePortfolioIdentity(tenantId);
    purgePhoneIdentities(tenantId);
  });

  function connectedRow(): MetaWhatsappConnectionRecord {
    return {
      id: "conn-1",
      tenantId,
      ownerEmail: "portfolio@exemplo.com",
      metaBusinessId: "1247508354180311",
      wabaId: "waba-1",
      phoneNumberId: "phone-1",
      displayPhoneNumber: "+55 51 8200-1279",
      verifiedName: "Walkup",
      accessTokenEncrypted: encryptMetaToken("EAAB-secret-token"),
      tokenType: "bearer",
      tokenExpiresAt: null,
      configId: "cfg",
      status: "pending_confirmation",
      qualityRating: null,
      messagingLimit: null,
      lastTokenValidationAt: null,
      lastWebhookAt: null,
      lastError: null,
      createdBy: "portfolio@exemplo.com",
      updatedBy: "portfolio@exemplo.com",
      createdAt: "",
      updatedAt: "",
      connectedAt: null,
      disconnectedAt: null,
    };
  }

  it("lista portfólio e números sem token na resposta", async () => {
    const repo = {
      async findOpenByTenant() {
        return connectedRow();
      },
    };
    const graphCalls: string[] = [];
    const graphFields: string[] = [];
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      graphCalls.push(input.path);
      if (input.query?.fields) graphFields.push(input.query.fields);
      if (input.path === "1247508354180311") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1247508354180311",
            name: "Grupo Walkup",
            profile_picture_uri: "https://scontent.xx.fbcdn.net/v/walkup.png",
            primary_page: { name: "Soma Promotora" },
          },
        };
      }
      return {
        ok: true,
        status: 200,
        json: {
          data: [
            {
              id: "phone-1",
              display_phone_number: "+55 51 8200-1279",
              verified_name: "Walkup",
              status: "PENDING",
              code_verification_status: "VERIFIED",
            },
          ],
        },
      };
    };
    const service = new MetaWhatsappConnectionService(repo as any, { exchangeEmbeddedSignupCode: async () => ({
      accessToken: "x",
      tokenType: "bearer",
      expiresIn: 1,
    }) }, graph as any);
    const assets = await service.listPortfolioAssets(auth);
    const json = JSON.stringify(assets);
    assert.equal(assets.portfolio?.name, "Grupo Walkup");
    assert.equal(assets.portfolio?.primaryPageName, "Soma Promotora");
    assert.equal(assets.portfolio?.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/walkup.png");
    assert.match(graphFields[0] || "", /profile_picture_uri/);
    assert.match(graphFields[1] || "", /new_display_name/);
    assert.equal(graphFields[1], META_PHONE_NUMBER_LIST_FIELDS);
    assert.equal(assets.numbers.length, 1);
    assert.equal(assets.numbers[0].uiStatus, "pendente");
    assert.equal(assets.numbers[0].dispatchStatus, "livre");
    assert.doesNotMatch(json, /EAAB-secret-token|access_token|accessToken/);
    assert.deepEqual(graphCalls, [
      "1247508354180311",
      "waba-1/phone_numbers",
      "phone-1",
      "phone-1/whatsapp_business_profile",
    ]);
  });

  it("ativa número com PIN de 6 dígitos", async () => {
    const repo = {
      async findOpenByTenant() {
        return connectedRow();
      },
    };
    const posts: Array<{ path: string; body?: Record<string, unknown> }> = [];
    const graph = async (input: { path: string; method: string; body?: Record<string, unknown> }) => {
      if (input.method === "POST") {
        posts.push({ path: input.path, body: input.body });
        return { ok: true, status: 200, json: { success: true } };
      }
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
      }
      if (input.path === "waba-1") {
        return { ok: true, status: 200, json: { id: "waba-1" } };
      }
      if (input.path === "phone-1") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "phone-1",
            display_phone_number: "+55 51 8200-1279",
            verified_name: "Walkup",
            whatsapp_business_account: { id: "waba-1" },
          },
        };
      }
      return {
        ok: true,
        status: 200,
        json: {
          data: [{ id: "phone-1", status: "CONNECTED", display_phone_number: "+55 51 8200-1279" }],
        },
      };
    };
    const service = new MetaWhatsappConnectionService(
      {
        ...repo,
        async markConnected() {
          const row = connectedRow();
          row.status = "connected";
          return row;
        },
      } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.registerPhoneFromAuth(auth, { phoneNumberId: "phone-1", pin: "482917" });
    assert.equal(posts[0]?.path, "phone-1/register");
    assert.equal(posts[0]?.body?.pin, "482917");
    assert.equal(assets.numbers[0].uiStatus, "ativo");
  });

  it("rejeita PIN inválido sem chamar a Meta", async () => {
    let graphCalls = 0;
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      (async () => {
        graphCalls += 1;
        return { ok: true, status: 200, json: {} };
      }) as any,
    );
    await assert.rejects(
      () => service.registerPhoneFromAuth(auth, { phoneNumberId: "phone-1", pin: "12" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "invalid_pin",
    );
    assert.equal(graphCalls, 0);
  });

  it("liga o Inbox sem consultar a Graph", async () => {
    let graphCalls = 0;
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      (async () => {
        graphCalls += 1;
        return { ok: true, status: 200, json: {} };
      }) as any,
    );
    const result = await service.setPhoneInboxFromAuth(auth, {
      phoneNumberId: "phone-1",
      enabled: true,
      displayPhoneNumber: "+55 51 8200-1279",
      channelName: "Drax Sistema",
    });
    assert.equal(result.inboxEnabled, true);
    assert.equal(result.phoneNumberId, "phone-1");
    assert.equal(result.displayPhoneNumber, "+55 51 8200-1279");
    assert.equal(result.channelName, "Drax Sistema");
    assert.equal(graphCalls, 0);
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.displayPhoneNumber, "+55 51 8200-1279");
    assert.equal(applyLocalPhoneIdentities(tenantId, [{
      phoneNumberId: "phone-1",
      displayPhoneNumber: "+55 51 8200-1279",
      verifiedName: "Walkup",
      qualityRating: null,
      metaStatus: "CONNECTED",
      codeVerificationStatus: "VERIFIED",
      uiStatus: "ativo",
      dispatchStatus: "livre",
      canActivate: false,
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
      inboxEnabled: true,
    }])[0]?.inboxEnabled, true);
  });

  it("atualiza o nome do Inbox quando o nome do chip é salvo", () => {
    writePhoneIdentity(tenantId, "phone-1", {
      inboxEnabled: true,
      channelName: "Mms Marketing E Sistemas Digitais Ltda",
      displayPhoneNumber: "+55 51 8200-1279",
    });
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.name, "Mms Marketing E Sistemas Digitais Ltda");
    writePhoneIdentity(tenantId, "phone-1", { name: "Drax Sistema" });
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.name, "Drax Sistema");
  });

  it("pede novo nome de exibição na Meta", async () => {
    const posts: Array<{ path: string; query?: Record<string, string> }> = [];
    const graph = async (input: { path: string; method: string; query?: Record<string, string> }) => {
      if (input.method === "POST") {
        posts.push({ path: input.path, query: input.query });
        return { ok: true, status: 200, json: { success: true } };
      }
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
      }
      if (input.path === "phone-1") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "phone-1",
            verified_name: "Walkup",
            name_status: "APPROVED",
            new_display_name: "Soma Promotora",
            new_name_status: "PENDING_REVIEW",
          },
        };
      }
      return {
        ok: true,
        status: 200,
        json: { data: [{ id: "phone-1", status: "CONNECTED", verified_name: "Walkup" }] },
      };
    };
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const result = await service.updatePhoneProfileFromAuth(auth, {
      phoneNumberId: "phone-1",
      displayName: "Soma Promotora",
    });
    assert.equal(result.namePending, true);
    assert.equal(result.nameNeedsRegister, false);
    assert.equal(result.nameUpdated, true);
    assert.equal(result.photoUpdated, false);
    assert.equal(result.numbers[0]?.verifiedName, "Walkup");
    assert.equal(result.numbers[0]?.requestedName, "Soma Promotora");
    assert.equal(result.numbers[0]?.nameSyncStatus, "pending");
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.name, "Soma Promotora");
    assert.equal(posts[0]?.path, "phone-1");
    assert.equal(posts[0]?.query?.new_display_name, "Soma Promotora");
  });

  it("mostra PIN quando a Meta aprova o nome sem mudar o verified_name", async () => {
    const graph = async (input: { path: string; method: string }) => {
      if (input.method === "POST") {
        return { ok: true, status: 200, json: { success: true } };
      }
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
      }
      if (input.path === "phone-1") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "phone-1",
            verified_name: "Walkup",
            name_status: "APPROVED",
            new_display_name: "Drax Sistema",
            new_name_status: "AVAILABLE_WITHOUT_REVIEW",
          },
        };
      }
      return {
        ok: true,
        status: 200,
        json: {
          data: [
            {
              id: "phone-1",
              status: "CONNECTED",
              verified_name: "Walkup",
              new_display_name: "Drax Sistema",
              new_name_status: "AVAILABLE_WITHOUT_REVIEW",
            },
          ],
        },
      };
    };
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const result = await service.updatePhoneProfileFromAuth(auth, {
      phoneNumberId: "phone-1",
      displayName: "Drax Sistema",
    });
    assert.equal(result.namePending, false);
    assert.equal(result.nameNeedsRegister, true);
    assert.equal(result.numbers[0]?.nameSyncStatus, "ready");
    assert.equal(result.numbers[0]?.nameNeedsRegister, true);
    assert.equal(result.numbers[0]?.canActivate, true);
    assert.equal(result.numbers[0]?.verifiedName, "Walkup");
    assert.equal(result.numbers[0]?.requestedName, "Drax Sistema");
  });

  it("envia categoria e descrição do perfil para a Meta", async () => {
    const posts: Array<{ path: string; body?: Record<string, unknown> }> = [];
    const graph = async (input: { path: string; method: string; body?: Record<string, unknown> }) => {
      if (input.method === "POST") {
        posts.push({ path: input.path, body: input.body });
        return { ok: true, status: 200, json: { success: true } };
      }
      if (input.path === "phone-1/whatsapp_business_profile") {
        return {
          ok: true,
          status: 200,
          json: { data: [{ vertical: "OTHER", description: "Antiga", profile_picture_url: "https://pps.whatsapp.net/v/a.jpg" }] },
        };
      }
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
      }
      return {
        ok: true,
        status: 200,
        json: { data: [{ id: "phone-1", status: "CONNECTED", verified_name: "Walkup" }] },
      };
    };
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const result = await service.updatePhoneProfileFromAuth(auth, {
      phoneNumberId: "phone-1",
      vertical: "OTHER",
      description: "Sistemas digitais",
      address: "Porto Alegre",
      email: "contato@mms.com.br",
    });
    assert.equal(result.profileUpdated, true);
    assert.equal(result.numbers[0]?.description, "Sistemas digitais");
    assert.equal(result.numbers[0]?.vertical, "OTHER");
    assert.equal(posts[0]?.path, "phone-1/whatsapp_business_profile");
    assert.equal(posts[0]?.body?.messaging_product, "whatsapp");
    assert.equal(posts[0]?.body?.vertical, "OTHER");
    assert.equal(posts[0]?.body?.description, "Sistemas digitais");
    assert.equal(posts[0]?.body?.email, "contato@mms.com.br");
    assert.equal(result.numbers[0]?.profileSyncStatus, "applied");
  });

  it("envia foto pelo handle do upload resumable", async () => {
    const posts: Array<{ path: string; body?: Record<string, unknown> }> = [];
    const graph = async (input: { path: string; method: string; body?: Record<string, unknown> }) => {
      if (input.method === "POST") {
        posts.push({ path: input.path, body: input.body });
        return { ok: true, status: 200, json: { success: true } };
      }
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
      }
      return {
        ok: true,
        status: 200,
        json: { data: [{ id: "phone-1", status: "CONNECTED", verified_name: "Walkup" }] },
      };
    };
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
      decryptMetaToken,
      async () => ({ handle: "pic-handle" }),
    );
    const result = await service.updatePhoneProfileFromAuth(auth, {
      phoneNumberId: "phone-1",
      photoBase64: png,
      photoMime: "image/png",
    });
    assert.equal(result.photoUpdated, true);
    assert.match(String(result.numbers[0]?.profilePictureUrl || ""), /\/integrations\/meta\/whatsapp\/phone-numbers\/photo/);
    assert.equal(posts[0]?.path, "phone-1/whatsapp_business_profile");
    assert.equal(posts[0]?.body?.profile_picture_handle, "pic-handle");
    assert.equal(result.numbers[0]?.photoSyncStatus, "applied");
  });

  it("recusa salvar se a Meta não aplicar a foto", async () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      (async (input: { path: string; method: string }) => {
        if (input.path === "phone-1/whatsapp_business_profile" && input.method === "POST") {
          return { ok: false, status: 400, json: { error: { code: 100 } }, graphCode: "100" };
        }
        if (input.path === "1247508354180311") {
          return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
        }
        if (input.method === "POST") {
          return { ok: true, status: 200, json: { success: true } };
        }
        return {
          ok: true,
          status: 200,
          json: { data: [{ id: "phone-1", status: "CONNECTED", verified_name: "Walkup" }] },
        };
      }) as any,
      decryptMetaToken,
      async () => ({ handle: "pic-handle" }),
    );
    await assert.rejects(
      () =>
        service.updatePhoneProfileFromAuth(auth, {
          phoneNumberId: "phone-1",
          displayName: "Soma Promotora",
          photoBase64: png,
          photoMime: "image/png",
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "profile_update_failed",
    );
  });

  it("recusa foto e nome se o número ainda não estiver Ativo", async () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    let profilePosts = 0;
    const graph = async (input: { path: string; method?: string }) => {
      if (input.path === "phone-1/whatsapp_business_profile") {
        if (input.method === "POST") profilePosts += 1;
        return { ok: true, status: 200, json: { success: true } };
      }
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
      }
      return {
        ok: true,
        status: 200,
        json: { data: [{ id: "phone-1", status: "PENDING", verified_name: "Walkup" }] },
      };
    };
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    await assert.rejects(
      () =>
        service.updatePhoneProfileFromAuth(auth, {
          phoneNumberId: "phone-1",
          photoBase64: png,
          photoMime: "image/png",
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "phone_not_registered",
    );
    assert.equal(profilePosts, 0);
  });

  it("não grava o nome no card se a Meta recusar o display name", async () => {
    const graph = async (input: { path: string; method: string }) => {
      if (input.method === "POST" && input.path === "phone-1") {
        return { ok: false, status: 400, json: { error: { code: 100 } }, graphCode: "100" };
      }
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
      }
      return {
        ok: true,
        status: 200,
        json: { data: [{ id: "phone-1", status: "CONNECTED", verified_name: "Walkup" }] },
      };
    };
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    await assert.rejects(
      () =>
        service.updatePhoneProfileFromAuth(auth, {
          phoneNumberId: "phone-1",
          displayName: "Soma Promotora",
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "profile_update_failed",
    );
  });

  it("atualiza o nome do portfólio na Meta", async () => {
    const posts: Array<{ path: string; body?: Record<string, unknown> }> = [];
    const graph = async (input: { path: string; method: string; body?: Record<string, unknown> }) => {
      if (input.method === "POST") {
        posts.push({ path: input.path, body: input.body });
        return { ok: true, status: 200, json: { success: true } };
      }
      if (input.path === "1247508354180311") {
        return {
          ok: true,
          status: 200,
          json: { id: "1247508354180311", name: "Grupo Walkup", primary_page: { id: "page-1", name: "Soma" } },
        };
      }
      return {
        ok: true,
        status: 200,
        json: { data: [{ id: "phone-1", status: "CONNECTED" }] },
      };
    };
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const result = await service.updatePortfolioFromAuth(auth, { displayName: "Drax Sistemas" });
    assert.equal(result.nameUpdated, true);
    assert.equal(result.portfolio?.name, "Drax Sistemas");
    assert.equal(posts[0]?.path, "1247508354180311");
    assert.equal(posts[0]?.body?.name, "Drax Sistemas");
  });

  it("atualiza a foto do portfólio pela página principal", async () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const pages: string[] = [];
    const graph = async (input: { path: string; method: string }) => {
      if (input.path === "1247508354180311") {
        return {
          ok: true,
          status: 200,
          json: { id: "1247508354180311", name: "Grupo Walkup", primary_page: { id: "page-1", name: "Soma" } },
        };
      }
      return { ok: true, status: 200, json: { data: [{ id: "phone-1", status: "CONNECTED" }] } };
    };
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
      decryptMetaToken,
      async () => ({ handle: "unused" }),
      async (input) => {
        pages.push(input.pageId);
        return { photoId: "photo-1" };
      },
    );
    const result = await service.updatePortfolioFromAuth(auth, {
      photoBase64: png,
      photoMime: "image/png",
    });
    assert.equal(result.photoUpdated, true);
    assert.match(String(result.portfolio?.profilePictureUrl || ""), /\/integrations\/meta\/whatsapp\/portfolio\/photo/);
    assert.deepEqual(pages, ["page-1"]);
  });

  it("grava a foto no card mesmo sem Página na Meta", async () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    let pictureCalls = 0;
    const graph = async (input: { path: string; method: string }) => {
      if (input.path === "1247508354180311/owned_pages") {
        return { ok: true, status: 200, json: { data: [] } };
      }
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Drax Sistemas" } };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
      decryptMetaToken,
      async () => ({ handle: "unused" }),
      async () => {
        pictureCalls += 1;
        return { photoId: "photo-1" };
      },
    );
    const result = await service.updatePortfolioFromAuth(auth, { photoBase64: png, photoMime: "image/png" });
    assert.equal(result.photoUpdated, true);
    assert.equal(pictureCalls, 0);
    assert.match(String(result.portfolio?.profilePictureUrl || ""), /\/integrations\/meta\/whatsapp\/portfolio\/photo/);
    assert.match(String(result.warning || ""), /Página/);
  });

  it("mantém o nome no card se a Meta recusar o POST", async () => {
    const graph = async (input: { path: string; method: string }) => {
      if (input.method === "POST") {
        return { ok: false, status: 400, json: { error: { code: 3910, message: "denied" } }, graphCode: 3910 };
      }
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      { async findOpenByTenant() { return connectedRow(); } } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const result = await service.updatePortfolioFromAuth(auth, { displayName: "Drax Sistemas" });
    assert.equal(result.nameUpdated, true);
    assert.equal(result.portfolio?.name, "Drax Sistemas");
    assert.match(String(result.warning || ""), /Meta/);
  });

  it("lista vários portfólios e Graph vazio não apaga número gravado", async () => {
    const drax = {
      ...connectedRow(),
      id: "conn-drax",
      metaBusinessId: "1041827648719609",
      wabaId: "1247508354180311",
      displayPhoneNumber: "+55 51 8200-1279",
      verifiedName: "Drax Tecnologia e Sistemas",
    };
    const walkup = {
      ...connectedRow(),
      id: "conn-walkup",
      metaBusinessId: "4141369862822598",
      wabaId: "waba-walkup",
      phoneNumberId: "phone-walkup",
      displayPhoneNumber: "+55 11 95213-7761",
      verifiedName: "Grupo Walkup",
    };
    const repo = {
      async listOpenByTenant() {
        return [drax, walkup];
      },
      async findOpenByTenant() {
        return drax;
      },
    };
    const graph = async () => ({ ok: true, status: 200, json: { data: [] } });
    const service = new MetaWhatsappConnectionService(
      repo as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth, { connectionId: "conn-drax" });
    assert.equal((assets.portfolios || []).length, 2);
    assert.equal(assets.portfolio?.id, "1041827648719609");
    assert.notEqual(assets.portfolio?.id, "1247508354180311");
    assert.equal(assets.portfolio?.primaryPageName, "Drax Tecnologia e Sistemas");
    assert.ok(assets.numbers.some((item) => String(item.displayPhoneNumber || "").includes("8200-1279")));
    const walkupCard = (assets.portfolios || []).find((item) => item.id === "4141369862822598");
    assert.ok(walkupCard);
    assert.equal(walkupCard?.primaryPageName, "Grupo Walkup");
    assert.ok((walkupCard?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("95213-7761")));
    const draxCard = (assets.portfolios || []).find((item) => item.id === "1041827648719609");
    assert.ok((draxCard?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("8200-1279")));
  });
});

describe("meta graph json client", () => {
  it("não envia Content-Type JSON em POST só com query", async () => {
    let contentType = "missing";
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      contentType = headers.get("Content-Type") || "";
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      } as Response;
    };
    await callMetaGraphJson({
      token: "token",
      method: "POST",
      path: "106540352242922",
      query: { new_display_name: "Lucky Shrub" },
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(contentType, "");
  });

  it("baixa a foto https da Meta para cache local", async () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const fetched = await fetchHttpsProfileImage("https://pps.whatsapp.net/v/pic.jpg", (async () => ({
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "image/png" : null) },
      arrayBuffer: async () => Buffer.from(png, "base64"),
    })) as unknown as typeof fetch);
    assert.equal(fetched?.ext, "png");
    assert.ok(fetched && fetched.bytes.length > 0);
    assert.equal(await fetchHttpsProfileImage("http://pps.whatsapp.net/v/pic.jpg"), null);
  });
});
