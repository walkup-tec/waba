import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANDRE_WABA01_ID,
  ANDRE_WABA02_ID,
  ANDRE_WABA02_PENDING_PHONE_ID,
  DRAX_SISTEMAS_STALE_WABA_ID,
  DRAX_SISTEMAS_WABA_ID,
  RIO_DE_JANEIRO_01_WABA_ID,
  equivalentOwnedWabaIdsForBusiness,
  knownBusinessIdsForDisplayPhone,
  knownBusinessIdsForWaba,
  isWithdrawnInboxDisplayPhone,
  isKnownClientWabaForBusiness,
  knownClientWabaIdsForBusiness,
  knownOwnedWabaIdsForBusiness,
  knownPendingPhonesForBusiness,
  knownOwnedBusinessesMatch,
  knownWabaIdForPendingPhone,
  metaBusinessIdsMatch,
  catalogAdminBusinessIds,
  catalogAgencyBusinessIds,
  catalogBackfillBusinessIds,
  catalogBusinessLabel,
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

  it("5182001279 e WABA stale apontam para o BM Drax Sistemas", () => {
    assert.deepEqual(knownBusinessIdsForDisplayPhone("+55 51 8200-1279"), ["1041827648719609"]);
    assert.deepEqual(knownBusinessIdsForDisplayPhone("5182001279"), ["1041827648719609"]);
    assert.deepEqual(knownBusinessIdsForWaba(DRAX_SISTEMAS_STALE_WABA_ID), ["1041827648719609"]);
    assert.deepEqual(knownBusinessIdsForWaba(DRAX_SISTEMAS_WABA_ID), ["1041827648719609"]);
    assert.equal(isWithdrawnInboxDisplayPhone("+55 51 8200-1279"), true);
    assert.equal(isWithdrawnInboxDisplayPhone("5182001279"), true);
    assert.equal(isWithdrawnInboxDisplayPhone("+55 11 95213-7761"), false);
  });

  it("Drax Sistemas: só a WABA do Manager, não a conexão stale", () => {
    assert.deepEqual(knownOwnedWabaIdsForBusiness("1041827648719609"), ["1636793994538054"]);
    assert.deepEqual(
      equivalentOwnedWabaIdsForBusiness("1041827648719609", DRAX_SISTEMAS_STALE_WABA_ID).sort(),
      [DRAX_SISTEMAS_STALE_WABA_ID, DRAX_SISTEMAS_WABA_ID].sort(),
    );
  });

  it("Drax e André: irmãs pelo id da WABA mesmo sem BM no card", () => {
    assert.deepEqual(
      equivalentOwnedWabaIdsForBusiness("", DRAX_SISTEMAS_STALE_WABA_ID).sort(),
      [DRAX_SISTEMAS_STALE_WABA_ID, DRAX_SISTEMAS_WABA_ID].sort(),
    );
    assert.deepEqual(
      equivalentOwnedWabaIdsForBusiness("", DRAX_SISTEMAS_WABA_ID).sort(),
      [DRAX_SISTEMAS_STALE_WABA_ID, DRAX_SISTEMAS_WABA_ID].sort(),
    );
    assert.ok(equivalentOwnedWabaIdsForBusiness("", ANDRE_WABA01_ID).includes(ANDRE_WABA02_ID));
  });

  it("inclui Flaviane Ferreira Trindade no backfill de BM administrado", () => {
    assert.ok(catalogBackfillBusinessIds().includes("962298516898955"));
    assert.ok(catalogAdminBusinessIds().includes("962298516898955"));
    assert.ok(catalogAdminBusinessIds().includes("4681844838758316"));
    assert.ok(catalogBackfillBusinessIds().includes("1832926164812406"));
    assert.ok(catalogAdminBusinessIds().includes("1832926164812406"));
  });

  it("varre só os BMs da agência no Atualizar, sem tratar cliente como semente", () => {
    const agencies = catalogAgencyBusinessIds();
    assert.ok(agencies.includes("1041827648719609"));
    assert.ok(agencies.includes("4141369862822598"));
    assert.ok(agencies.includes("1247508354180311"));
    assert.equal(agencies.includes("962298516898955"), false);
    assert.equal(agencies.includes("4681844838758316"), false);
    assert.equal(agencies.includes("1832926164812406"), false);
  });

  it("nomeia Flaviane e Marilza pelo catálogo quando o id casa", () => {
    assert.equal(
      catalogBusinessLabel("962298516898955"),
      "60.845.972 Flaviane Ferreira Trindade",
    );
    assert.equal(catalogBusinessLabel("1962298516898955"), "60.845.972 Flaviane Ferreira Trindade");
    assert.equal(catalogBusinessLabel("4681844838758316"), "60.846.306 Marilza de Castro");
    assert.equal(
      catalogBusinessLabel("1832926164812406"),
      "52.797.696 Natally Carissia Muniz Bezerra",
    );
    assert.equal(catalogBusinessLabel("1041827648719609"), "");
  });
});
