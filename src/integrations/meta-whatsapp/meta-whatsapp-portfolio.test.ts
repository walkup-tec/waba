import assert from "node:assert/strict";
import { describe, it, before, after, afterEach, beforeEach } from "node:test";
import { randomBytes } from "node:crypto";
import { MetaWhatsappConnectionService } from "./meta-whatsapp-connection.service";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import {
  mapMetaBusinessToPortfolio,
  mapMetaPhoneListToPortfolioNumbers,
  mapMetaPhoneToPortfolioNumber,
  mapMetaWabaIdentity,
  mergePortfolioIdentity,
  mergePortfolioNumbers,
  unionPortfolioNumbers,
  dedupePortfolioCards,
  isRenderablePortfolioCard,
  graphPhotoDownloadUrl,
  graphPhotoSourceKey,
  META_BUSINESS_IDENTITY_FIELDS,
  resolvePhoneNameSync,
  META_PHONE_NUMBER_LIST_FIELDS,
} from "./meta-whatsapp-portfolio.map";
import { fetchBusinessFromGraph, fetchKnownBusinessPortfolios, fetchWabaOwner, directoryFromAssigned } from "./meta-whatsapp-portfolio-graph";
import { encryptMetaToken, decryptMetaToken } from "./meta-token-crypto";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { parseDisplayName, parseProfilePhoto, parseVertical, parseDescription, parseEmail, mapWhatsappBusinessProfile, fetchHttpsProfileImage } from "./meta-whatsapp-phone-profile";
import { callMetaGraphJson } from "./meta-whatsapp-graph.client";
import { purgePortfolioIdentity, writePortfolioIdentity } from "./meta-whatsapp-portfolio-identity.store";
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

    const withToken = mapMetaBusinessToPortfolio(
      { id: "1", profile_picture_uri: "https://graph.facebook.com/v/pic.jpg?access_token=EAABsecret" },
      {},
    );
    assert.equal(withToken.profilePictureUrl, null);
    assert.match(
      String(
        graphPhotoDownloadUrl({
          profile_picture_uri: "https://graph.facebook.com/v/pic.jpg?access_token=EAABsecret",
        }) || "",
      ),
      /graph\.facebook\.com/,
    );
  });

  it("não pede o campo picture no Business da Graph", () => {
    assert.match(META_BUSINESS_IDENTITY_FIELDS, /profile_picture_uri/);
    assert.match(META_BUSINESS_IDENTITY_FIELDS, /primary_page\{id,name,picture\}/);
    assert.equal(/(^|,)picture(,|$)/.test(META_BUSINESS_IDENTITY_FIELDS), false);
  });

  it("usa nome, página e foto da WABA e das páginas owned", () => {
    const fromWaba = mapMetaWabaIdentity({
      id: "1247508354180311",
      name: "Conta WABA Drax",
      owner_business_info: {
        id: "1041827648719609",
        name: "Drax Sistemas",
        profile_picture_uri: "https://scontent.xx.fbcdn.net/v/drax.jpg",
        primary_page: { id: "page-drax", name: "Drax Sistemas e Tecnologia" },
      },
    });
    assert.equal(fromWaba.businessId, "1041827648719609");
    assert.equal(fromWaba.businessName, "Drax Sistemas");
    assert.equal(fromWaba.primaryPageName, "Drax Sistemas e Tecnologia");
    assert.equal(fromWaba.wabaName, "Conta WABA Drax");

    const fromWabaPageId = mapMetaWabaIdentity({
      id: "1014470201624992",
      name: "Walkup WABA",
      owner_business_info: {
        id: "4141369862822598",
        name: "Grupo Walkup",
        primary_page: "page-walkup",
      },
    });
    assert.equal(fromWabaPageId.primaryPageId, "page-walkup");
    assert.equal(fromWabaPageId.primaryPageName, null);

    const fromPageIdOnly = mapMetaBusinessToPortfolio(
      { id: "4141369862822598", name: "Grupo Walkup", primary_page: { id: "page-walkup" } },
      {},
    );
    assert.equal(fromPageIdOnly.primaryPageId, "page-walkup");
    assert.equal(fromPageIdOnly.primaryPageName, null);

    const owned = mapMetaBusinessToPortfolio(
      {
        id: "1041827648719609",
        name: "Drax Sistemas",
        owned_pages: {
          data: [{ id: "page-drax", name: "Drax Tecnologia e Sistemas", picture: { data: { url: "https://scontent.xx.fbcdn.net/v/page.jpg" } } }],
        },
      },
      { wabaId: "1247508354180311" },
    );
    assert.equal(owned.primaryPageName, "Drax Tecnologia e Sistemas");
    assert.equal(owned.primaryPageId, "page-drax");
    assert.equal(owned.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/page.jpg");

    const merged = mergePortfolioIdentity({
      fallback: {
        id: "1247508354180311",
        name: null,
        primaryPageId: null,
        primaryPageName: null,
        profilePictureUrl: null,
        wabaId: null,
        connectionId: "conn-waba",
      },
      waba: {
        id: "1247508354180311",
        name: "Conta WABA Drax",
        owner_business_info: { id: "1041827648719609", name: "Drax Sistemas" },
      },
      ownedPages: { data: [{ id: "page-drax", name: "Drax Tecnologia e Sistemas" }] },
    });
    assert.equal(merged.id, "1041827648719609");
    assert.notEqual(merged.id, "1247508354180311");
    assert.equal(merged.name, "Drax Sistemas");
    assert.equal(merged.primaryPageName, "Drax Tecnologia e Sistemas");
    assert.equal(merged.wabaId, "1247508354180311");
  });

  it("usa o nome da WABA e a Página quando o Business vem como Portfólio empresarial", () => {
    const fromWabaName = mergePortfolioIdentity({
      fallback: {
        id: "3887084984861602",
        name: null,
        primaryPageId: null,
        primaryPageName: null,
        profilePictureUrl: null,
        wabaId: "405969599269224",
        connectionId: "conn-new",
      },
      waba: {
        id: "405969599269224",
        name: "Drax Sistemas",
        owner_business_info: { id: "3887084984861602", name: "Portfólio empresarial" },
      },
    });
    assert.equal(fromWabaName.name, "Drax Sistemas");
    assert.equal(fromWabaName.id, "3887084984861602");

    const assigned = directoryFromAssigned({
      data: [
        {
          id: "3887084984861602",
          name: "Portfólio empresarial",
          primary_page: { id: "page-drax", name: "Drax Sistemas e Tecnologia" },
        },
      ],
    });
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0]?.id, "3887084984861602");
    assert.equal(assigned[0]?.primaryPageName, "Drax Sistemas e Tecnologia");
  });

  it("não mostra o WABA como card de portfólio quando já existe o Business", () => {
    const cards = dedupePortfolioCards([
      {
        id: "1041827648719609",
        name: "Drax Sistemas",
        primaryPageId: "page-drax",
        primaryPageName: "Drax Tecnologia e Sistemas",
        profilePictureUrl: "https://scontent.xx.fbcdn.net/v/drax.jpg",
        wabaId: "1247508354180311",
        connectionId: "conn-drax",
        numbers: [{ phoneNumberId: "phone-drax", displayPhoneNumber: "+55 51 8200-1279" } as any],
      },
      {
        id: "1247508354180311",
        name: null,
        primaryPageId: null,
        primaryPageName: null,
        profilePictureUrl: null,
        wabaId: "1247508354180311",
        connectionId: "conn-waba",
        numbers: [{ phoneNumberId: "phone-drax", displayPhoneNumber: "+55 51 8200-1279" } as any],
      },
    ]);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.id, "1041827648719609");
    assert.equal(cards[0]?.name, "Drax Sistemas");
    assert.equal((cards[0]?.numbers || []).length, 1);
  });

  it("não trata pending_token vazio como card de portfólio", () => {
    assert.equal(
      isRenderablePortfolioCard({
        id: null,
        name: null,
        primaryPageId: null,
        primaryPageName: null,
        profilePictureUrl: null,
        wabaId: null,
        connectionId: "conn-ghost",
        numbers: [],
      }),
      false,
    );
    assert.equal(
      isRenderablePortfolioCard({
        id: "1041827648719609",
        name: "Drax Sistemas",
        primaryPageId: "page-drax",
        primaryPageName: "Drax Tecnologia e Sistemas",
        profilePictureUrl: null,
        wabaId: "1247508354180311",
        connectionId: "conn-drax",
        numbers: [],
      }),
      true,
    );
  });

  it("não lista ID de número sem telefone quando a Graph já devolveu o chip real", () => {
    const rows = mergePortfolioNumbers(
      [
        {
          phoneNumberId: "phone-drax",
          displayPhoneNumber: "+55 51 8200-1279",
          verifiedName: "Drax Sistemas",
        } as any,
      ],
      [
        {
          phoneNumberId: "1350439411479507",
          displayPhoneNumber: null,
          verifiedName: null,
        } as any,
      ],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.phoneNumberId, "phone-drax");
    assert.equal(rows[0]?.displayPhoneNumber, "+55 51 8200-1279");
  });

  it("não mostra na lista um ID da Graph sem display_phone_number", () => {
    const rows = mergePortfolioNumbers(
      [
        {
          phoneNumberId: "1350439411479507",
          displayPhoneNumber: null,
          verifiedName: null,
        } as any,
      ],
      [],
    );
    assert.equal(rows.length, 0);
  });

  it("une números de conexões do mesmo BM sem descartar a segunda lista", () => {
    const rows = unionPortfolioNumbers(
      [
        {
          phoneNumberId: "phone-jandira",
          displayPhoneNumber: "+55 11 95213-1900",
          verifiedName: "Relacionamento Deputada Jandira",
          metaStatus: "CONNECTED",
        } as any,
      ],
      [
        {
          phoneNumberId: "phone-quantum-2",
          displayPhoneNumber: "+55 11 90000-2222",
          verifiedName: "Quantum Smart Labs 2",
          metaStatus: "CONNECTED",
        } as any,
      ],
      [
        {
          phoneNumberId: "phone-jandira",
          displayPhoneNumber: "+55 11 95213-1900",
          verifiedName: "Relacionamento Deputada Jandira",
          metaStatus: "CONNECTED",
        } as any,
      ],
    );
    assert.equal(rows.length, 2);
    assert.ok(rows.some((item) => item.phoneNumberId === "phone-jandira"));
    assert.ok(rows.some((item) => item.phoneNumberId === "phone-quantum-2"));
  });

  it("union Graph CONNECTED + stored com nome não rebaixa para pendente", () => {
    const rows = unionPortfolioNumbers(
      [
        {
          phoneNumberId: "phone-1",
          displayPhoneNumber: "+55 27 92836-1199",
          verifiedName: null,
          metaStatus: "CONNECTED",
          uiStatus: "ativo",
        } as any,
      ],
      [
        {
          phoneNumberId: "phone-1",
          displayPhoneNumber: "+55 27 92836-1199",
          verifiedName: "Quantum Smart Labs",
          metaStatus: null,
          uiStatus: "pendente",
        } as any,
      ],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.metaStatus, "CONNECTED");
    assert.equal(rows[0]?.uiStatus, "ativo");
    assert.equal(rows[0]?.verifiedName, "Quantum Smart Labs");
  });

  it("ao deduplicar o mesmo BM, preserva todos os chips das conexões", () => {
    const cards = dedupePortfolioCards([
      {
        id: "3887084984861602",
        name: "Quantum Smart Labs",
        primaryPageId: null,
        primaryPageName: null,
        profilePictureUrl: null,
        wabaId: "1053856057421351",
        connectionId: "conn-quantum-a",
        numbers: [
          {
            phoneNumberId: "phone-jandira",
            displayPhoneNumber: "+55 11 95213-1900",
            verifiedName: "Relacionamento Deputada Jandira",
          } as any,
        ],
      },
      {
        id: "3887084984861602",
        name: "Quantum Smart Labs",
        primaryPageId: null,
        primaryPageName: null,
        profilePictureUrl: null,
        wabaId: "1053856057421351",
        connectionId: "conn-quantum-b",
        numbers: [
          {
            phoneNumberId: "phone-quantum-2",
            displayPhoneNumber: "+55 11 90000-2222",
            verifiedName: "Quantum Smart Labs 2",
          } as any,
        ],
      },
    ]);
    assert.equal(cards.length, 1);
    assert.equal((cards[0]?.numbers || []).length, 2);
    assert.ok((cards[0]?.numbers || []).some((item) => item.phoneNumberId === "phone-jandira"));
    assert.ok((cards[0]?.numbers || []).some((item) => item.phoneNumberId === "phone-quantum-2"));
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
    assert.equal(parseProfilePhoto({ photoBase64: png, photoMime: "application/octet-stream" })?.mime, "image/png");
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

  it("não cobre nome da Meta com o que foi salvo no Editar local", () => {
    const tenantId = deriveStableMetaTenantId("sync-card@exemplo.com");
    purgePhoneIdentities(tenantId);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    writePhoneIdentity(tenantId, "phone-1", {
      name: "Drax",
      photo: { ext: "png", bytes: png },
      inboxEnabled: true,
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
        newDisplayName: "Walkup Oficial",
        newNameStatus: "PENDING_REVIEW",
        profilePictureUrl: "https://pps.whatsapp.net/v/pic.jpg",
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
    ]);
    assert.equal(pending[0]?.verifiedName, "Mms Marketing E Sistemas Digitais Ltda");
    assert.equal(pending[0]?.requestedName, "Walkup Oficial");
    assert.equal(pending[0]?.nameSyncStatus, "pending");
    assert.match(String(pending[0]?.profilePictureUrl || ""), /\/integrations\/meta\/whatsapp\/phone-numbers\/photo/);
    assert.equal(pending[0]?.inboxEnabled, true);
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

  beforeEach(() => {
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
    assert.match(graphFields[0] || "", /owner_business_info/);
    assert.ok(graphFields.some((item) => /profile_picture_uri/.test(item)));
    assert.ok(graphFields.some((item) => /primary_page/.test(item)));
    // Nested BM fields also embed new_display_name inside phone_numbers{...}; match exact list fields.
    assert.ok(graphFields.some((item) => item === META_PHONE_NUMBER_LIST_FIELDS));
    assert.equal(assets.numbers.length, 1);
    assert.equal(assets.numbers[0].uiStatus, "pendente");
    assert.equal(assets.numbers[0].dispatchStatus, "livre");
    assert.doesNotMatch(json, /EAAB-secret-token|access_token|accessToken/);
    assert.ok(graphCalls.includes("waba-1"));
    assert.ok(graphCalls.includes("me/businesses"));
    assert.ok(graphCalls.includes("1247508354180311"));
    assert.ok(graphCalls.includes("waba-1/phone_numbers"));
  });

  it("mostra no card o nome, a foto e o pedido de nome que a Meta já tem", async () => {
    const repo = {
      async findOpenByTenant() {
        return { ...connectedRow(), status: "connected", metaBusinessId: "4141369862822598", wabaId: "1014470201624992" };
      },
    };
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      if (input.path === "4141369862822598") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "4141369862822598",
            name: "Grupo Walkup",
            profile_picture_uri: "https://scontent.xx.fbcdn.net/v/walkup-logo.jpg",
            primary_page: { id: "page-walkup", name: "Grupo Walkup" },
          },
        };
      }
      if (input.path === "1014470201624992") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1014470201624992",
            name: "Walkup WABA",
            owner_business_info: { id: "4141369862822598", name: "Grupo Walkup" },
          },
        };
      }
      if (input.path === "phone-1") {
        return {
          ok: true,
          status: 200,
          json: {
            verified_name: "Grupo Walkup",
            name_status: "APPROVED",
            new_display_name: null,
            new_name_status: null,
          },
        };
      }
      if (input.path === "phone-1/whatsapp_business_profile") {
        return {
          ok: true,
          status: 200,
          json: { data: [{ profile_picture_url: "https://pps.whatsapp.net/v/chip.jpg" }] },
        };
      }
      if (input.path.endsWith("/phone_numbers")) {
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "phone-1",
                display_phone_number: "+55 11 95213-7761",
                verified_name: "Grupo Walkup",
                status: "CONNECTED",
              },
            ],
          },
        };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      repo as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth);
    assert.equal(assets.portfolio?.id, "4141369862822598");
    assert.equal(assets.portfolio?.name, "Grupo Walkup");
    assert.equal(assets.portfolio?.primaryPageName, "Grupo Walkup");
    assert.equal(assets.portfolio?.wabaId, "1014470201624992");
    assert.equal(assets.portfolio?.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/walkup-logo.jpg");
    assert.equal(assets.numbers[0]?.verifiedName, "Grupo Walkup");
    assert.equal(assets.numbers[0]?.profilePictureUrl, "https://pps.whatsapp.net/v/chip.jpg");
    assert.equal(assets.numbers[0]?.requestedName, null);
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
      // Fan-out BM→WABAs: edges vazias — senão o catch-all abaixo vira WABA fantasma.
      if (
        input.path.endsWith("/owned_whatsapp_business_accounts") ||
        input.path.endsWith("/client_whatsapp_business_accounts")
      ) {
        return { ok: true, status: 200, json: { data: [] } };
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

  it("envia a foto do chip à Meta com profile_picture_handle", async () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const posts: Array<{ path: string; body?: Record<string, unknown> }> = [];
    const graph = async (input: {
      path: string;
      method: string;
      query?: Record<string, string>;
      body?: Record<string, unknown>;
    }) => {
      if (input.method === "POST") {
        posts.push({ path: input.path, body: input.body });
        return { ok: true, status: 200, json: { success: true } };
      }
      if (input.path === "4141369862822598") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "4141369862822598",
            name: "Grupo Walkup",
            primary_page: { id: "page-walkup", name: "Grupo Walkup" },
          },
        };
      }
      if (input.path === "1014470201624992") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1014470201624992",
            owner_business_info: { id: "4141369862822598", name: "Grupo Walkup" },
          },
        };
      }
      if (input.path === "phone-1") {
        return {
          ok: true,
          status: 200,
          json: {
            verified_name: "Grupo Walkup",
            name_status: "APPROVED",
            status: "CONNECTED",
          },
        };
      }
      if (input.path === "phone-1/whatsapp_business_profile") {
        return {
          ok: true,
          status: 200,
          json: { data: [{ profile_picture_url: "https://pps.whatsapp.net/v/chip.jpg" }] },
        };
      }
      if (input.path.endsWith("/phone_numbers")) {
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "phone-1",
                display_phone_number: "+55 11 95213-7761",
                verified_name: "Grupo Walkup",
                status: "CONNECTED",
              },
            ],
          },
        };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const row = {
      ...connectedRow(),
      status: "connected" as const,
      metaBusinessId: "4141369862822598",
      wabaId: "1014470201624992",
    };
    const service = new MetaWhatsappConnectionService(
      {
        async findOpenByTenant() {
          return row;
        },
        async listOpenByTenant() {
          return [row];
        },
      } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
      decryptMetaToken,
      async () => ({ handle: "HANDLE_PIC" }),
    );
    const updated = await service.updatePhoneProfileFromAuth(auth, {
      phoneNumberId: "phone-1",
      photoBase64: png,
      photoMime: "application/octet-stream",
    });
    const profilePost = posts.find((item) => item.path === "phone-1/whatsapp_business_profile");
    assert.equal(profilePost?.body?.messaging_product, "whatsapp");
    assert.equal(profilePost?.body?.profile_picture_handle, "HANDLE_PIC");
    assert.equal(updated.photoUpdated, true);
  });

  it("recusa foto de perfil se o número ainda não está ativo na Meta", async () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const graph = async (input: { path: string }) => {
      if (input.path === "1247508354180311") {
        return { ok: true, status: 200, json: { id: "1247508354180311", name: "Grupo Walkup" } };
      }
      if (input.path.endsWith("/phone_numbers")) {
        return {
          ok: true,
          status: 200,
          json: {
            data: [{ id: "phone-1", display_phone_number: "+55 51 8200-1279", status: "PENDING" }],
          },
        };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      {
        async findOpenByTenant() {
          return connectedRow();
        },
        async listOpenByTenant() {
          return [connectedRow()];
        },
      } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
      decryptMetaToken,
      async () => ({ handle: "HANDLE_PIC" }),
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
  });

  it("ativa o número pendente com o token do portfólio Walkup", async () => {
    const drax = {
      ...connectedRow(),
      id: "conn-drax",
      metaBusinessId: "1041827648719609",
      wabaId: "1636793994538054",
      phoneNumberId: "phone-drax",
      accessTokenEncrypted: encryptMetaToken("token-drax"),
    };
    const walkup = {
      ...connectedRow(),
      id: "conn-walkup",
      metaBusinessId: "4141369862822598",
      wabaId: "1014470201624992",
      phoneNumberId: "phone-walkup",
      displayPhoneNumber: "+55 11 95213-7761",
      verifiedName: "Grupo Walkup",
      accessTokenEncrypted: encryptMetaToken("token-walkup"),
    };
    const posts: Array<{ path: string; token?: string }> = [];
    const graph = async (input: { path: string; method: string; token?: string }) => {
      if (input.method === "POST") {
        posts.push({ path: input.path, token: input.token });
        return { ok: true, status: 200, json: { success: true } };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      {
        async listOpenByTenant() {
          return [drax, walkup];
        },
        async findOpenByTenant() {
          return drax;
        },
      } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    await service.registerPhoneFromAuth(auth, {
      phoneNumberId: "phone-walkup",
      pin: "482917",
      connectionId: "conn-walkup",
    });
    assert.equal(posts[0]?.path, "phone-walkup/register");
    assert.equal(posts[0]?.token, "token-walkup");
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
      {
        async findOpenByTenant() {
          return connectedRow();
        },
        async listOpenByTenant() {
          return [connectedRow()];
        },
      } as any,
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

  it("usa o nome da Meta no Inbox e ignora o nome local do Editar", () => {
    writePhoneIdentity(tenantId, "phone-1", {
      inboxEnabled: true,
      channelName: "Grupo Walkup",
      name: "Drax Sistema",
      displayPhoneNumber: "+55 51 8200-1279",
    });
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.name, "Grupo Walkup");
    applyLocalPhoneIdentities(tenantId, [
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
      },
    ]);
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.name, "Mms Marketing E Sistemas Digitais Ltda");
    assert.equal(
      listPhoneInboxChannels(tenantId, new Map([["phone-1", "Nome Meta ao vivo"]]))[0]?.name,
      "Nome Meta ao vivo",
    );
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
    assert.ok(assets.numbers.some((item) => String(item.displayPhoneNumber || "").includes("8200-1279")));
    const walkupCard = (assets.portfolios || []).find((item) => item.id === "4141369862822598");
    assert.ok(walkupCard);
    const walkupNumber = (walkupCard?.numbers || []).find((item) => String(item.displayPhoneNumber || "").includes("95213-7761"));
    assert.equal(walkupNumber?.canActivate, true);
    assert.equal(walkupNumber?.uiStatus, "pendente");
    assert.ok((walkupCard?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("95213-7761")));
    const draxCard = (assets.portfolios || []).find((item) => item.id === "1041827648719609");
    assert.ok((draxCard?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("8200-1279")));
  });

  it("lista todos os números quando duas conexões do mesmo BM Quantum são fundidas", async () => {
    const quantumA = {
      ...connectedRow(),
      id: "conn-quantum-a",
      metaBusinessId: "3887084984861602",
      wabaId: "1053856057421351",
      phoneNumberId: "phone-jandira",
      displayPhoneNumber: "+55 11 95213-1900",
      verifiedName: "Relacionamento Deputada Jandira",
      status: "connected" as const,
    };
    const quantumB = {
      ...connectedRow(),
      id: "conn-quantum-b",
      metaBusinessId: "3887084984861602",
      wabaId: "1053856057421999",
      phoneNumberId: "phone-quantum-2",
      displayPhoneNumber: "+55 11 90000-2222",
      verifiedName: "Quantum Smart Labs 2",
      status: "connected" as const,
    };
    const repo = {
      async listOpenByTenant() {
        return [quantumA, quantumB];
      },
      async findOpenByTenant() {
        return quantumA;
      },
    };
    const graph = async (input: { path: string }) => {
      if (input.path === "1053856057421351") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1053856057421351",
            name: "Quantum WABA A",
            owner_business_info: { id: "3887084984861602", name: "Quantum Smart Labs" },
          },
        };
      }
      if (input.path === "1053856057421999") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1053856057421999",
            name: "Quantum WABA B",
            owner_business_info: { id: "3887084984861602", name: "Quantum Smart Labs" },
          },
        };
      }
      if (input.path === "3887084984861602") {
        return {
          ok: true,
          status: 200,
          json: { id: "3887084984861602", name: "Quantum Smart Labs" },
        };
      }
      if (input.path === "1053856057421351/phone_numbers") {
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "phone-jandira",
                display_phone_number: "+55 11 95213-1900",
                verified_name: "Relacionamento Deputada Jandira",
                status: "CONNECTED",
              },
            ],
          },
        };
      }
      if (input.path === "1053856057421999/phone_numbers") {
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "phone-quantum-2",
                display_phone_number: "+55 11 90000-2222",
                verified_name: "Quantum Smart Labs 2",
                status: "CONNECTED",
              },
            ],
          },
        };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      repo as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth, { connectionId: "conn-quantum-a" });
    const card = (assets.portfolios || []).find((item) => item.id === "3887084984861602");
    assert.ok(card);
    assert.equal((assets.portfolios || []).length, 1);
    assert.equal((card?.numbers || []).length, 2);
    assert.ok((card?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("95213-1900")));
    assert.ok((card?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("90000-2222")));
  });

  it("pagina phone_numbers da Graph e une todas as páginas", async () => {
    const quantum = {
      ...connectedRow(),
      id: "conn-quantum",
      metaBusinessId: "3887084984861602",
      wabaId: "1053856057421351",
      phoneNumberId: "phone-jandira",
      displayPhoneNumber: "+55 11 95213-1900",
      verifiedName: "Relacionamento Deputada Jandira",
      status: "connected" as const,
    };
    const repo = {
      async listOpenByTenant() {
        return [quantum];
      },
      async findOpenByTenant() {
        return quantum;
      },
    };
    const phoneCalls: Array<Record<string, string> | undefined> = [];
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      if (input.path === "1053856057421351") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1053856057421351",
            name: "Quantum WABA",
            owner_business_info: { id: "3887084984861602", name: "Quantum Smart Labs" },
          },
        };
      }
      if (input.path === "3887084984861602") {
        return { ok: true, status: 200, json: { id: "3887084984861602", name: "Quantum Smart Labs" } };
      }
      if (input.path === "1053856057421351/phone_numbers") {
        phoneCalls.push(input.query);
        if (!input.query?.after) {
          return {
            ok: true,
            status: 200,
            json: {
              data: [
                {
                  id: "phone-jandira",
                  display_phone_number: "+55 11 95213-1900",
                  verified_name: "Relacionamento Deputada Jandira",
                  status: "CONNECTED",
                },
              ],
              paging: { cursors: { after: "cursor-page-2" } },
            },
          };
        }
        assert.equal(input.query?.after, "cursor-page-2");
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "phone-quantum-2",
                display_phone_number: "+55 11 90000-2222",
                verified_name: "Quantum Smart Labs 2",
                status: "CONNECTED",
              },
            ],
          },
        };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      repo as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth);
    assert.equal(phoneCalls.length, 2);
    assert.equal((assets.numbers || []).length, 2);
    assert.ok((assets.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("95213-1900")));
    assert.ok((assets.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("90000-2222")));
  });

  it("fan-out BM→WABAs lista os 3 números Quantum com uma só conexão", async () => {
    // Produção: BM owned_* seco costuma 403 no token ES; nested + debug_token salvam SP/RJ.
    const previousAppId = process.env.META_APP_ID;
    const previousAppSecret = process.env.META_APP_SECRET;
    process.env.META_APP_ID = "meta-app-test";
    process.env.META_APP_SECRET = "meta-secret-test";
    const quantum = {
      ...connectedRow(),
      id: "conn-quantum-es",
      metaBusinessId: "3887084984861602",
      wabaId: "1056945243858578",
      phoneNumberId: "phone-es",
      displayPhoneNumber: "+55 27 92836-1199",
      verifiedName: "Quantum Smart Labs",
      status: "connected" as const,
    };
    const repo = {
      async listOpenByTenant() {
        return [quantum];
      },
      async findOpenByTenant() {
        return quantum;
      },
    };
    try {
      const graph = async (input: { path: string }) => {
        if (input.path === "1056945243858578") {
          return {
            ok: true,
            status: 200,
            json: {
              id: "1056945243858578",
              name: "Quantum WABA ES",
              owner_business_info: { id: "3887084984861602", name: "Quantum Smart Labs" },
            },
          };
        }
        if (input.path === "3887084984861602") {
          return {
            ok: true,
            status: 200,
            json: {
              id: "3887084984861602",
              name: "Quantum Smart Labs",
              owned_whatsapp_business_accounts: {
                data: [
                  {
                    id: "1056945243858578",
                    phone_numbers: {
                      data: [
                        {
                          id: "phone-es",
                          display_phone_number: "+55 27 92836-1199",
                          verified_name: "Quantum Smart Labs",
                          status: "CONNECTED",
                        },
                      ],
                    },
                  },
                  {
                    id: "waba-sp-quantum",
                    phone_numbers: {
                      data: [
                        {
                          id: "phone-sp",
                          display_phone_number: "+55 11 95213-1900",
                          verified_name: "Relacionamento Deputada Jandira",
                          status: "CONNECTED",
                        },
                      ],
                    },
                  },
                  {
                    id: "waba-rj-quantum",
                    phone_numbers: {
                      data: [
                        {
                          id: "phone-rj",
                          display_phone_number: "+55 21 92368-3286",
                          verified_name: "Quantum Smart Labs RJ",
                          status: "CONNECTED",
                        },
                      ],
                    },
                  },
                ],
              },
              client_whatsapp_business_accounts: { data: [] },
            },
          };
        }
        if (
          input.path === "3887084984861602/owned_whatsapp_business_accounts" ||
          input.path === "3887084984861602/client_whatsapp_business_accounts"
        ) {
          return { ok: false, status: 403, json: { error: { message: "permissions" } } };
        }
        if (input.path === "debug_token") {
          return {
            ok: true,
            status: 200,
            json: {
              data: {
                granular_scopes: [
                  {
                    scope: "whatsapp_business_management",
                    target_ids: ["1056945243858578", "waba-sp-quantum", "waba-rj-quantum"],
                  },
                ],
              },
            },
          };
        }
        if (input.path === "me/businesses") {
          return { ok: true, status: 200, json: { data: [] } };
        }
        if (input.path.endsWith("/phone_numbers")) {
          const table: Record<string, unknown> = {
            "1056945243858578/phone_numbers": {
              id: "phone-es",
              display_phone_number: "+55 27 92836-1199",
              verified_name: "Quantum Smart Labs",
              status: "CONNECTED",
            },
            "waba-sp-quantum/phone_numbers": {
              id: "phone-sp",
              display_phone_number: "+55 11 95213-1900",
              verified_name: "Relacionamento Deputada Jandira",
              status: "CONNECTED",
            },
            "waba-rj-quantum/phone_numbers": {
              id: "phone-rj",
              display_phone_number: "+55 21 92368-3286",
              verified_name: "Quantum Smart Labs RJ",
              status: "CONNECTED",
            },
          };
          const row = table[input.path];
          return { ok: true, status: 200, json: { data: row ? [row] : [] } };
        }
        return { ok: true, status: 200, json: { data: [] } };
      };
      const service = new MetaWhatsappConnectionService(
        repo as any,
        { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
        graph as any,
      );
      const assets = await service.listPortfolioAssets(auth);
      const card = (assets.portfolios || []).find((item) => item.id === "3887084984861602");
      assert.ok(card);
      assert.equal((card?.numbers || []).length, 3);
      assert.ok((card?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("92836-1199")));
      assert.ok((card?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("95213-1900")));
      assert.ok((card?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("92368-3286")));
    } finally {
      if (previousAppId === undefined) delete process.env.META_APP_ID;
      else process.env.META_APP_ID = previousAppId;
      if (previousAppSecret === undefined) delete process.env.META_APP_SECRET;
      else process.env.META_APP_SECRET = previousAppSecret;
    }
  });

  it("não lista pending_token vazio criado ao adicionar número em portfólio existente", async () => {
    const drax = {
      ...connectedRow(),
      id: "conn-drax",
      metaBusinessId: "1041827648719609",
      wabaId: "1247508354180311",
      displayPhoneNumber: "+55 51 8200-1279",
      verifiedName: "Drax Tecnologia e Sistemas",
    };
    const ghost = {
      ...connectedRow(),
      id: "conn-ghost",
      metaBusinessId: null,
      wabaId: null,
      phoneNumberId: null,
      displayPhoneNumber: null,
      verifiedName: null,
      status: "pending_token" as const,
    };
    const repo = {
      async listOpenByTenant() {
        return [drax, ghost];
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
    const assets = await service.listPortfolioAssets(auth);
    assert.equal((assets.portfolios || []).length, 1);
    assert.equal(assets.portfolios?.[0]?.id, "1041827648719609");
    assert.equal(assets.portfolios?.[0]?.connectionId, "conn-drax");
  });

  it("traz nome, ID, página e foto da Meta e não lista WABA como portfólio", async () => {
    const drax = {
      ...connectedRow(),
      id: "conn-drax",
      metaBusinessId: "1041827648719609",
      wabaId: "1247508354180311",
      displayPhoneNumber: "+55 51 8200-1279",
      verifiedName: null,
    };
    const wabaAsPortfolio = {
      ...connectedRow(),
      id: "conn-waba",
      metaBusinessId: "1247508354180311",
      wabaId: null,
      phoneNumberId: null,
      displayPhoneNumber: null,
      verifiedName: null,
    };
    const repo = {
      async listOpenByTenant() {
        return [drax, wabaAsPortfolio];
      },
      async findOpenByTenant() {
        return drax;
      },
    };
    const graph = async (input: { path: string }) => {
      if (input.path === "1247508354180311") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1247508354180311",
            name: "Conta WABA Drax",
            owner_business_info: {
              id: "1041827648719609",
              name: "Drax Sistemas",
              profile_picture_uri: "https://scontent.xx.fbcdn.net/v/drax.jpg",
            },
          },
        };
      }
      if (input.path === "1041827648719609") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1041827648719609",
            name: "Drax Sistemas",
            profile_picture_uri: "https://scontent.xx.fbcdn.net/v/drax.jpg",
            primary_page: { id: "page-drax", name: "Drax Tecnologia e Sistemas" },
          },
        };
      }
      if (input.path === "1247508354180311/phone_numbers") {
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "phone-drax",
                display_phone_number: "+55 51 8200-1279",
                verified_name: "Drax",
                status: "CONNECTED",
              },
            ],
          },
        };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      repo as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth);
    const cards = assets.portfolios || [];
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.id, "1041827648719609");
    assert.notEqual(cards[0]?.id, "1247508354180311");
    assert.equal(cards[0]?.name, "Drax Sistemas");
    assert.equal(cards[0]?.primaryPageName, "Drax Tecnologia e Sistemas");
    assert.equal(cards[0]?.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/drax.jpg");
    assert.equal(cards[0]?.wabaId, "1247508354180311");
    assert.ok((cards[0]?.numbers || []).some((item) => String(item.displayPhoneNumber || "").includes("8200-1279")));
  });

  it("não lista o ID 1350439411479507 se não houver telefone na Graph", async () => {
    const drax = {
      ...connectedRow(),
      metaBusinessId: "1041827648719609",
      wabaId: "1636793994538054",
      phoneNumberId: "1350439411479507",
      displayPhoneNumber: null,
      verifiedName: null,
    };
    const graph = async (input: { path: string }) => {
      if (input.path.endsWith("/phone_numbers")) {
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "phone-drax",
                display_phone_number: "+55 51 8200-1279",
                verified_name: "Drax Sistemas",
                status: "CONNECTED",
              },
              { id: "1350439411479507", status: "PENDING" },
            ],
          },
        };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      {
        async listOpenByTenant() {
          return [drax];
        },
        async findOpenByTenant() {
          return drax;
        },
      } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth);
    const numbers = (assets.portfolios || [])[0]?.numbers || [];
    assert.equal(numbers.length, 1);
    assert.ok(String(numbers[0]?.displayPhoneNumber || "").includes("8200-1279"));
    assert.ok(!numbers.some((item) => item.phoneNumberId === "1350439411479507"));
  });

  it("copia da Graph o nome, ID, página e foto iguais ao Business Manager", async () => {
    const drax = {
      ...connectedRow(),
      id: "conn-drax",
      metaBusinessId: "1041827648719609",
      wabaId: "1247508354180311",
      displayPhoneNumber: "+55 51 8200-1279",
      verifiedName: null,
    };
    const walkup = {
      ...connectedRow(),
      id: "conn-walkup",
      metaBusinessId: "4141369862822598",
      wabaId: "waba-walkup",
      phoneNumberId: "phone-walkup",
      displayPhoneNumber: "+55 11 95213-7761",
      verifiedName: null,
    };
    const repo = {
      async listOpenByTenant() {
        return [drax, walkup];
      },
      async findOpenByTenant() {
        return drax;
      },
    };
    const graph = async (input: { path: string }) => {
      if (input.path === "me/businesses") {
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "1041827648719609",
                name: "Drax Sistemas",
                profile_picture_uri: "https://scontent.xx.fbcdn.net/v/drax-logo.jpg",
                primary_page: { id: "page-drax", name: "Drax Sistemas e Tecnologia" },
              },
              {
                id: "4141369862822598",
                name: "Grupo Walkup",
                profile_picture_uri: "https://scontent.xx.fbcdn.net/v/walkup-logo.jpg",
                primary_page: { id: "page-walkup", name: "Grupo Walkup" },
              },
            ],
          },
        };
      }
      if (input.path.endsWith("/phone_numbers")) {
        const draxPhones = input.path.startsWith("1247508354180311");
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: draxPhones ? "phone-drax" : "phone-walkup",
                display_phone_number: draxPhones ? "+55 51 8200-1279" : "+55 11 95213-7761",
                status: "CONNECTED",
              },
            ],
          },
        };
      }
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      repo as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth);
    const cards = assets.portfolios || [];
    const draxCard = cards.find((item) => item.id === "1041827648719609");
    const walkupCard = cards.find((item) => item.id === "4141369862822598");
    assert.equal(cards.length, 2);
    assert.equal(draxCard?.name, "Drax Sistemas");
    assert.equal(draxCard?.id, "1041827648719609");
    assert.equal(draxCard?.primaryPageName, "Drax Sistemas e Tecnologia");
    assert.equal(draxCard?.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/drax-logo.jpg");
    assert.equal(walkupCard?.name, "Grupo Walkup");
    assert.equal(walkupCard?.id, "4141369862822598");
    assert.equal(walkupCard?.primaryPageName, "Grupo Walkup");
    assert.equal(walkupCard?.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/walkup-logo.jpg");
  });

  it("não substitui a Graph pelo nome salvo no Editar", async () => {
    writePortfolioIdentity(tenantId, { name: "Drax Sistemas" });
    const repo = {
      async findOpenByTenant() {
        return connectedRow();
      },
    };
    const graph = async () => ({ ok: true, status: 200, json: { data: [] } });
    const service = new MetaWhatsappConnectionService(
      repo as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth);
    assert.notEqual(assets.portfolio?.name, "Drax Sistemas");
  });

  it("traz Página e nome da Meta mesmo quando o Business se chama Portfólio empresarial", async () => {
    const row = {
      ...connectedRow(),
      metaBusinessId: "3887084984861602",
      wabaId: "405969599269224",
    };
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      if (input.path === "405969599269224") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "405969599269224",
            name: "Drax Sistemas",
            owner_business_info: { id: "3887084984861602", name: "Portfólio empresarial" },
          },
        };
      }
      if (input.path === "me/businesses") {
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "3887084984861602",
                name: "Portfólio empresarial",
                primary_page: { id: "page-drax", name: "Drax Sistemas e Tecnologia" },
                profile_picture_uri: "https://scontent.xx.fbcdn.net/v/drax-logo.jpg",
              },
            ],
          },
        };
      }
      if (input.path === "3887084984861602") {
        return { ok: true, status: 200, json: { id: "3887084984861602", name: "Portfólio empresarial" } };
      }
      if (input.path.endsWith("/phone_numbers")) {
        return { ok: true, status: 200, json: { data: [] } };
      }
      return { ok: false, status: 400, json: { error: { code: 100 } } };
    };
    const service = new MetaWhatsappConnectionService(
      {
        async listOpenByTenant() {
          return [row];
        },
        async findOpenByTenant() {
          return row;
        },
      } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth);
    assert.equal(assets.portfolio?.id, "3887084984861602");
    assert.equal(assets.portfolio?.name, "Drax Sistemas");
    assert.equal(assets.portfolio?.primaryPageName, "Drax Sistemas e Tecnologia");
    assert.equal(assets.portfolio?.wabaId, "405969599269224");
  });

  it("reaproveita nome e Página da última leitura da Graph se a Meta vier vazia", async () => {
    const row = {
      ...connectedRow(),
      metaBusinessId: "3887084984861602",
      wabaId: "405969599269224",
    };
    let empty = false;
    const graph = async (input: { path: string }) => {
      if (empty) return { ok: true, status: 200, json: { data: [] } };
      if (input.path === "405969599269224") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "405969599269224",
            name: "Drax Sistemas",
            owner_business_info: {
              id: "3887084984861602",
              name: "Drax Sistemas",
              primary_page: { id: "page-drax", name: "Drax Sistemas e Tecnologia" },
            },
          },
        };
      }
      if (input.path === "3887084984861602") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "3887084984861602",
            name: "Drax Sistemas",
            primary_page: { id: "page-drax", name: "Drax Sistemas e Tecnologia" },
          },
        };
      }
      if (input.path.endsWith("/phone_numbers")) return { ok: true, status: 200, json: { data: [] } };
      return { ok: true, status: 200, json: { data: [] } };
    };
    const service = new MetaWhatsappConnectionService(
      {
        async listOpenByTenant() {
          return [row];
        },
        async findOpenByTenant() {
          return row;
        },
      } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const first = await service.listPortfolioAssets(auth);
    assert.equal(first.portfolio?.primaryPageName, "Drax Sistemas e Tecnologia");
    empty = true;
    const second = await service.listPortfolioAssets(auth);
    assert.equal(second.portfolio?.name, "Drax Sistemas");
    assert.equal(second.portfolio?.primaryPageName, "Drax Sistemas e Tecnologia");
  });

  it("não cria card extra do Walkup sem conexão gravada", async () => {
    const drax = {
      ...connectedRow(),
      metaBusinessId: "1041827648719609",
      wabaId: "1636793994538054",
      verifiedName: null,
    };
    const seen: string[] = [];
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      seen.push(input.path);
      const fields = String(input.query?.fields || "");
      if (input.path === "1041827648719609" && (fields === "id,name" || fields.includes("owner_business_info"))) {
        return { ok: true, status: 200, json: { id: "1041827648719609", name: "Drax Sistemas" } };
      }
      if (input.path === "1041827648719609" && fields.includes("primary_page")) {
        return {
          ok: true,
          status: 200,
          json: { id: "1041827648719609", primary_page: { id: "page-drax", name: "Drax Sistemas e Tecnologia" } },
        };
      }
      if (input.path === "1041827648719609" && fields === "profile_picture_uri") {
        return { ok: true, status: 200, json: { profile_picture_uri: "https://scontent.xx.fbcdn.net/v/drax.jpg" } };
      }
      if (input.path === "4141369862822598" && (fields === "id,name" || fields.includes("owner_business_info"))) {
        return { ok: true, status: 200, json: { id: "4141369862822598", name: "Grupo Walkup" } };
      }
      if (input.path === "4141369862822598" && fields.includes("primary_page")) {
        return {
          ok: true,
          status: 200,
          json: { id: "4141369862822598", primary_page: { id: "page-walkup", name: "Grupo Walkup" } },
        };
      }
      if (input.path === "4141369862822598" && fields === "profile_picture_uri") {
        return { ok: true, status: 200, json: { profile_picture_uri: "https://scontent.xx.fbcdn.net/v/walkup.jpg" } };
      }
      if (input.path === "1636793994538054" || input.path.endsWith("/phone_numbers")) {
        return {
          ok: true,
          status: 200,
          json: {
            data: [{ id: "phone-1", display_phone_number: "+55 51 8200-1279", status: "CONNECTED" }],
            id: input.path === "1636793994538054" ? "1636793994538054" : undefined,
            owner_business_info: input.path === "1636793994538054"
              ? { id: "1041827648719609", name: "Drax Sistemas" }
              : undefined,
          },
        };
      }
      return { ok: false, status: 400, json: { error: { code: 100 } } };
    };
    const service = new MetaWhatsappConnectionService(
      {
        async listOpenByTenant() {
          return [drax];
        },
        async findOpenByTenant() {
          return drax;
        },
      } as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      graph as any,
    );
    const assets = await service.listPortfolioAssets(auth);
    const cards = assets.portfolios || [];
    const draxCard = cards.find((item) => item.id === "1041827648719609");
    const walkupCard = cards.find((item) => item.id === "4141369862822598");
    assert.equal(draxCard?.name, "Drax Sistemas");
    assert.equal(draxCard?.id, "1041827648719609");
    assert.equal(draxCard?.primaryPageName, "Drax Sistemas e Tecnologia");
    assert.equal(walkupCard, undefined);
    assert.ok(!seen.includes("4141369862822598"));
  });

  it("apaga todas as conexões do Laboratório para recomeçar do zero", async () => {
    const row: MetaWhatsappConnectionRecord = { ...connectedRow(), status: "connected" };
    const repo = {
      rows: [row] as MetaWhatsappConnectionRecord[],
      async findOpenByTenant() {
        return this.rows.find((item) => !item.disconnectedAt) || null;
      },
      async listOpenByTenant() {
        return this.rows.filter((item) => !item.disconnectedAt);
      },
      async disconnectOpenByTenant() {
        const count = this.rows.filter((item) => !item.disconnectedAt).length;
        this.rows.forEach((item) => {
          item.status = "disconnected";
          item.disconnectedAt = new Date().toISOString();
          item.accessTokenEncrypted = "";
        });
        return count;
      },
    };
    writePortfolioIdentity(tenantId, { name: "Drax Sistemas" });
    const service = new MetaWhatsappConnectionService(
      repo as any,
      { exchangeEmbeddedSignupCode: async () => ({ accessToken: "x", tokenType: "bearer", expiresIn: 1 }) },
      (async () => ({ ok: true, status: 200, json: { data: [] } })) as any,
    );
    const result = await service.disconnectOfficialLabFromAuth(auth);
    assert.equal(result.disconnected, 1);
    assert.equal(result.portfolio, null);
    assert.deepEqual(result.portfolios, []);
    assert.equal(await repo.findOpenByTenant(), null);
  });
});

