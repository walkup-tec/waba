import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import {
  applyLocalPhoneIdentities,
  isInboxPhoneAllowed,
  isPhoneInboxEligible,
  listEnabledInboxPhoneIds,
  listPhoneInboxChannels,
  purgePhoneIdentities,
  writePhoneIdentity,
} from "./meta-whatsapp-phone-identity.store";
import { hideBusiness, unhideBusiness } from "./meta-whatsapp-hidden-business.store";
import type { MetaPortfolioNumberPublic } from "./meta-whatsapp-portfolio.types";

const tenantId = deriveStableMetaTenantId("inbox-eligible@exemplo.com");

const number = (overrides: Partial<MetaPortfolioNumberPublic> = {}): MetaPortfolioNumberPublic => ({
  phoneNumberId: "phone-1",
  displayPhoneNumber: "+55 11 95213-7761",
  verifiedName: "Grupo Walkup",
  qualityRating: null,
  metaStatus: "CONNECTED",
  codeVerificationStatus: "VERIFIED",
  healthCanSend: null,
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
  inboxEnabled: false,
  ...overrides,
});

describe("Atendimento só lista chip Ativo com Inbox", () => {
  it("Inbox ligado sem status gravado continua elegível (legado)", () => {
    purgePhoneIdentities(tenantId);
    writePhoneIdentity(tenantId, "phone-1", { inboxEnabled: true, channelName: "Drax Sistema" });
    assert.equal(isPhoneInboxEligible(null), false);
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), ["phone-1"]);
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.inboxEligible, true);
    purgePhoneIdentities(tenantId);
  });

  it("Inbox ligado em chip Ativo entra no Atendimento", () => {
    purgePhoneIdentities(tenantId);
    writePhoneIdentity(tenantId, "phone-1", { inboxEnabled: true });
    applyLocalPhoneIdentities(tenantId, [number({ metaStatus: "CONNECTED", uiStatus: "ativo" })]);
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), ["phone-1"]);
    purgePhoneIdentities(tenantId);
  });

  it("Inbox ligado em restrito/desativado some do Atendimento", () => {
    purgePhoneIdentities(tenantId);
    writePhoneIdentity(tenantId, "phone-1", { inboxEnabled: true });
    applyLocalPhoneIdentities(tenantId, [number({ metaStatus: "DISABLED", uiStatus: "restrito" })]);
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), []);
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.inboxEnabled, true);
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.inboxEligible, false);
    purgePhoneIdentities(tenantId);
  });

  it("Inbox ligado em Pendente some do Atendimento", () => {
    purgePhoneIdentities(tenantId);
    writePhoneIdentity(tenantId, "phone-1", { inboxEnabled: true });
    applyLocalPhoneIdentities(tenantId, [number({ metaStatus: "DISCONNECTED", uiStatus: "pendente" })]);
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), []);
    purgePhoneIdentities(tenantId);
  });

  it("BOT ligado entra na lista de Bots mesmo sem Inbox", () => {
    purgePhoneIdentities(tenantId);
    writePhoneIdentity(tenantId, "phone-1", { botEnabled: true, inboxEnabled: false });
    const channel = listPhoneInboxChannels(tenantId)[0];
    assert.equal(channel?.botEnabled, true);
    assert.equal(channel?.botEligible, true);
    assert.equal(channel?.inboxEligible, false);
    purgePhoneIdentities(tenantId);
  });

  it("chip Ativo sem Inbox não entra no Atendimento", () => {
    purgePhoneIdentities(tenantId);
    writePhoneIdentity(tenantId, "phone-1", { inboxEnabled: false });
    applyLocalPhoneIdentities(tenantId, [number({ metaStatus: "CONNECTED", uiStatus: "ativo" })]);
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), []);
    const channel = listPhoneInboxChannels(tenantId)[0];
    assert.equal(channel?.inboxEligible, false);
    assert.equal(channel?.botEligible, false);
    purgePhoneIdentities(tenantId);
  });

  it("número de portfólio em Restritas some do Atendimento", () => {
    purgePhoneIdentities(tenantId);
    writePhoneIdentity(tenantId, "phone-1", { inboxEnabled: true });
    applyLocalPhoneIdentities(
      tenantId,
      [number({ metaStatus: "CONNECTED", uiStatus: "ativo" })],
      null,
      { hidden: true },
    );
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), []);
    purgePhoneIdentities(tenantId);
  });

  it("chip Inbox Ativo em ATIVAS entra mesmo se a conexão tiver display de outro número", () => {
    const draxBm = "1041827648719609";
    purgePhoneIdentities(tenantId);
    unhideBusiness(tenantId, draxBm);
    writePhoneIdentity(tenantId, "phone-rel", {
      inboxEnabled: true,
      uiStatus: "ativo",
      portfolioHidden: false,
      displayPhoneNumber: "51926361688",
      channelName: "Relacionamento e Atendimento",
    });
    writePhoneIdentity(tenantId, "phone-novo", {
      inboxEnabled: true,
      uiStatus: "ativo",
      portfolioHidden: false,
      displayPhoneNumber: "+55 11 98888-7777",
      channelName: "Novo Inbox",
    });
    hideBusiness(tenantId, draxBm, "BAN Drax Sistemas");
    const staleConn = {
      phoneNumberId: "phone-rel",
      displayPhoneNumber: "+55 51 8200-1279",
      metaBusinessId: draxBm,
      wabaId: "1636793994538054",
    };
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId, [staleConn]).sort(), ["phone-novo", "phone-rel"]);
    unhideBusiness(tenantId, draxBm);
    purgePhoneIdentities(tenantId);
  });

  it("5182001279 não entra no Atendimento mesmo com Inbox ligado e conta ainda listada", () => {
    const businessId = "1041827648719609";
    const restrictedConn = {
      phoneNumberId: "phone-1",
      displayPhoneNumber: "+55 51 8200-1279",
      metaBusinessId: businessId,
    };
    purgePhoneIdentities(tenantId);
    unhideBusiness(tenantId, businessId);
    writePhoneIdentity(tenantId, "phone-1", {
      inboxEnabled: true,
      uiStatus: "ativo",
      displayPhoneNumber: "+55 51 8200-1279",
      channelName: "Drax Sistema",
    });
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), []);
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId, [restrictedConn]), []);
    assert.equal(listPhoneInboxChannels(tenantId)[0]?.inboxEligible, false);
    assert.equal(isInboxPhoneAllowed(tenantId, "phone-1", ["phone-1"], [restrictedConn]), false);
    purgePhoneIdentities(tenantId);
  });

  it("identidade com businessId em Restritas some sem esperar o Laboratório", () => {
    const businessId = "1041827648719609";
    purgePhoneIdentities(tenantId);
    unhideBusiness(tenantId, businessId);
    writePhoneIdentity(tenantId, "phone-1", {
      inboxEnabled: true,
      uiStatus: "ativo",
      businessId,
      displayPhoneNumber: "+55 51 8200-1279",
    });
    hideBusiness(tenantId, businessId, "BAN Drax Sistemas");
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), []);
    unhideBusiness(tenantId, businessId);
    purgePhoneIdentities(tenantId);
  });

  it("5182001279 some só com a conta Drax em Restritas, sem conexão aberta", () => {
    const businessId = "1041827648719609";
    purgePhoneIdentities(tenantId);
    unhideBusiness(tenantId, businessId);
    writePhoneIdentity(tenantId, "1350439411479507", {
      inboxEnabled: true,
      uiStatus: "ativo",
      displayPhoneNumber: "+55 51 8200-1279",
      channelName: "Drax Sistema",
    });
    hideBusiness(tenantId, businessId, "BAN Drax Sistemas");
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), []);
    assert.deepEqual(
      listEnabledInboxPhoneIds(tenantId, [
        {
          phoneNumberId: "1350439411479507",
          displayPhoneNumber: "+55 51 8200-1279",
          metaBusinessId: "1247508354180311",
          wabaId: "1988957871663919",
        },
      ]),
      [],
    );
    unhideBusiness(tenantId, businessId);
    purgePhoneIdentities(tenantId);
  });

  it("conexão sem BM, só WABA Drax stale, some quando a conta vai para Restritas", () => {
    const businessId = "1041827648719609";
    purgePhoneIdentities(tenantId);
    unhideBusiness(tenantId, businessId);
    writePhoneIdentity(tenantId, "phone-1", {
      inboxEnabled: true,
      uiStatus: "ativo",
      displayPhoneNumber: "+55 51 8200-1279",
      channelName: "Drax Sistema",
    });
    hideBusiness(tenantId, businessId, "BAN Drax Sistemas");
    assert.deepEqual(
      listEnabledInboxPhoneIds(tenantId, [
        {
          phoneNumberId: "phone-1",
          displayPhoneNumber: "+55 51 8200-1279",
          metaBusinessId: null,
          wabaId: "1988957871663919",
        },
      ]),
      [],
    );
    unhideBusiness(tenantId, businessId);
    purgePhoneIdentities(tenantId);
  });

  it("chip Drax some mesmo se a conexão aberta for de outro portfólio", () => {
    const businessId = "1041827648719609";
    purgePhoneIdentities(tenantId);
    unhideBusiness(tenantId, businessId);
    writePhoneIdentity(tenantId, "phone-drax", {
      inboxEnabled: true,
      uiStatus: "ativo",
      displayPhoneNumber: "+55 51 8200-1279",
      channelName: "Drax Sistema",
    });
    hideBusiness(tenantId, businessId, "BAN Drax Sistemas");
    assert.deepEqual(
      listEnabledInboxPhoneIds(tenantId, [
        {
          phoneNumberId: "phone-walkup",
          displayPhoneNumber: "+55 11 95213-7761",
          metaBusinessId: "4141369862822598",
        },
      ]),
      [],
    );
    unhideBusiness(tenantId, businessId);
    purgePhoneIdentities(tenantId);
  });
});
