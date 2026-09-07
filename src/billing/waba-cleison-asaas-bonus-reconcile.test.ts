import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { parseWabaOrderIdFromExternalReference } from "./asaas-identifiers";

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";

const EMAIL = "cleison.fel@gmail.com";
const NEW_ORDER_ID = "7c1e5000-0ff1-4c1a-9c1e-000000005000";
const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-cleison-pix-"));

function resetBillingStore() {
  const dataDir = path.join(process.cwd(), "data");
  mkdirSync(path.join(dataDir, "v01"), { recursive: true });
  mkdirSync(path.join(dataDir, "v02"), { recursive: true });
  writeFileSync(path.join(dataDir, "waba-billing-orders.json"), "[]");
  writeFileSync(path.join(dataDir, "v01", "waba-billing-orders.json"), "[]");
  writeFileSync(path.join(dataDir, "v02", "waba-billing-orders.json"), "[]");
  const emptyBonus = JSON.stringify({ version: 2, entries: [] });
  writeFileSync(path.join(dataDir, "waba-disparos-bonus-balances.json"), emptyBonus);
  writeFileSync(path.join(dataDir, "v01", "waba-disparos-bonus-balances.json"), emptyBonus);
  writeFileSync(path.join(dataDir, "v02", "waba-disparos-bonus-balances.json"), emptyBonus);
}

function baseOrder(overrides: Partial<WabaBillingOrder>): WabaBillingOrder {
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
    status: "pending_payment",
    asaasExternalReference: `waba:${overrides.id || "order-base"}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Webhook Asaas PAYMENT_RECEIVED (fluxo existente)", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
    resetBillingStore();
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("extrai UUID do externalReference e ignora split", () => {
    assert.equal(
      parseWabaOrderIdFromExternalReference(`waba:${NEW_ORDER_ID}`),
      NEW_ORDER_ID,
    );
    assert.equal(
      parseWabaOrderIdFromExternalReference(`waba:${NEW_ORDER_ID}:checkout`),
      NEW_ORDER_ID,
    );
    assert.equal(parseWabaOrderIdFromExternalReference("waba:sp:abc:p:def"), null);
  });

  it("não descarta PIX pago quando o payment.id existe e o externalReference não tem prefixo waba:", async () => {
    resetBillingStore();

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosBonusSettlementService } = await import(
      "./waba-disparos-bonus-settlement.service"
    );
    const { WabaBillingService } = await import("./waba-billing.service");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "11111111-1111-4111-8111-111111111111",
        shipmentCount: 1849,
        valueCents: 55500,
        status: "paid",
        paidAt: "2026-08-01T15:00:00.000Z",
        createdAt: "2026-08-01T15:00:00.000Z",
        bonusShipmentsApplied: 0,
        bonusSettlementAt: "2026-08-01T15:00:00.000Z",
        asaasExternalReference: "waba:11111111-1111-4111-8111-111111111111",
      }),
    );
    orders.create(
      baseOrder({
        id: NEW_ORDER_ID,
        shipmentCount: 5000,
        valueCents: 160000,
        status: "pending_payment",
        asaasPaymentId: "pay_cleison_5000",
        asaasExternalReference: `waba:${NEW_ORDER_ID}`,
        createdAt: "2026-09-05T19:20:00.000Z",
        updatedAt: "2026-09-05T19:20:00.000Z",
      }),
    );

    new WabaDisparosBonusRepository().grantFromCampaign(
      EMAIL,
      "368d053b-d59b-4eed-a235-fe9e9f32c68c",
      829,
      "oficial",
    );

    const billing = new WabaBillingService(
      orders,
      new WabaDisparosBonusSettlementService(orders),
    );

    const before = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(before.byApi.oficial.remainingShipments, 1849);
    assert.equal(before.byApi.oficial.pendingBonusShipments, 829);

    const result = await billing.handleAsaasWebhook("PAYMENT_RECEIVED", {
      id: "pay_cleison_5000",
      externalReference: "cobranca-asaas-sem-prefixo",
      status: "RECEIVED",
    });

    assert.equal(result.ignored, undefined);
    assert.equal(result.status, "paid");

    const after = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(after.byApi.oficial.pendingBonusShipments, 0);
    assert.equal(after.byApi.oficial.remainingShipments, 1849 + 5000 + 829);

    const paid = orders.getById(NEW_ORDER_ID);
    assert.equal(paid?.status, "paid");
    assert.equal(paid?.bonusShipmentsApplied, 829);
    assert.equal(paid?.shipmentCount, 5829);
  });

  it("não carimba bônus 0: pedido já paid ainda recebe os 829 no GET de créditos", async () => {
    resetBillingStore();

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    const orders = new WabaBillingOrderRepository();
    new WabaDisparosBonusRepository().grantFromCampaign(
      EMAIL,
      "368d053b-d59b-4eed-a235-fe9e9f32c68c",
      829,
      "oficial",
    );
    const paidAt = new Date().toISOString();
    orders.create(
      baseOrder({
        id: NEW_ORDER_ID,
        shipmentCount: 5000,
        status: "paid",
        paidAt,
        asaasPaymentId: "pay_already_paid",
        bonusShipmentsApplied: 0,
        bonusSettlementAt: paidAt,
      }),
    );

    const after = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(after.byApi.oficial.pendingBonusShipments, 0);
    assert.equal(after.byApi.oficial.remainingShipments, 5000 + 829);
    assert.equal(orders.getById(NEW_ORDER_ID)?.bonusShipmentsApplied, 829);
  });

  it("grant admin expirado não zera os 829 pendentes da campanha", async () => {
    resetBillingStore();

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    const orders = new WabaBillingOrderRepository();
    new WabaDisparosBonusRepository().grantFromCampaign(
      EMAIL,
      "368d053b-d59b-4eed-a235-fe9e9f32c68c",
      829,
      "oficial",
    );
    orders.create(
      baseOrder({
        id: "11111111-1111-4111-8111-111111111111",
        shipmentCount: 1849,
        valueCents: 55500,
        status: "paid",
        paidAt: "2026-08-01T15:00:00.000Z",
        bonusShipmentsApplied: 0,
        bonusSettlementAt: "2026-08-01T15:00:00.000Z",
      }),
    );
    orders.create(
      baseOrder({
        id: "22222222-2222-4222-8222-222222222222",
        shipmentCount: 5829,
        valueCents: 0,
        status: "paid",
        paidAt: "2026-09-04T12:00:00.000Z",
        grantSource: "admin-bonus-envios",
        grantActive: true,
        creditsValidUntil: "2026-09-05T12:00:00.000Z",
        bonusShipmentsApplied: 829,
        bonusSettlementAt: "2026-09-04T12:00:00.000Z",
      }),
    );

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.byApi.oficial.remainingShipments, 1849);
    assert.equal(summary.byApi.oficial.pendingBonusShipments, 829);
  });
});