describe("meta portfolio graph", () => {
  it("lê nome e página da Meta em GETs separados", async () => {
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      const fields = String(input.query?.fields || "");
      if (input.path === "1041827648719609" && fields === "id,name") {
        return { ok: true, status: 200, json: { id: "1041827648719609", name: "Drax Sistemas" } };
      }
      if (input.path === "1041827648719609" && fields.includes("primary_page")) {
        return {
          ok: true,
          status: 200,
          json: { id: "1041827648719609", primary_page: { id: "page-drax", name: "Drax Sistemas e Tecnologia" } },
        };
      }
      if (input.path === "1041827648719609" && fields === "profile_picture_uri") {
        return { ok: true, status: 200, json: { profile_picture_uri: "https://scontent.xx.fbcdn.net/v/drax.jpg" } };
      }
      return { ok: false, status: 400, json: { error: { code: 100 } } };
    };
    const fetched = await fetchBusinessFromGraph(graph as any, "token", "1041827648719609");
    assert.equal(fetched.card?.name, "Drax Sistemas");
    assert.equal(fetched.card?.id, "1041827648719609");
    assert.equal(fetched.card?.primaryPageName, "Drax Sistemas e Tecnologia");
    assert.equal(fetched.card?.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/drax.jpg");
  });

  it("usa GET /picture do Business quando profile_picture_uri não vem", async () => {
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      const fields = String(input.query?.fields || "");
      if (input.path === "4141369862822598" && fields === "id,name") {
        return { ok: true, status: 200, json: { id: "4141369862822598", name: "Grupo Walkup" } };
      }
      if (input.path === "4141369862822598/picture") {
        return {
          ok: true,
          status: 200,
          json: { data: { url: "https://scontent.xx.fbcdn.net/v/walkup-logo.jpg", is_silhouette: false } },
        };
      }
      return { ok: false, status: 400, json: { error: { code: 100 } } };
    };
    const fetched = await fetchBusinessFromGraph(graph as any, "token", "4141369862822598");
    assert.equal(fetched.card?.name, "Grupo Walkup");
    assert.equal(fetched.card?.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/walkup-logo.jpg");
    assert.match(String(fetched.photoDownloadUrl || ""), /walkup-logo/);
  });

  it("só inclui Drax e Walkup quando a Graph devolve id e nome", async () => {
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      const fields = String(input.query?.fields || "");
      if (input.path === "1041827648719609" && fields === "id,name") {
        return { ok: true, status: 200, json: { id: "1041827648719609", name: "Drax Sistemas" } };
      }
      if (input.path === "1041827648719609" && fields.includes("primary_page")) {
        return {
          ok: true,
          status: 200,
          json: { id: "1041827648719609", primary_page: { id: "page-drax", name: "Drax Sistemas e Tecnologia" } },
        };
      }
      if (input.path === "4141369862822598" && fields === "id,name") {
        return { ok: true, status: 200, json: { id: "4141369862822598", name: "Grupo Walkup" } };
      }
      if (input.path === "4141369862822598" && fields.includes("primary_page")) {
        return {
          ok: true,
          status: 200,
          json: { id: "4141369862822598", primary_page: { id: "page-walkup", name: "Grupo Walkup" } },
        };
      }
      return { ok: false, status: 400, json: { error: { code: 100 } } };
    };
    const cards = await fetchKnownBusinessPortfolios(graph as any, "token");
    const drax = cards.find((item) => item.id === "1041827648719609");
    const walkup = cards.find((item) => item.id === "4141369862822598");
    assert.equal(cards.length, 2);
    assert.equal(drax?.name, "Drax Sistemas");
    assert.equal(drax?.id, "1041827648719609");
    assert.equal(drax?.primaryPageName, "Drax Sistemas e Tecnologia");
    assert.equal(walkup?.name, "Grupo Walkup");
    assert.equal(walkup?.id, "4141369862822598");
    assert.equal(walkup?.primaryPageName, "Grupo Walkup");
  });

  it("lê o nome da Página quando a Graph só devolve o ID", async () => {
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      const fields = String(input.query?.fields || "");
      if (input.path === "4141369862822598" && fields === "id,name") {
        return { ok: true, status: 200, json: { id: "4141369862822598", name: "Grupo Walkup" } };
      }
      if (input.path === "4141369862822598" && fields.includes("primary_page")) {
        return { ok: true, status: 200, json: { id: "4141369862822598", primary_page: { id: "page-walkup" } } };
      }
      if (input.path === "page-walkup" && fields.includes("id,name")) {
        return { ok: true, status: 200, json: { id: "page-walkup", name: "Grupo Walkup" } };
      }
      return { ok: false, status: 400, json: { error: { code: 100 } } };
    };
    const fetched = await fetchBusinessFromGraph(graph as any, "token", "4141369862822598");
    assert.equal(fetched.card?.name, "Grupo Walkup");
    assert.equal(fetched.card?.primaryPageId, "page-walkup");
    assert.equal(fetched.card?.primaryPageName, "Grupo Walkup");
  });

  it("lê a Página em assigned_pages quando owned_pages vem vazio", async () => {
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      const fields = String(input.query?.fields || "");
      if (input.path === "4141369862822598" && fields === "id,name") {
        return { ok: true, status: 200, json: { id: "4141369862822598", name: "Grupo Walkup" } };
      }
      if (input.path === "4141369862822598/assigned_pages") {
        return {
          ok: true,
          status: 200,
          json: { data: [{ id: "page-walkup", name: "Grupo Walkup" }] },
        };
      }
      return { ok: false, status: 400, json: { error: { code: 100 } } };
    };
    const fetched = await fetchBusinessFromGraph(graph as any, "token", "4141369862822598");
    assert.equal(fetched.card?.primaryPageName, "Grupo Walkup");
    assert.equal(fetched.card?.primaryPageId, "page-walkup");
  });

  it("não mistura o GET da WABA com primary_page aninhado", async () => {
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      const fields = String(input.query?.fields || "");
      if (fields === "id,name,owner_business_info,on_behalf_of_business_info") {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1014470201624992",
            name: "Walkup WABA",
            owner_business_info: { id: "4141369862822598", name: "Grupo Walkup" },
          },
        };
      }
      if (fields.includes("primary_page")) {
        return {
          ok: true,
          status: 200,
          json: {
            id: "1014470201624992",
            owner_business_info: {
              id: "4141369862822598",
              name: "Grupo Walkup",
              primary_page: { id: "page-walkup", name: "Grupo Walkup" },
            },
          },
        };
      }
      return { ok: false, status: 400, json: { error: { code: 100 } } };
    };
    const waba = await fetchWabaOwner(graph as any, "token", "1014470201624992");
    assert.equal(waba.ok, true);
    assert.equal(waba.hint.businessId, "4141369862822598");
    assert.equal(waba.hint.primaryPageName, "Grupo Walkup");
  });

  it("preenche Página e foto pelas páginas do token quando o Business não traz primary_page", async () => {
    const graph = async (input: { path: string; query?: Record<string, string> }) => {
      const fields = String(input.query?.fields || "");
      if (input.path === "4141369862822598" && fields === "id,name") {
        return { ok: true, status: 200, json: { id: "4141369862822598", name: "Grupo Walkup" } };
      }
      if (input.path === "me/accounts") {
        return {
          ok: true,
          status: 200,
          json: {
            data: [
              {
                id: "page-walkup",
                name: "Grupo Walkup",
                picture: { data: { url: "https://scontent.xx.fbcdn.net/v/walkup-page.jpg", is_silhouette: false } },
                business: { id: "4141369862822598" },
              },
            ],
          },
        };
      }
      return { ok: false, status: 400, json: { error: { code: 100 } } };
    };
    const fetched = await fetchBusinessFromGraph(graph as any, "token", "4141369862822598");
    assert.equal(fetched.card?.name, "Grupo Walkup");
    assert.equal(fetched.card?.id, "4141369862822598");
    assert.equal(fetched.card?.primaryPageName, "Grupo Walkup");
    assert.equal(fetched.card?.primaryPageId, "page-walkup");
    assert.equal(fetched.card?.profilePictureUrl, "https://scontent.xx.fbcdn.net/v/walkup-page.jpg");
  });

  it("identifica a mesma foto da Meta mesmo com query string da CDN", () => {
    assert.equal(
      graphPhotoSourceKey("https://scontent.xx.fbcdn.net/v/t39.30808-1/walkup.jpg?_nc_cat=1&oe=ABC"),
      graphPhotoSourceKey("https://scontent.xx.fbcdn.net/v/t39.30808-1/walkup.jpg?_nc_cat=2&oe=XYZ"),
    );
    assert.notEqual(
      graphPhotoSourceKey("https://scontent.xx.fbcdn.net/v/t39.30808-1/walkup.jpg"),
      graphPhotoSourceKey("https://scontent.xx.fbcdn.net/v/t39.30808-1/walkup-nova.jpg"),
    );
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
