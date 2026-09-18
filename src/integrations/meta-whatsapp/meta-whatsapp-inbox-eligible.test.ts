import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import {
  applyLocalPhoneIdentities,
  isPhoneInboxEligible,
  listEnabledInboxPhoneIds,
  listPhoneInboxChannels,
  purgePhoneIdentities,
  writePhoneIdentity,
} from "./meta-whatsapp-phone-identity.store";
import type { MetaPortfolioNumberPublic } from "./meta-whatsapp-portfolio.types";

const tenantId = deriveStableMetaTenantId("inbox-eligible@exemplo.com");

const number = (overrides: Partial<MetaPortfolioNumberPublic> = {}): MetaPortfolioNumberPublic => ({
  phoneNumberId: "phone-1",
  displayPhoneNumber: "+55 51 8200-1279",
  verifiedName: "Drax Sistema",
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

  it("chip Ativo sem Inbox não entra no Atendimento", () => {
    purgePhoneIdentities(tenantId);
    writePhoneIdentity(tenantId, "phone-1", { inboxEnabled: false });
    applyLocalPhoneIdentities(tenantId, [number({ metaStatus: "CONNECTED", uiStatus: "ativo" })]);
    assert.deepEqual(listEnabledInboxPhoneIds(tenantId), []);
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
});
