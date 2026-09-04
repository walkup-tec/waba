import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  META_BROADCAST_MAX_SENDS_PER_NUMBER,
  assignBroadcastLeadsToPhones,
  campaignPhoneNumberIds,
  campaignUsesPhoneNumber,
  distributeBroadcastLeadsAcrossPhones,
  minPhonesRequiredForBroadcast,
  normalizeBroadcastPhoneNumberIds,
} from "./meta-whatsapp-broadcast-split";

describe("meta-whatsapp-broadcast-split", () => {
  it("normaliza ids únicos na ordem de entrada", () => {
    assert.deepEqual(normalizeBroadcastPhoneNumberIds(["a", " a ", "b", "a", ""]), ["a", "b"]);
    assert.deepEqual(normalizeBroadcastPhoneNumberIds("a,b; a"), ["a", "b"]);
  });

  it("calcula o mínimo de números para o teto de 500", () => {
    assert.equal(minPhonesRequiredForBroadcast(0), 0);
    assert.equal(minPhonesRequiredForBroadcast(1), 1);
    assert.equal(minPhonesRequiredForBroadcast(500), 1);
    assert.equal(minPhonesRequiredForBroadcast(501), 2);
    assert.equal(minPhonesRequiredForBroadcast(1500), 3);
  });

  it("distribui de forma equilibrada sem ultrapassar 500", () => {
    assert.deepEqual(distributeBroadcastLeadsAcrossPhones(["p1", "p2", "p3"], 1200), [
      { phoneNumberId: "p1", planned: 400 },
      { phoneNumberId: "p2", planned: 400 },
      { phoneNumberId: "p3", planned: 400 },
    ]);
    assert.deepEqual(distributeBroadcastLeadsAcrossPhones(["p1", "p2"], 1000), [
      { phoneNumberId: "p1", planned: 500 },
      { phoneNumberId: "p2", planned: 500 },
    ]);
  });

  it("rejeita quando faltam números para o total", () => {
    assert.throws(
      () => distributeBroadcastLeadsAcrossPhones(["p1", "p2"], 1001),
      /pelo menos 3 números/i,
    );
    assert.throws(
      () => distributeBroadcastLeadsAcrossPhones(["p1"], 501),
      /pelo menos 2 números/i,
    );
  });

  it("fecha o total com resto nos primeiros números", () => {
    assert.deepEqual(distributeBroadcastLeadsAcrossPhones(["a", "b", "c"], 1000), [
      { phoneNumberId: "a", planned: 334 },
      { phoneNumberId: "b", planned: 333 },
      { phoneNumberId: "c", planned: 333 },
    ]);
    const quotas = distributeBroadcastLeadsAcrossPhones(["a", "b"], 500);
    assert.equal(
      quotas.reduce((sum, row) => sum + row.planned, 0),
      500,
    );
    assert.ok(quotas.every((row) => row.planned <= META_BROADCAST_MAX_SENDS_PER_NUMBER));
  });

  it("atribui phoneNumberId em cada lead respeitando as cotas", () => {
    const leads = Array.from({ length: 7 }, (_, index) => ({ waId: `55${index}` }));
    const assigned = assignBroadcastLeadsToPhones(leads, ["n1", "n2", "n3"]);
    assert.equal(assigned.length, 7);
    const counts = { n1: 0, n2: 0, n3: 0 };
    for (const row of assigned) {
      counts[row.phoneNumberId as keyof typeof counts] += 1;
    }
    assert.deepEqual(counts, { n1: 3, n2: 2, n3: 2 });
  });

  it("campaignPhoneNumberIds mantém compatibilidade com campanha antiga", () => {
    assert.deepEqual(campaignPhoneNumberIds({ phoneNumberId: "only" }), ["only"]);
    assert.deepEqual(campaignPhoneNumberIds({ phoneNumberId: "a", phoneNumberIds: ["b", "c"] }), [
      "b",
      "c",
    ]);
    assert.equal(campaignUsesPhoneNumber({ phoneNumberIds: ["b", "c"] }, "c"), true);
    assert.equal(campaignUsesPhoneNumber({ phoneNumberIds: ["b", "c"] }, "z"), false);
    assert.equal(campaignUsesPhoneNumber({ phoneNumberId: "a" }, ""), true);
  });
});
