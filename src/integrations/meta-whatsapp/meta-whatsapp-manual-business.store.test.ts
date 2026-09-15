import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addManualBusiness,
  listManualBusinessIds,
  normalizeManualBusinessId,
} from "./meta-whatsapp-manual-business.store";

describe("manual business store", () => {
  it("normaliza o ID colado com espaços ou pontuação", () => {
    assert.equal(normalizeManualBusinessId(" 1.888.000.111.222.333 "), "1888000111222333");
    assert.equal(normalizeManualBusinessId("abc"), "");
  });

  it("guarda o ID por tenant para o Atualizar reconsultar", () => {
    const tenantId = "test-manual-bm-tenant";
    addManualBusiness(tenantId, "1888000111222333", "Drax Waba");
    assert.ok(listManualBusinessIds(tenantId).includes("1888000111222333"));
  });
});
