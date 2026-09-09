import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";

const EMAIL = "ana.assinante@exemplo.com";
const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-bonus-settle-"));

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
  const emptyUsage = JSON.stringify({ version: 2, entries: [] });
  writeFileSync(path.join(dataDir, "waba-disparos-credit-usage.json"), emptyUsage);
  writeFileSync(path.join(dataDir, "v01", "waba-disparos-credit-usage.json"), emptyUsage);
  writeFileSync(path.join(dataDir, "v02", "waba-disparos-credit-usage.json"), emptyUsage);
  const emptyIntakes = JSON.stringify({ version: 1, intakes: [] });
  writeFileSync(path.join(dataDir, "waba-campaign-intakes.json"), emptyIntakes);
  writeFileSync(path.join(dataDir, "v01", "waba-campaign-intakes.json"), emptyIntakes);
  writeFileSync(path.join(dataDir, "v02", "waba-campaign-intakes.json"), emptyIntakes);
}

function baseOrder(overrides: Partial<WabaBillingOrder>): WabaBillingOrder {
  const now = new Date().toISOString();
  return {
    id: "order-base",
    product: "waba-disparos",
    apiKind: "oficial",
    customerName: "Ana",
    ownerEmail: EMAIL,
    whatsapp: "11999999999",
    cpfCnpj: "00000000191",
    billingType: "PIX",
    valueCents: 160000,
    shipmentCount: 5000,
    purchasedShipmentCount: 5000,
    status: "paid",
    asaasExternalReference: `waba:${overrides.id || "order-base"}`,
    createdAt: now,
    updatedAt: now,
    paidAt: now,
    ...overrides,
  };
}

function completedIntake(overrides: Partial<WabaCampaignIntake> & { id: string }): WabaCampaignIntake {
  const createdAt = String(overrides.createdAt ?? "2026-09-02T12:00:00.000Z");
  const totalLeads = Math.round(Number(overrides.plannedSendCount ?? 1990));
  const sent = Math.round(Number(overrides.performanceReport?.sent ?? 1156));
  return {
    regionDdd: "11",
    campaignName: "Campanha teste",
    textOptions: ["a", "b", "c"],
    imageFileName: "a.png",
    imageStoredPath: "/tmp/a.png",
    spreadsheetFileName: "a.csv",
    spreadsheetStoredPath: "/tmp/a.csv",
    importedLineCount: totalLeads,
    plannedSendCount: totalLeads,
    apiKind: "oficial",
    status: "completed",
    createdAt,
    updatedAt: createdAt,
    ownerEmail: EMAIL,
    performanceReport: {
      totalLeads,
      sent,
      delivered: 0,
      read: 0,
      failed: 0,
      filledAt: createdAt,
      filledByEmail: "op@test.com",
    },
    ...overrides,
  };
}

