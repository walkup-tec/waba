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
  parseBroadcastPhoneQuotasInput,
  parseMetaDailySendLimit,
  resolveBroadcastLeadQuotas,
  resolvePortfolioDailySendCap,
  assertBroadcastQuotasWithinPortfolioDailyCaps,
} from "./meta-whatsapp-broadcast-split";

describe("meta-whatsapp-broadcast-split", () => {
  it("normaliza ids únicos na ordem de entrada", () => {
    assert.deepEqual(normalizeBroadcastPhoneNumberIds(["a", " a ", "b", "a", ""]), ["a", "b"]);
    assert.deepEqual(normalizeBroadcastPhoneNumberIds("a,b; a"), ["a", "b"]);
  });

  it("calcula o mínimo de números para o teto de 1000", () => {
    assert.equal(minPhonesRequiredForBroadcast(0), 0);
    assert.equal(minPhonesRequiredForBroadcast(1), 1);
    assert.equal(minPhonesRequiredForBroadcast(500), 1);
    assert.equal(minPhonesRequiredForBroadcast(1000), 1);
    assert.equal(minPhonesRequiredForBroadcast(1001), 2);
    assert.equal(minPhonesRequiredForBroadcast(1500), 2);
    assert.equal(minPhonesRequiredForBroadcast(2001), 3);
  });

  it("distribui de forma equilibrada sem ultrapassar 1000", () => {
    assert.deepEqual(distributeBroadcastLeadsAcrossPhones(["p1", "p2", "p3"], 1200), [
      { phoneNumberId: "p1", planned: 400 },
      { phoneNumberId: "p2", planned: 400 },
      { phoneNumberId: "p3", planned: 400 },
    ]);
    assert.deepEqual(distributeBroadcastLeadsAcrossPhones(["p1", "p2"], 2000), [
      { phoneNumberId: "p1", planned: 1000 },
      { phoneNumberId: "p2", planned: 1000 },
    ]);
    assert.deepEqual(distributeBroadcastLeadsAcrossPhones(["p1"], 1000), [
      { phoneNumberId: "p1", planned: 1000 },
    ]);
  });

  it("rejeita quando faltam números para o total", () => {
    assert.throws(
      () => distributeBroadcastLeadsAcrossPhones(["p1", "p2"], 2001),
      /pelo menos 3 números/i,
    );
    assert.throws(
      () => distributeBroadcastLeadsAcrossPhones(["p1"], 1001),
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

  it("aceita cotas manuais menores que o total da planilha (limite diário da BM)", () => {
    const leads = Array.from({ length: 2996 }, (_, index) => ({ waId: `55${index}` }));
    const custom = [
      { phoneNumberId: "p1", planned: 700 },
      { phoneNumberId: "p2", planned: 700 },
      { phoneNumberId: "p3", planned: 600 },
    ];
    const quotas = resolveBroadcastLeadQuotas(["p1", "p2", "p3"], leads.length, custom);
    assert.deepEqual(quotas, custom);
    const assigned = assignBroadcastLeadsToPhones(leads, ["p1", "p2", "p3"], META_BROADCAST_MAX_SENDS_PER_NUMBER, custom);
    assert.equal(assigned.length, 2000);
    const counts = { p1: 0, p2: 0, p3: 0 };
    for (const row of assigned) {
      counts[row.phoneNumberId as keyof typeof counts] += 1;
    }
    assert.deepEqual(counts, { p1: 700, p2: 700, p3: 600 });
  });

  it("rejeita cota acima de 1000 por número", () => {
    assert.throws(
      () =>
        resolveBroadcastLeadQuotas(["p1", "p2"], 2000, [
          { phoneNumberId: "p1", planned: 1001 },
          { phoneNumberId: "p2", planned: 500 },
        ]),
      /no máximo 1000/i,
    );
  });

  it("rejeita soma maior que o total da campanha", () => {
    assert.throws(
      () =>
        resolveBroadcastLeadQuotas(["p1", "p2"], 1000, [
          { phoneNumberId: "p1", planned: 600 },
          { phoneNumberId: "p2", planned: 500 },
        ]),
      /não pode passar o total da campanha/i,
    );
  });

  it("permite soma menor que o total da campanha", () => {
    const quotas = resolveBroadcastLeadQuotas(["p1", "p2"], 2996, [
      { phoneNumberId: "p1", planned: 1000 },
      { phoneNumberId: "p2", planned: 1000 },
    ]);
    assert.equal(
      quotas.reduce((sum, row) => sum + row.planned, 0),
      2000,
    );
  });

  it("número com 0 envios sai do disparo", () => {
    const quotas = resolveBroadcastLeadQuotas(["p1", "p2", "p3"], 1500, [
      { phoneNumberId: "p1", planned: 800 },
      { phoneNumberId: "p2", planned: 0 },
      { phoneNumberId: "p3", planned: 200 },
    ]);
    assert.deepEqual(quotas, [
      { phoneNumberId: "p1", planned: 800 },
      { phoneNumberId: "p3", planned: 200 },
    ]);
    const leads = Array.from({ length: 1500 }, (_, index) => ({ waId: `55${index}` }));
    const assigned = assignBroadcastLeadsToPhones(leads, ["p1", "p2", "p3"], META_BROADCAST_MAX_SENDS_PER_NUMBER, [
      { phoneNumberId: "p1", planned: 800 },
      { phoneNumberId: "p2", planned: 0 },
      { phoneNumberId: "p3", planned: 200 },
    ]);
    assert.equal(assigned.length, 1000);
    assert.equal(
      assigned.every((row) => row.phoneNumberId !== "p2"),
      true,
    );
  });

  it("lê cotas de JSON de formulário", () => {
    assert.deepEqual(
      parseBroadcastPhoneQuotasInput('[{"phoneNumberId":"p1","planned":700},{"phoneNumberId":"p2","planned":300}]'),
      [
        { phoneNumberId: "p1", planned: 700 },
        { phoneNumberId: "p2", planned: 300 },
      ],
    );
    assert.throws(() => parseBroadcastPhoneQuotasInput("{not-json"), /quantidades de envio/i);
  });

  it("array vazio de cotas não volta à distribuição automática", () => {
    assert.throws(() => resolveBroadcastLeadQuotas(["p1"], 10, []), /ao menos 1 envio/i);
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

  it("lê o limite diário da Meta (tier ou número)", () => {
    assert.equal(parseMetaDailySendLimit("TIER_50"), 50);
    assert.equal(parseMetaDailySendLimit("TIER_250"), 250);
    assert.equal(parseMetaDailySendLimit("TIER_1K"), 1000);
    assert.equal(parseMetaDailySendLimit("TIER_2K"), 2000);
    assert.equal(parseMetaDailySendLimit("TIER_10K"), 10000);
    assert.equal(parseMetaDailySendLimit("TIER_100K"), 100000);
    assert.equal(parseMetaDailySendLimit("2000"), 2000);
    assert.equal(parseMetaDailySendLimit("2K"), 2000);
    assert.equal(parseMetaDailySendLimit("UNLIMITED"), null);
    assert.equal(parseMetaDailySendLimit(""), null);
    assert.equal(parseMetaDailySendLimit(null), null);
  });

  it("usa o limite do portfólio antes da soma dos chips", () => {
    assert.equal(
      resolvePortfolioDailySendCap({
        messagingLimit: "TIER_2K",
        numbers: [{ messagingLimit: "TIER_1K" }, { messagingLimit: "TIER_1K" }, { messagingLimit: "TIER_1K" }],
      }),
      2000,
    );
    assert.equal(
      resolvePortfolioDailySendCap({
        numbers: [{ messagingLimit: "TIER_1K" }, { messagingLimit: "TIER_1K" }],
      }),
      2000,
    );
    assert.equal(resolvePortfolioDailySendCap({ numbers: [{}, {}] }), null);
  });

  it("bloqueia soma das cotas acima do limite diário do portfólio", () => {
    const bindings = [
      { phoneNumberId: "p1", connectionId: "bm-a", portfolioName: "Drax" },
      { phoneNumberId: "p2", connectionId: "bm-a", portfolioName: "Drax" },
      { phoneNumberId: "p3", connectionId: "bm-a", portfolioName: "Drax" },
    ];
    const portfolios = [{ connectionId: "bm-a", name: "Drax", messagingLimit: "2000" }];
    assert.doesNotThrow(() =>
      assertBroadcastQuotasWithinPortfolioDailyCaps(
        [
          { phoneNumberId: "p1", planned: 700 },
          { phoneNumberId: "p2", planned: 700 },
          { phoneNumberId: "p3", planned: 600 },
        ],
        bindings,
        portfolios,
      ),
    );
    assert.throws(
      () =>
        assertBroadcastQuotasWithinPortfolioDailyCaps(
          [
            { phoneNumberId: "p1", planned: 700 },
            { phoneNumberId: "p2", planned: 700 },
            { phoneNumberId: "p3", planned: 700 },
          ],
          bindings,
          portfolios,
        ),
      /limite diário \(2000\)/i,
    );
  });

  it("não bloqueia o disparo quando o limite diário do portfólio é desconhecido", () => {
    assert.doesNotThrow(() =>
      assertBroadcastQuotasWithinPortfolioDailyCaps(
        [{ phoneNumberId: "p1", planned: 1000 }],
        [{ phoneNumberId: "p1", connectionId: "bm-a", portfolioName: "Drax" }],
        [{ connectionId: "bm-a", name: "Drax" }],
      ),
    );
  });
});
