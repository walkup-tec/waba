import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EDUARDO_MASTER_SCOPE_SINCE_ISO,
  canViewerSeeCampaign,
  canViewerSeeFinanceiroOrder,
  canViewerSeeSubscriber,
  isEduardoScopedMaster,
  isOnOrAfterEduardoMasterScope,
  resolveEduardoOriginProfitPercents,
} from "./waba-eduardo-master-scope";

const EDUARDO = "eduardo.master@exemplo.com";
const WALKUP = "walkup@walkuptec.com.br";
const users = [
  { email: EDUARDO, fullName: "Eduardo Silva", role: "master" },
  { email: WALKUP, fullName: "Walkup", role: "master" },
];

const participants = [
  { id: "edu", label: "Eduardo", email: EDUARDO, sharePercent: 50 },
  { id: "wk", label: "Walkup", email: WALKUP, sharePercent: 50 },
];

describe("escopo Master Eduardo a partir de 23/09/2026", () => {
  it("reconhece o master Eduardo pelo nome e não restringe o Walkup", () => {
    assert.equal(isEduardoScopedMaster(EDUARDO, users), true);
    assert.equal(isEduardoScopedMaster(WALKUP, users), false);
    assert.equal(isOnOrAfterEduardoMasterScope("2026-09-22T23:00:00.000Z"), false);
    assert.equal(isOnOrAfterEduardoMasterScope(EDUARDO_MASTER_SCOPE_SINCE_ISO), true);
  });

  it("Eduardo continua vendo assinante anterior à data de corte", () => {
    assert.equal(
      canViewerSeeSubscriber(
        EDUARDO,
        { email: "velho@x.com", createdAt: "2026-09-10T12:00:00.000Z" },
        users,
      ),
      true,
    );
  });

  it("Eduardo só vê assinante novo se ele mesmo cadastrou", () => {
    const his = {
      email: "dele@x.com",
      createdAt: "2026-09-23T12:00:00.000Z",
      createdByEmail: EDUARDO,
    };
    const other = {
      email: "outro@x.com",
      createdAt: "2026-09-23T12:00:00.000Z",
      createdByEmail: WALKUP,
    };
    const signup = {
      email: "site@x.com",
      createdAt: "2026-09-23T12:00:00.000Z",
    };
    assert.equal(canViewerSeeSubscriber(EDUARDO, his, users), true);
    assert.equal(canViewerSeeSubscriber(EDUARDO, other, users), false);
    assert.equal(canViewerSeeSubscriber(EDUARDO, signup, users), false);
    assert.equal(canViewerSeeSubscriber(WALKUP, other, users), true);
  });

  it("campanha/pedido novos de outro canal ficam ocultos; os antigos permanecem", () => {
    const other = {
      email: "outro@x.com",
      createdAt: "2026-09-23T12:00:00.000Z",
      createdByEmail: WALKUP,
    };
    assert.equal(
      canViewerSeeCampaign(EDUARDO, "2026-09-10T12:00:00.000Z", other, users),
      true,
    );
    assert.equal(
      canViewerSeeCampaign(EDUARDO, "2026-09-23T15:00:00.000Z", other, users),
      false,
    );
    assert.equal(
      canViewerSeeFinanceiroOrder(EDUARDO, "2026-09-23T15:00:00.000Z", other, users),
      false,
    );
  });

  it("split novo de outro canal vai 100% para Walkup; config 50/50 não é alterada", () => {
    const other = {
      email: "site@x.com",
      createdAt: "2026-09-23T12:00:00.000Z",
    };
    const his = {
      email: "dele@x.com",
      createdAt: "2026-09-23T12:00:00.000Z",
      createdByEmail: EDUARDO,
    };
    const oldSub = {
      email: "velho@x.com",
      createdAt: "2026-09-01T12:00:00.000Z",
    };
    const otherPercents = resolveEduardoOriginProfitPercents(
      participants,
      other,
      "2026-09-23T16:00:00.000Z",
      users,
    );
    assert.deepEqual(
      otherPercents.map((item) => item.sharePercent),
      [0, 100],
    );
    assert.deepEqual(
      participants.map((item) => item.sharePercent),
      [50, 50],
    );
    const hisPercents = resolveEduardoOriginProfitPercents(
      participants,
      his,
      "2026-09-23T16:00:00.000Z",
      users,
    );
    assert.deepEqual(
      hisPercents.map((item) => item.sharePercent),
      [50, 50],
    );
    const oldPercents = resolveEduardoOriginProfitPercents(
      participants,
      oldSub,
      "2026-09-23T16:00:00.000Z",
      users,
    );
    assert.deepEqual(
      oldPercents.map((item) => item.sharePercent),
      [50, 50],
    );
    const historicPayment = resolveEduardoOriginProfitPercents(
      participants,
      other,
      "2026-09-20T16:00:00.000Z",
      users,
    );
    assert.deepEqual(
      historicPayment.map((item) => item.sharePercent),
      [50, 50],
    );
  });
});
