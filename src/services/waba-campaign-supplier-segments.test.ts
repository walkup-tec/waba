import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SplitSupplier } from "../billing/waba-financeiro-split.repository";
import {
  financeiroServesCampaign,
  listFinanceiroSegmentsForEmail,
  mergeOperacionalSegmentLists,
} from "./waba-campaign-supplier-segments";

const row = (overrides: Partial<SplitSupplier>): SplitSupplier => ({
  id: "x",
  name: "X",
  apiKind: "oficial",
  systemUserEmail: "a@exemplo.com",
  segment: "outros",
  priority: 1,
  costPerShipmentCents: 1,
  pixKey: "1",
  active: true,
  ...overrides,
});

describe("segmentos do Financeiro", () => {
  it("Claudinei com linhas Black e White é Black + White", () => {
    const suppliers = [
      row({
        name: "Claudinei Fernandes",
        systemUserEmail: "negociosltda01@gmail.com",
        segment: "bets",
        priority: 1,
      }),
      row({
        name: "Claudinei Fernandes",
        systemUserEmail: "negociosltda01@gmail.com",
        segment: "outros",
        priority: 2,
      }),
    ];
    assert.deepEqual(listFinanceiroSegmentsForEmail(suppliers, "negociosltda01@gmail.com"), [
      "bets",
      "outros",
    ]);
    assert.equal(
      financeiroServesCampaign(suppliers, "negociosltda01@gmail.com", "oficial", "outros"),
      true,
    );
  });

  it("Drax só com linha White permanece só White", () => {
    const suppliers = [
      row({
        name: "Drax",
        systemUserEmail: "drax@draxsistemas.com.br",
        segment: "outros",
        priority: 1,
      }),
    ];
    assert.deepEqual(listFinanceiroSegmentsForEmail(suppliers, "drax@draxsistemas.com.br"), [
      "outros",
    ]);
  });

  it("une cadastro Black com linha White do Financeiro", () => {
    assert.deepEqual(mergeOperacionalSegmentLists(["bets"], ["outros"]), ["bets", "outros"]);
  });
});
