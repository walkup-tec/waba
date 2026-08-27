import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { randomBytes } from "node:crypto";
import { MetaWhatsappConnectionService } from "./meta-whatsapp-connection.service";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import {
  mapMetaBusinessToPortfolio,
  mapMetaPhoneListToPortfolioNumbers,
  mapMetaPhoneToPortfolioNumber,
} from "./meta-whatsapp-portfolio.map";
import { encryptMetaToken, decryptMetaToken } from "./meta-token-crypto";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { parseDisplayName, parseProfilePhoto } from "./meta-whatsapp-phone-profile";

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
    assert.equal(assets.numbers.length, 1);
    assert.equal(assets.numbers[0].uiStatus, "pendente");
    assert.equal(assets.numbers[0].dispatchStatus, "livre");
    assert.doesNotMatch(json, /EAAB-secret-token|access_token|accessToken/);
    assert.deepEqual(graphCalls, ["1247508354180311", "waba-1/phone_numbers"]);
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
    assert.equal(result.photoUpdated, false);
    assert.equal(posts[0]?.path, "phone-1");
    assert.equal(posts[0]?.query?.new_display_name, "Soma Promotora");
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
    assert.equal(posts[0]?.path, "phone-1/whatsapp_business_profile");
    assert.equal(posts[0]?.body?.profile_picture_handle, "pic-handle");
  });

  it("atualiza o nome do portfólio na Meta", async () => {
    const posts: Array<{ path: string; query?: Record<string, string> }> = [];
    const graph = async (input: { path: string; method: string; query?: Record<string, string> }) => {
      if (input.method === "POST") {
        posts.push({ path: input.path, query: input.query });
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
    assert.equal(posts[0]?.path, "1247508354180311");
    assert.equal(posts[0]?.query?.name, "Drax Sistemas");
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
    assert.deepEqual(pages, ["page-1"]);
  });
});
