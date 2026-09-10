import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANDRE_WABA02_ID,
  ANDRE_WABA02_PENDING_PHONE_ID,
  RIO_DE_JANEIRO_01_WABA_ID,
  isKnownClientWabaForBusiness,
  knownClientWabaIdsForBusiness,
  knownOwnedWabaIdsForBusiness,
  knownPendingPhonesForBusiness,
  knownOwnedBusinessesMatch,
  knownWabaIdForPendingPhone,
  metaBusinessIdsMatch,
} from "./meta-whatsapp-known-owned-wabas";

describe("known owned WABAs", () => {
  it("casa o BM do André com ou sem o 1 inicial", () => {
    assert.equal(metaBusinessIdsMatch("1759044748332124", "759044748332124"), true);
    assert.equal(metaBusinessIdsMatch("1759044748332124", "60843286"), false);
    assert.equal(knownOwnedBusinessesMatch("1759044748332124", "60.843.286"), true);
    assert.equal(knownOwnedBusinessesMatch("1759044748332124", "1398783195605765"), false);
    assert.deepEqual(knownOwnedWabaIdsForBusiness("60.843.286").sort(), [
      "1744257946809067",
      "2458602464640240",
    ]);
  });

  it("devolve WABA01 e WABA02 do André sem inventar chip excluído da Meta", () => {
    assert.deepEqual(knownOwnedWabaIdsForBusiness("1759044748332124").sort(), [
      "1744257946809067",
      "2458602464640240",
    ]);
    assert.deepEqual(knownPendingPhonesForBusiness("759044748332124"), []);
    assert.equal(knownWabaIdForPendingPhone(ANDRE_WABA02_PENDING_PHONE_ID), "");
    assert.deepEqual(knownClientWabaIdsForBusiness("1759044748332124"), [RIO_DE_JANEIRO_01_WABA_ID]);
    assert.equal(isKnownClientWabaForBusiness("1759044748332124", RIO_DE_JANEIRO_01_WABA_ID), true);
    assert.equal(isKnownClientWabaForBusiness("1759044748332124", ANDRE_WABA02_ID), false);
  });

  it("não inventa WABA para outro BM", () => {
    assert.deepEqual(knownOwnedWabaIdsForBusiness("bm-drax-2000"), []);
    assert.deepEqual(knownPendingPhonesForBusiness("bm-drax-2000"), []);
  });

  it("Walkup: WABA 01 do Manager, sem a conta fantasma", () => {
    assert.deepEqual(knownOwnedWabaIdsForBusiness("4141369862822598"), ["1014470201624992"]);
  });

  it("Drax Sistemas: só a WABA do Manager, não a conexão stale", () => {
    assert.deepEqual(knownOwnedWabaIdsForBusiness("1041827648719609"), ["1636793994538054"]);
  });
});
