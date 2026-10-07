import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WALKUP_MASTER_EMAIL,
  isWalkupMasterEmail,
  resolveSubscriberOrigin,
} from "./waba-subscriber-master-visibility";

const MASTER = "carla.master@exemplo.com";
const users = [
  { id: "u-master", email: MASTER, fullName: "Carla Master", role: "master" },
  { id: "u-walkup", email: WALKUP_MASTER_EMAIL, fullName: "Walkup", role: "master" },
  { id: "ind-1", email: "joao.indicador@exemplo.com", fullName: "João Indicador", role: "indicador" },
];

describe("origem do assinante para masters", () => {
  it("landing page vira Origem Site", () => {
    assert.deepEqual(resolveSubscriberOrigin({ email: "a@x.com" }, users), {
      kind: "site",
      label: "Site",
      userEmail: "",
    });
  });

  it("cadastro por usuário mostra o nome da pessoa", () => {
    assert.deepEqual(
      resolveSubscriberOrigin({ email: "a@x.com", createdByEmail: MASTER }, users),
      { kind: "user", label: "Carla Master", userEmail: MASTER },
    );
    assert.deepEqual(
      resolveSubscriberOrigin({ email: "a@x.com", indicatorUserId: "ind-1" }, users),
      { kind: "user", label: "João Indicador", userEmail: "joao.indicador@exemplo.com" },
    );
  });

  it("reconhece o e-mail Walkup", () => {
    assert.equal(isWalkupMasterEmail(WALKUP_MASTER_EMAIL), true);
    assert.equal(isWalkupMasterEmail(MASTER), false);
  });
});
