import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSubscriberOrigin } from "../users/waba-subscriber-master-visibility";

describe("origem do assinante na lista do master", () => {
  const users = [
    {
      id: "ind-1",
      fullName: "João Indicador",
      email: "joao.indicador@test.com",
      role: "indicador",
    },
    {
      id: "master-1",
      fullName: "Carla Master",
      email: "carla.master@exemplo.com",
      role: "master",
    },
  ];

  it("mostra Site quando veio da landing page", () => {
    assert.deepEqual(resolveSubscriberOrigin({ email: "a@x.com" }, users), {
      kind: "site",
      label: "Site",
      userEmail: "",
    });
  });

  it("mostra o nome do usuário quando o master cadastrou", () => {
    assert.deepEqual(
      resolveSubscriberOrigin(
        { email: "a@x.com", createdByEmail: "carla.master@exemplo.com" },
        users,
      ),
      {
        kind: "user",
        label: "Carla Master",
        userEmail: "carla.master@exemplo.com",
      },
    );
  });

  it("mostra o nome do indicador quando o assinante veio de um indicador", () => {
    assert.deepEqual(
      resolveSubscriberOrigin({ email: "a@x.com", indicatorUserId: "ind-1" }, users),
      {
        kind: "user",
        label: "João Indicador",
        userEmail: "joao.indicador@test.com",
      },
    );
  });
});
