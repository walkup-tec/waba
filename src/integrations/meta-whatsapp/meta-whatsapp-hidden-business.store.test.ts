import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hideBusiness,
  isHiddenBusiness,
  listHiddenBusinesses,
  listHiddenBusinessIds,
  unhideBusiness,
} from "./meta-whatsapp-hidden-business.store";

describe("hidden business store", () => {
  it("guarda o ID oculto por tenant e permite reexibir", () => {
    const tenantId = "test-hidden-bm-tenant";
    hideBusiness(tenantId, "1041.827.648.719.609", "BAN Drax Sistemas");
    assert.ok(listHiddenBusinessIds(tenantId).includes("1041827648719609"));
    assert.equal(listHiddenBusinesses(tenantId)[0]?.name, "BAN Drax Sistemas");
    assert.equal(isHiddenBusiness(tenantId, "1041827648719609"), true);
    unhideBusiness(tenantId, "1041827648719609");
    assert.equal(isHiddenBusiness(tenantId, "1041827648719609"), false);
  });
});
