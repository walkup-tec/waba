import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachBroadcastLeadPhoneBindings,
  bindingsFromCampaignPhones,
  connectionIdByPhoneNumber,
  connectionNeedsLocalTemplate,
  indexBroadcastPortfolioPhones,
  resolveBroadcastPhoneBindings,
  templateMissingOnPortfolioMessage,
} from "./meta-whatsapp-broadcast-phones";

const portfolios = [
  {
    connectionId: "conn-b",
    name: "Portfólio B",
    wabaId: "waba-b",
    numbers: [
      { phoneNumberId: "b1", uiStatus: "ativo", dispatchStatus: "livre" },
      { phoneNumberId: "b2", uiStatus: "restrito", dispatchStatus: "livre" },
    ],
  },
  {
    connectionId: "conn-c",
    name: "Portfólio C",
    wabaId: "waba-c",
    numbers: [
      { phoneNumberId: "c1", uiStatus: "ativo", dispatchStatus: "livre" },
      { phoneNumberId: "c2", uiStatus: "ativo", dispatchStatus: "em_disparo" },
    ],
  },
];

describe("meta-whatsapp-broadcast-phones", () => {
  it("indexa números de vários portfólios", () => {
    const catalog = indexBroadcastPortfolioPhones(portfolios);
    assert.equal(catalog.get("b1")?.connectionId, "conn-b");
    assert.equal(catalog.get("c1")?.connectionId, "conn-c");
    assert.equal(catalog.get("c1")?.portfolioName, "Portfólio C");
  });

  it("aceita números Ativos de portfólios diferentes", () => {
    const catalog = indexBroadcastPortfolioPhones(portfolios);
    const bindings = resolveBroadcastPhoneBindings(["b1", "c1"], catalog);
    assert.deepEqual(
      bindings.map((row) => ({ phone: row.phoneNumberId, conn: row.connectionId })),
      [
        { phone: "b1", conn: "conn-b" },
        { phone: "c1", conn: "conn-c" },
      ],
    );
  });

  it("recusa número restrito, ocupado ou desconhecido", () => {
    const catalog = indexBroadcastPortfolioPhones(portfolios);
    assert.throws(() => resolveBroadcastPhoneBindings(["b2"], catalog), /número Ativo/);
    assert.throws(() => resolveBroadcastPhoneBindings(["c2"], catalog), /ocupado/);
    assert.throws(() => resolveBroadcastPhoneBindings(["z9"], catalog), /não está nos portfólios/);
    assert.throws(() => resolveBroadcastPhoneBindings([], catalog), /ao menos um número/);
  });

  it("anexa o connectionId de cada portfólio no lead", () => {
    const catalog = indexBroadcastPortfolioPhones(portfolios);
    const bindings = resolveBroadcastPhoneBindings(["b1", "c1"], catalog);
    const leads = attachBroadcastLeadPhoneBindings(
      [
        { waId: "1", phoneNumberId: "c1" },
        { waId: "2", phoneNumberId: "b1" },
      ],
      bindings,
    );
    assert.equal(leads[0].connectionId, "conn-c");
    assert.equal(leads[1].connectionId, "conn-b");
    assert.deepEqual(connectionIdByPhoneNumber(bindings), { b1: "conn-b", c1: "conn-c" });
  });

  it("retoma campanha antiga sem phoneBindings no connectionId original", () => {
    const bindings = bindingsFromCampaignPhones({
      phoneNumberIds: ["b1", "c1"],
      fallbackConnectionId: "conn-b",
    });
    assert.deepEqual(
      bindings.map((row) => row.connectionId),
      ["conn-b", "conn-b"],
    );
    const stored = bindingsFromCampaignPhones({
      phoneNumberIds: ["b1", "c1"],
      fallbackConnectionId: "conn-b",
      stored: [{ phoneNumberId: "c1", connectionId: "conn-c", portfolioName: "Portfólio C" }],
    });
    assert.equal(stored[0].connectionId, "conn-b");
    assert.equal(stored[1].connectionId, "conn-c");
  });

  it("só exige template local quando o WABA é outro", () => {
    assert.equal(
      connectionNeedsLocalTemplate({
        connectionId: "conn-b",
        wabaId: "waba-b",
        templateConnectionId: "conn-b",
        templateWabaId: "waba-b",
      }),
      false,
    );
    assert.equal(
      connectionNeedsLocalTemplate({
        connectionId: "conn-c",
        wabaId: "waba-b",
        templateConnectionId: "conn-b",
        templateWabaId: "waba-b",
      }),
      false,
    );
    assert.equal(
      connectionNeedsLocalTemplate({
        connectionId: "conn-c",
        wabaId: "waba-c",
        templateConnectionId: "conn-b",
        templateWabaId: "waba-b",
      }),
      true,
    );
    assert.match(
      templateMissingOnPortfolioMessage({ templateName: "aviso_utilidade", portfolioName: "Portfólio C" }),
      /Portfólio C/,
    );
  });
});
