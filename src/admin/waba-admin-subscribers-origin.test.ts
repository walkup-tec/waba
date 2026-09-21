import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSubscriberOriginIndicator } from "./waba-admin-subscribers.service";

describe("origem do assinante na lista do master", () => {
  it("mostra o indicador quando o assinante veio de um indicador", () => {
    const origin = resolveSubscriberOriginIndicator("ind-1", {
      fullName: "João Indicador",
      email: "joao.indicador@test.com",
    });
    assert.deepEqual(origin, {
      kind: "indicator",
      indicatorUserId: "ind-1",
      indicatorName: "João Indicador",
      indicatorEmail: "joao.indicador@test.com",
    });
  });

  it("não mostra origem quando o assinante não tem indicador", () => {
    assert.equal(resolveSubscriberOriginIndicator("", { fullName: "X", email: "x@test.com" }), null);
    assert.equal(resolveSubscriberOriginIndicator(null), null);
  });

  it("mantém o ícone mesmo se o cadastro do indicador estiver incompleto", () => {
    const origin = resolveSubscriberOriginIndicator("ind-2", null);
    assert.equal(origin?.kind, "indicator");
    assert.equal(origin?.indicatorName, "Indicador");
    assert.equal(origin?.indicatorEmail, "");
  });
});
