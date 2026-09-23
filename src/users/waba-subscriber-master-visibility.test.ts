import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WALKUP_MASTER_EMAIL,
  canViewerSeeSubscriber,
  defaultVisibleToMastersOnRegister,
  isWalkupMasterEmail,
  resolveSubscriberOrigin,
  resolveVisibleMasterProfitPercents,
} from "./waba-subscriber-master-visibility";

const EDUARDO = "eduardo.master@exemplo.com";
const users = [
  { id: "u-eduardo", email: EDUARDO, fullName: "Eduardo Silva", role: "master" },
  { id: "u-walkup", email: WALKUP_MASTER_EMAIL, fullName: "Walkup", role: "master" },
  { id: "ind-1", email: "joao.indicador@exemplo.com", fullName: "João Indicador", role: "indicador" },
];

const participants = [
  { id: "edu", label: "Eduardo", email: EDUARDO, sharePercent: 50 },
  { id: "wk", label: "Walkup", email: WALKUP_MASTER_EMAIL, sharePercent: 50 },
];

describe("origem e visibilidade do assinante para masters", () => {
  it("landing page vira Origem Site", () => {
    assert.deepEqual(resolveSubscriberOrigin({ email: "a@x.com" }, users), {
      kind: "site",
      label: "Site",
      userEmail: "",
    });
  });

  it("cadastro por usuário mostra o nome da pessoa", () => {
    assert.deepEqual(
      resolveSubscriberOrigin({ email: "a@x.com", createdByEmail: EDUARDO }, users),
      { kind: "user", label: "Eduardo Silva", userEmail: EDUARDO },
    );
    assert.deepEqual(
      resolveSubscriberOrigin({ email: "a@x.com", indicatorUserId: "ind-1" }, users),
      { kind: "user", label: "João Indicador", userEmail: "joao.indicador@exemplo.com" },
    );
  });

  it("Walkup sempre vê; outros masters só se o liga/desliga estiver ligado", () => {
    assert.equal(isWalkupMasterEmail(WALKUP_MASTER_EMAIL), true);
    const hidden = { email: "site@x.com", visibleToMasters: false };
    const shown = { email: "site@x.com", visibleToMasters: true };
    const legacy = { email: "velho@x.com" };
    assert.equal(canViewerSeeSubscriber(WALKUP_MASTER_EMAIL, hidden), true);
    assert.equal(canViewerSeeSubscriber(EDUARDO, hidden), false);
    assert.equal(canViewerSeeSubscriber(EDUARDO, shown), true);
    assert.equal(canViewerSeeSubscriber(EDUARDO, legacy), true);
  });

  it("cadastro do site nasce oculto; cadastro por usuário nasce visível", () => {
    assert.equal(defaultVisibleToMastersOnRegister({}), false);
    assert.equal(defaultVisibleToMastersOnRegister({ createdByEmail: EDUARDO }), true);
    assert.equal(defaultVisibleToMastersOnRegister({ indicatorUserId: "ind-1" }), true);
  });

  it("split oculto vai 100% Walkup; visível mantém 50/50 da config", () => {
    const hidden = resolveVisibleMasterProfitPercents(participants, {
      email: "site@x.com",
      visibleToMasters: false,
    });
    assert.deepEqual(
      hidden.map((item) => item.sharePercent),
      [0, 100],
    );
    assert.deepEqual(
      participants.map((item) => item.sharePercent),
      [50, 50],
    );
    const shown = resolveVisibleMasterProfitPercents(participants, {
      email: "dele@x.com",
      visibleToMasters: true,
    });
    assert.deepEqual(
      shown.map((item) => item.sharePercent),
      [50, 50],
    );
  });
});
