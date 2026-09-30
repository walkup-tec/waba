import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addManualBusiness,
  listManualBusinessIds,
  listManualBusinesses,
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

  it("guarda o ID da WABA colado no card manual", () => {
    const tenantId = "test-manual-waba-tenant";
    const row = addManualBusiness(tenantId, "1067949032654572", "Casa Buzina", "777000111222333");
    assert.equal(row.wabaId, "777000111222333");
    const listed = listManualBusinesses(tenantId).find((item) => item.id === "1067949032654572");
    assert.equal(listed?.wabaId, "777000111222333");
  });
});
