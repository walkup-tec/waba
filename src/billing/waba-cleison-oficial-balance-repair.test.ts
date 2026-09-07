import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { WabaBillingOrder } from "./waba-billing-order.repository";

const EMAIL = "cleison.fel@gmail.com";
const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-cleison-force-"));

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "";

function resetStore() {
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

describe("Força saldo Oficial Cleison 5829 / 0 bonificados", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
    resetStore();
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("substitui 1849 e PIX pendente por 5829 lifetime sem bonificados", async () => {
    resetStore();
    delete process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR;

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "11111111-1111-4111-8111-111111111111",
        shipmentCount: 1849,
        status: "paid",
        paidAt: "2026-08-01T15:00:00.000Z",
        bonusShipmentsApplied: 0,
      }),
    );
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 5000,
        status: "pending_payment",
        asaasPaymentId: "pay_cleison_5000",
      }),
    );
    new WabaDisparosBonusRepository().grantFromCampaign(
      EMAIL,
      "368d053b-d59b-4eed-a235-fe9e9f32c68c",
      829,
      "oficial",
    );

    const credits = new WabaDisparosCreditsService(orders);
    const first = credits.getCreditsSummary(EMAIL);
    assert.equal(first.byApi.oficial.remainingShipments, 5829);
    assert.equal(first.byApi.oficial.pendingBonusShipments, 0);

    const second = credits.getCreditsSummary(EMAIL);
    assert.equal(second.byApi.oficial.remainingShipments, 5829);
    assert.equal(second.byApi.oficial.pendingBonusShipments, 0);

    const pendingPix = orders.getById("7c1e5000-0ff1-4c1a-9c1e-000000005000");
    assert.equal(pendingPix?.status, "paid");
    assert.ok(String(pendingPix?.creditsValidUntil ?? "").length > 0);
  });
});
