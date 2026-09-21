import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyManualBankPaidSplit,
  matchesManualBankPaidSplit,
} from "./waba-financeiro-split-manual-paid";
import type { FinanceiroSplitSettlement } from "./waba-financeiro-split-settlement.repository";

const settlement = (patch: Partial<FinanceiroSplitSettlement> = {}): FinanceiroSplitSettlement => ({
  id: "st-1",
  orderId: "4bbee4e0-f669-4aa1-b032-dd8bfcbe4466",
  apiKind: "oficial",
  ownerEmail: "cliente@exemplo.com",
  customerName: "NOSSO CONSIG",
  paidValueCents: 138885,
  purchasedShipmentCount: 2203,
  costPerShipmentCents: 4,
  supplierCostCents: 8812,
  totalCostCents: 20298,
  grossProfitCents: 118587,
  cetCents: 298,
  distributableCents: 118587,
  lines: [
    {
      lineKind: "cet",
      participantId: "cet",
      participantLabel: "CET Asaas",
      participantEmail: "",
      pixKey: "",
      sharePercent: 0,
      amountCents: 298,
      payoutStatus: "skipped",
    },
    {
      lineKind: "supplier",
      participantId: "erick",
      participantLabel: "Erick Sales",
      participantEmail: "erick@exemplo.com",
      pixKey: "erick@pix",
      sharePercent: 0,
      amountCents: 8812,
      shipmentCount: 2203,
      payoutStatus: "failed",
      failureReason: "Transferência recusada pelo Asaas.",
    },
    {
      lineKind: "partner",
      participantId: "eduardo",
      participantLabel: "Eduardo Master",
      participantEmail: "eduardo@exemplo.com",
      pixKey: "eduardo@pix",
      sharePercent: 50,
      amountCents: 59293,
      payoutStatus: "paid",
    },
    {
      lineKind: "partner",
      participantId: "walkup",
      participantLabel: "Walkup",
      participantEmail: "walkup@exemplo.com",
      pixKey: "walkup@pix",
      sharePercent: 50,
      amountCents: 59294,
      payoutStatus: "paid",
    },
  ],
  payoutStatus: "partial",
  createdAt: "2026-09-09T15:17:00.000Z",
  ...patch,
});

describe("repasse manual no banco da NOSSO CONSIG", () => {
  it("casa o pedido de 09/09 com Erick Sales em falha", () => {
    assert.equal(matchesManualBankPaidSplit(settlement()), true);
  });

  it("não casa a NOSSO CONSIG 1 de outra data", () => {
    assert.equal(
      matchesManualBankPaidSplit(
        settlement({
          orderId: "outra-ordem",
          customerName: "NOSSO CONSIG 1",
          createdAt: "2026-09-18T13:30:00.000Z",
        }),
      ),
      false,
    );
  });

  it("marca o fornecedor como pago e o split como concluído", () => {
    const got = applyManualBankPaidSplit(settlement(), "2026-09-21T19:00:00.000Z");
    const supplier = got.lines.find((line) => line.lineKind === "supplier");
    assert.equal(supplier?.payoutStatus, "paid");
    assert.equal(supplier?.failureReason, undefined);
    assert.equal(supplier?.payoutExternalReference, "manual-bank");
    assert.equal(got.payoutStatus, "paid");
    assert.equal(got.payoutCompletedAt, "2026-09-21T19:00:00.000Z");
  });

  it("não altera de novo quando o fornecedor já está pago", () => {
    const first = applyManualBankPaidSplit(settlement(), "2026-09-21T19:00:00.000Z");
    const second = applyManualBankPaidSplit(first, "2026-09-21T20:00:00.000Z");
    assert.equal(second, first);
  });
});
