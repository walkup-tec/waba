import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OFICIAL_CAMPAIGN_CONTROL_PHONES } from "../../disparos/waba-campaign-oficial-control-phones";
import {
  META_BROADCAST_TEST_DEFAULT_PHONES,
  META_BROADCAST_TEST_MAX_PHONES,
  parseMetaBroadcastTestPhones,
} from "./meta-whatsapp-broadcast-test-phones";

describe("parseMetaBroadcastTestPhones", () => {
  it("usa os 5 primeiros números de controle, inclusive a repetição", () => {
    assert.deepEqual([...META_BROADCAST_TEST_DEFAULT_PHONES], [
      "5199666841",
      "5193388993",
      "5197462102",
      "5193388993",
      "5182242910",
    ]);
    assert.equal(META_BROADCAST_TEST_DEFAULT_PHONES.length, META_BROADCAST_TEST_MAX_PHONES);
    assert.deepEqual(
      [...META_BROADCAST_TEST_DEFAULT_PHONES],
      OFICIAL_CAMPAIGN_CONTROL_PHONES.slice(0, 5),
    );
  });

  it("envia só os campos preenchidos, de 1 a 5", () => {
    const one = parseMetaBroadcastTestPhones(["5199666841", "", "  ", null, undefined]);
    assert.equal(one.ok, true);
    if (one.ok) {
      assert.equal(one.waIds.length, 1);
      assert.equal(one.raw.length, 1);
    }

    const three = parseMetaBroadcastTestPhones({
      phone1: "5199666841",
      phone2: "",
      phone3: "5197462102",
      phone4: "   ",
      phone5: "5182242910",
    });
    assert.equal(three.ok, true);
    if (three.ok) assert.equal(three.waIds.length, 3);
  });

  it("mantém a duplicata de 5193388993 como dois destinos", () => {
    const got = parseMetaBroadcastTestPhones([...META_BROADCAST_TEST_DEFAULT_PHONES]);
    assert.equal(got.ok, true);
    if (!got.ok) return;
    assert.equal(got.waIds.length, 5);
    const repeated = got.waIds.filter((waId, index, list) => list.indexOf(waId) !== index);
    assert.equal(repeated.length, 1);
    assert.equal(got.waIds[1], got.waIds[3]);
  });

  it("ignora o 6º preenchido e não exige exatamente 5", () => {
    const got = parseMetaBroadcastTestPhones([
      "5199666841",
      "5193388993",
      "5197462102",
      "5193388993",
      "5182242910",
      "5197979224",
    ]);
    assert.equal(got.ok, true);
    if (got.ok) {
      assert.equal(got.raw.length, 5);
      assert.ok(!got.raw.includes("5197979224"));
    }
  });

  it("recusa lista vazia e número inválido", () => {
    const empty = parseMetaBroadcastTestPhones(["", "  ", null]);
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.match(empty.error, /1 a 5/);

    const bad = parseMetaBroadcastTestPhones(["5199666841", "abc"]);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.error, /inválido/i);
  });
});
