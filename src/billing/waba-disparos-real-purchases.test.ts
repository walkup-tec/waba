import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { CLEISON_OFICIAL_FORCE_REF } from "./waba-cleison-oficial-balance-repair";
import {
  listRealPaidPurchases,
  resolveRealPurchasedShipmentCount,
  sumPurchasedShipments,
} from "./waba-disparos-real-purchases";

const EMAIL = "cleison.fel@gmail.com";

function order(overrides: Partial<WabaBillingOrder>): WabaBillingOrder {
  const now = new Date().toISOString();
  return {
    id: "order-base",
    product: "waba-disparos",
    apiKind: "oficial",
    customerName: "Cleison",
    ownerEmail: EMAIL,
    whatsapp: "11999999999",
    cpfCnpj: "00000000191",
    billingType: "PIX",
    valueCents: 160000,
    shipmentCount: 5000,
    status: "paid",
    paidAt: now,
    asaasExternalReference: `waba:${overrides.id || "order-base"}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Compras reais de disparos", () => {
  it("recupera 5000 quando o pedido gravou 7679 com bônus e PIX Asaas", () => {
    const pix = order({
      id: "pix-sep09",
      shipmentCount: 7679,
      purchasedShipmentCount: 7679,
      bonusShipmentsApplied: 2679,
      asaasPaymentId: "pay_sep09",
      paidAt: "2026-09-09T13:20:00.000Z",
    });
    assert.equal(resolveRealPurchasedShipmentCount(pix), 5000);
  });

  it("não trata restante 2834 (−834) como pacote de 2000", () => {
    const leftover = order({
      id: "leftover",
      valueCents: 0,
      shipmentCount: 2834,
      purchasedShipmentCount: 2834,
      bonusShipmentsApplied: 834,
      paidAt: "2026-09-03T12:03:00.000Z",
    });
    assert.equal(resolveRealPurchasedShipmentCount(leftover), 0);
  });

  it("histórico do print: 3 compras 5000+5000+3000 e sem 1016/5829/clones", () => {
    const freezePaidAt = "2026-09-07T13:30:15.000Z";
    const orders = [
      order({
        id: "grant-1016-a",
        valueCents: 0,
        shipmentCount: 1016,
        purchasedShipmentCount: 1016,
        paidAt: "2026-09-09T19:26:00.000Z",
        grantSource: "admin-bonus-envios",
        grantCreatedByEmail: "marcelo.mozart@icloud.com",
      }),
      order({
        id: "grant-1016-b",
        valueCents: 0,
        shipmentCount: 1016,
        purchasedShipmentCount: 1016,
        paidAt: "2026-09-09T14:21:00.000Z",
        grantSource: "admin-bonus-envios",
      }),
      order({
        id: "grant-1016-c",
        valueCents: 0,
        shipmentCount: 1016,
        purchasedShipmentCount: 1016,
        paidAt: "2026-09-09T13:47:00.000Z",
        grantSource: "admin-bonus-envios",
      }),
      order({
        id: "grant-1016-d",
        valueCents: 0,
        shipmentCount: 1016,
        purchasedShipmentCount: 1016,
        paidAt: "2026-09-09T13:47:30.000Z",
        grantSource: "admin-bonus-envios",
      }),
      order({
        id: "pix-sep09",
        shipmentCount: 7679,
        purchasedShipmentCount: 7679,
        bonusShipmentsApplied: 2679,
        asaasPaymentId: "pay_sep09",
        paidAt: "2026-09-09T13:20:00.000Z",
      }),
      order({
        id: "freeze-5829",
        valueCents: 0,
        shipmentCount: 5829,
        purchasedShipmentCount: 5829,
        paidAt: freezePaidAt,
        asaasExternalReference: CLEISON_OFICIAL_FORCE_REF,
        grantSource: "admin-bonus-envios",
        grantCreatedByEmail: "system-balance-repair",
      }),
      order({
        id: "clone-3000-a",
        valueCents: 99000,
        shipmentCount: 3000,
        purchasedShipmentCount: 3000,
        paidAt: freezePaidAt,
      }),
      order({
        id: "clone-3000-b",
        valueCents: 99000,
        shipmentCount: 3000,
        purchasedShipmentCount: 3000,
        paidAt: freezePaidAt,
      }),
      order({
        id: "clone-3000-c",
        valueCents: 99000,
        shipmentCount: 3000,
        purchasedShipmentCount: 3000,
        paidAt: freezePaidAt,
      }),
      order({
        id: "pix-sep05",
        shipmentCount: 6663,
        purchasedShipmentCount: 6663,
        bonusShipmentsApplied: 1663,
        asaasPaymentId: "pay_sep05",
        paidAt: "2026-09-05T19:26:00.000Z",
      }),
      order({
        id: "leftover-2834",
        valueCents: 0,
        shipmentCount: 2834,
        purchasedShipmentCount: 2834,
        bonusShipmentsApplied: 834,
        paidAt: "2026-09-03T12:03:00.000Z",
      }),
      order({
        id: "pack-3000",
        valueCents: 0,
        shipmentCount: 3000,
        purchasedShipmentCount: 3000,
        paidAt: "2026-09-01T13:05:00.000Z",
      }),
    ];

    const purchases = listRealPaidPurchases(orders, EMAIL);
    assert.deepEqual(
      purchases.map((item) => item.id),
      ["pix-sep09", "pix-sep05", "pack-3000"],
    );
    assert.equal(sumPurchasedShipments(purchases), 13000);
  });
});
