import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignUsesDeliveredSupplierSplitRule,
  resolveBillableCountForSupplierSplit,
  resolveBillableSentForSupplierSplit,
  resolveBillableSentLegacyForSupplierSplit,
  shouldDeferSplitUntilCampaignFinalize,
} from "./waba-campaign-credit-funding";

describe("regra de split por entregues (a partir de 17/09/2026 BRT)", () => {
  it("campanha criada no dia 17/09/2026 em Brasília usa a regra nova", () => {
    assert.equal(campaignUsesDeliveredSupplierSplitRule("2026-09-17T03:00:00.000Z"), true);
    assert.equal(campaignUsesDeliveredSupplierSplitRule("2026-09-17T02:59:59.000Z"), false);
    assert.equal(campaignUsesDeliveredSupplierSplitRule("2026-09-16T23:00:00.000Z"), false);
  });

  it("pedido pago a partir de 17/09/2026 BRT adia o split", () => {
    assert.equal(
      shouldDeferSplitUntilCampaignFinalize({ paidAt: "2026-09-17T03:00:00.000Z" }),
      true,
    );
    assert.equal(
      shouldDeferSplitUntilCampaignFinalize({ paidAt: "2026-09-17T02:59:59.000Z" }),
      false,
    );
  });

  it("quantidade nova é entregues; quantidade antiga é enviados", () => {
    const intake = {
      createdAt: "2026-09-17T12:00:00.000Z",
      plannedSendCount: 1000,
      performanceReport: { sent: 1000, delivered: 800 },
      creditFunding: { fromPaid: 1000, fromBonus: 0 },
    };
    assert.equal(resolveBillableSentForSupplierSplit(intake), 800);
    assert.equal(resolveBillableSentLegacyForSupplierSplit(intake), 1000);
    assert.equal(resolveBillableCountForSupplierSplit(intake), 800);
    assert.equal(
      resolveBillableCountForSupplierSplit({ ...intake, createdAt: "2026-09-16T12:00:00.000Z" }),
      1000,
    );
  });

  it("campanha 100% bônus não gera quantidade faturável", () => {
    assert.equal(
      resolveBillableCountForSupplierSplit({
        createdAt: "2026-09-17T12:00:00.000Z",
        plannedSendCount: 500,
        performanceReport: { sent: 500, delivered: 400 },
        creditFunding: { fromPaid: 0, fromBonus: 500 },
      }),
      0,
    );
  });
});
