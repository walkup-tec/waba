import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANDRE_WABA02_ID,
  ANDRE_WABA02_PENDING_PHONE_ID,
  RIO_DE_JANEIRO_01_WABA_ID,
  isKnownClientWabaForBusiness,
  knownClientWabaIdsForBusiness,
  knownOwnedWabaIdsForBusiness,
  knownPendingPhoneGraphRow,
  knownPendingPhonesForBusiness,
  metaBusinessIdsMatch,
} from "./meta-whatsapp-known-owned-wabas";

describe("known owned WABAs", () => {
  it("casa o BM do André com ou sem o 1 inicial", () => {
    assert.equal(metaBusinessIdsMatch("1759044748332124", "759044748332124"), true);
    assert.equal(metaBusinessIdsMatch("1759044748332124", "60843286"), false);
    assert.deepEqual(knownOwnedWabaIdsForBusiness("60.843.286").sort(), [
      "1744257946809067",
      "2458602464640240",
    ]);
  });

  it("devolve WABA02 e o chip pendente de PIN do André", () => {
    assert.deepEqual(knownOwnedWabaIdsForBusiness("1759044748332124").sort(), [
      "1744257946809067",
      "2458602464640240",
    ]);
    const pending = knownPendingPhonesForBusiness("759044748332124");
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.phoneNumberId, ANDRE_WABA02_PENDING_PHONE_ID);
    assert.equal(pending[0]?.wabaId, ANDRE_WABA02_ID);
    assert.match(String(pending[0]?.displayPhoneNumber || ""), /95213-6942/);
    const row = knownPendingPhoneGraphRow(pending[0]!);
    assert.equal(row.status, "PENDING");
    assert.deepEqual(knownClientWabaIdsForBusiness("1759044748332124"), [RIO_DE_JANEIRO_01_WABA_ID]);
    assert.equal(isKnownClientWabaForBusiness("1759044748332124", RIO_DE_JANEIRO_01_WABA_ID), true);
    assert.equal(isKnownClientWabaForBusiness("1759044748332124", ANDRE_WABA02_ID), false);
  });

  it("não inventa WABA para outro BM", () => {
    assert.deepEqual(knownOwnedWabaIdsForBusiness("4141369862822598"), []);
    assert.deepEqual(knownPendingPhonesForBusiness("bm-drax-2000"), []);
  });
});