describe("Bonificação de campanha entra na compra paga posterior", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
    resetStore();
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("dois leftovers anteriores à compra somam no disponível; bônus posterior fica pendente", async () => {
    resetStore();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    const bonus = new WabaDisparosBonusRepository();
    bonus.grantFromCampaign(EMAIL, "camp-jandira", 834, "oficial", "2026-09-02T12:00:00.000Z");
    bonus.grantFromCampaign(EMAIL, "camp-jandira-2", 829, "oficial", "2026-09-03T18:51:00.000Z");
    bonus.grantFromCampaign(EMAIL, "camp-ptx", 1016, "oficial", "2026-09-08T22:00:00.000Z");

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "11111111-1111-4111-8111-111111111111",
        shipmentCount: 3000,
        purchasedShipmentCount: 3000,
        valueCents: 99000,
        paidAt: "2026-09-01T13:05:00.000Z",
        createdAt: "2026-09-01T13:05:00.000Z",
        bonusShipmentsApplied: 0,
      }),
    );
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 5000,
        purchasedShipmentCount: 5000,
        paidAt: "2026-09-05T19:26:22.000Z",
        createdAt: "2026-09-05T19:20:00.000Z",
        bonusShipmentsApplied: 0,
      }),
    );

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.byApi.oficial.pendingBonusShipments, 1016);
    assert.equal(summary.byApi.oficial.remainingShipments, 8000);
    assert.equal(summary.paidOrderCount, 2);
    assert.equal(summary.contractedShipments, 8000);
    const paid = orders.getById("7c1e5000-0ff1-4c1a-9c1e-000000005000");
    assert.equal(paid?.bonusShipmentsApplied, 834 + 829);
    assert.equal(paid?.shipmentCount, 5000 + 834 + 829);

    const credits = new WabaDisparosCreditsService(orders);
    const purchases = credits.listPurchaseHistory(EMAIL);
    assert.equal(purchases.length, 2);
    assert.equal(purchases[0]?.id, "7c1e5000-0ff1-4c1a-9c1e-000000005000");
    assert.equal(purchases[0]?.purchasedShipmentCount, 5000);
    assert.equal(purchases[0]?.shipmentCount, 5000);
    assert.equal(purchases[0]?.bonusShipmentsApplied, 0);
    assert.equal(purchases[1]?.purchasedShipmentCount, 3000);
    assert.equal(purchases[1]?.bonusShipmentsApplied, 0);

    const bonusHistory = credits.listBonusHistory(EMAIL);
    assert.equal(bonusHistory.length, 3);
    const byCampaign = Object.fromEntries(bonusHistory.map((item) => [item.campaignId, item]));
    assert.equal(byCampaign["camp-jandira"]?.status, "applied");
    assert.equal(byCampaign["camp-jandira-2"]?.status, "applied");
    assert.equal(byCampaign["camp-ptx"]?.status, "pending");
    assert.equal(byCampaign["camp-ptx"]?.shipments, 1016);
  });

  it("pedido que já liquidou só 829 ainda recebe o 834 anterior", async () => {
    resetStore();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    const bonus = new WabaDisparosBonusRepository();
    bonus.grantFromCampaign(EMAIL, "camp-jandira", 834, "oficial", "2026-09-02T12:00:00.000Z");
    bonus.grantFromCampaign(EMAIL, "camp-jandira-2", 829, "oficial", "2026-09-03T18:51:00.000Z");

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 5829,
        purchasedShipmentCount: 5000,
        paidAt: "2026-09-05T19:26:22.000Z",
        bonusShipmentsApplied: 829,
        bonusSettlementAt: "2026-09-05T19:26:22.000Z",
      }),
    );

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.byApi.oficial.pendingBonusShipments, 0);
    assert.equal(summary.byApi.oficial.remainingShipments, 5000);
    assert.equal(orders.getById("7c1e5000-0ff1-4c1a-9c1e-000000005000")?.bonusShipmentsApplied, 1663);
  });

  it("grant gravado depois da compra ainda liquida se a campanha é anterior", async () => {
    resetStore();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    const bonus = new WabaDisparosBonusRepository();
    bonus.grantFromCampaign(EMAIL, "camp-antes-da-compra", 834, "oficial");
    bonus.grantFromCampaign(
      EMAIL,
      "camp-antes-da-compra",
      834,
      "oficial",
      "2026-09-02T12:00:00.000Z",
    );

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        paidAt: "2026-09-05T19:26:22.000Z",
        bonusShipmentsApplied: 0,
      }),
    );

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.byApi.oficial.pendingBonusShipments, 0);
    assert.equal(summary.byApi.oficial.remainingShipments, 5000);
  });

  it("campanha com erro reportado não gera bônus nem consome saldo", async () => {
    resetStore();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaCampaignIntakeRepository } = await import("../disparos/waba-campaign-intake.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    new WabaCampaignIntakeRepository().create(
      completedIntake({
        id: "camp-nesio-erro",
        campaignName: "Campanha Nésio",
        status: "error_reported",
        plannedSendCount: 1002,
        createdAt: "2026-09-04T12:00:00.000Z",
        performanceReport: {
          totalLeads: 1002,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          filledAt: "2026-09-04T12:00:00.000Z",
          filledByEmail: "op@test.com",
        },
      }),
    );

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "11111111-1111-4111-8111-111111111111",
        shipmentCount: 3000,
        purchasedShipmentCount: 3000,
        valueCents: 99000,
        paidAt: "2026-08-01T15:00:00.000Z",
      }),
    );

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.byApi.oficial.pendingBonusShipments, 0);
    assert.equal(summary.byApi.oficial.consumedShipments, 0);
    assert.equal(summary.byApi.oficial.remainingShipments, 3000);
  });

  it("campanha com erro reportado não entra no histórico de bonificações", async () => {
    resetStore();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaCampaignIntakeRepository } = await import("../disparos/waba-campaign-intake.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    new WabaCampaignIntakeRepository().create(
      completedIntake({
        id: "camp-nesio-erro",
        campaignName: "Campanha Nésio",
        status: "error_reported",
        plannedSendCount: 1002,
        createdAt: "2026-09-04T12:00:00.000Z",
        performanceReport: {
          totalLeads: 1002,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          filledAt: "2026-09-04T12:00:00.000Z",
          filledByEmail: "op@test.com",
        },
      }),
    );
    new WabaDisparosBonusRepository().grantFromCampaign(EMAIL, "camp-nesio-erro", 1002, "oficial");

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "11111111-1111-4111-8111-111111111111",
        shipmentCount: 1849,
        purchasedShipmentCount: 1849,
        valueCents: 55500,
        paidAt: "2026-08-01T15:00:00.000Z",
      }),
    );

    const bonusHistory = new WabaDisparosCreditsService(orders).listBonusHistory(EMAIL);
    assert.equal(bonusHistory.some((item) => item.campaignId === "camp-nesio-erro"), false);
  });

  it("restante 1849 não absorve bônus posterior à compra mesmo com paidAt recente", async () => {
    resetStore();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");

    const bonus = new WabaDisparosBonusRepository();
    bonus.grantFromCampaign(EMAIL, "camp-jandira", 834, "oficial", "2026-09-02T12:00:00.000Z");
    bonus.grantFromCampaign(EMAIL, "camp-jandira-2", 829, "oficial", "2026-09-03T18:51:00.000Z");
    bonus.grantFromCampaign(EMAIL, "camp-ptx", 1016, "oficial", "2026-09-08T22:00:00.000Z");

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "11111111-1111-4111-8111-111111111111",
        shipmentCount: 1849 + 1016,
        purchasedShipmentCount: 1849,
        valueCents: 55500,
        paidAt: "2026-09-09T22:00:00.000Z",
        createdAt: "2026-08-01T15:00:00.000Z",
        bonusShipmentsApplied: 1016,
      }),
    );
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 5000 + 834 + 829 + 1016,
        purchasedShipmentCount: 5000,
        paidAt: "2026-09-05T19:26:22.000Z",
        createdAt: "2026-09-05T19:20:00.000Z",
        bonusShipmentsApplied: 834 + 829 + 1016,
      }),
    );

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.byApi.oficial.pendingBonusShipments, 1016);
    assert.equal(summary.byApi.oficial.remainingShipments, 5000);
    assert.equal(orders.getById("11111111-1111-4111-8111-111111111111")?.bonusShipmentsApplied, 0);
    assert.equal(orders.getById("7c1e5000-0ff1-4c1a-9c1e-000000005000")?.bonusShipmentsApplied, 1663);
  });
});
