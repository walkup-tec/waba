import assert from "node:assert/strict";
import type { Server } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "os";
import path from "path";
import { after, before, describe, it } from "node:test";
import type { WabaBillingOrder } from "./waba-billing-order.repository";

const EMAIL = "cleison.fel@gmail.com";
const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-cleison-credits-"));
const PAST = new Date(Date.now() - 120_000).toISOString();

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";
delete process.env.WABA_ENABLE_CLEISON_BALANCE_REPAIR;

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
  writeFileSync(path.join(dataDir, "waba-subscribers.json"), JSON.stringify({ version: 1, subscribers: [] }));
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

describe("Créditos Oficial Cleison após compra Asaas e grant master", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
    resetStore();
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("compra Asaas paga recebe os 1016 bonificados da Opt in PTX e o freeze 5829 sai", async () => {
    resetStore();
    delete process.env.WABA_ENABLE_CLEISON_BALANCE_REPAIR;
    process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");
    const { CLEISON_OFICIAL_FORCE_REF } = await import("./waba-cleison-oficial-balance-repair");

    new WabaDisparosBonusRepository().grantFromCampaign(
      EMAIL,
      "c213963a-209a-465e-b3b6-85fef1328caf",
      1016,
      "oficial",
    );

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "aaaaaaaa-1111-4111-8111-ffffffffffff",
        valueCents: 0,
        shipmentCount: 5829,
        status: "paid",
        paidAt: "2026-09-07T13:30:15.000Z",
        asaasExternalReference: CLEISON_OFICIAL_FORCE_REF,
        grantSource: "admin-bonus-envios",
        grantCreatedByEmail: "system-balance-repair",
        grantActive: true,
        creditsValidUntil: null,
        validityMode: "lifetime",
        bonusShipmentsApplied: 1016,
        bonusSettlementAt: "2026-09-07T13:30:15.000Z",
      }),
    );
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 2000,
        valueCents: 60000,
        status: "paid",
        paidAt: new Date(Date.now() + 2_000).toISOString(),
        asaasPaymentId: "pay_cleison_hoje",
        asaasPaymentStatus: "CONFIRMED",
        grantActive: false,
        creditsValidUntil: PAST,
        validityMode: "custom",
        bonusShipmentsApplied: 0,
        bonusSettlementAt: new Date().toISOString(),
      }),
    );

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.byApi.oficial.pendingBonusShipments, 0);
    assert.equal(summary.byApi.oficial.remainingShipments, 2000 + 1016);

    const force = orders.getById("aaaaaaaa-1111-4111-8111-ffffffffffff");
    assert.equal(force?.grantActive, false);
    const paid = orders.getById("7c1e5000-0ff1-4c1a-9c1e-000000005000");
    assert.equal(paid?.grantActive, true);
    assert.equal(paid?.creditsValidUntil, null);
    assert.equal(paid?.bonusShipmentsApplied, 1016);
    assert.equal(paid?.shipmentCount, 3016);
  });

  it("grant master de bônus permanece no Disponível depois do GET de créditos", async () => {
    resetStore();
    delete process.env.WABA_ENABLE_CLEISON_BALANCE_REPAIR;
    process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");
    const { WabaAdminBonusEnviosService } = await import("../admin/waba-admin-bonus-envios.service");
    const { WabaSubscriberRepository } = await import("../subscribers/waba-subscriber.repository");

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 2000,
        valueCents: 60000,
        status: "paid",
        paidAt: "2026-09-09T12:00:00.000Z",
        asaasPaymentId: "pay_cleison_hoje",
        asaasPaymentStatus: "CONFIRMED",
        grantActive: false,
        creditsValidUntil: PAST,
        validityMode: "custom",
        bonusShipmentsApplied: 0,
      }),
    );

    const now = new Date().toISOString();
    new WabaSubscriberRepository().create({
      id: "sub-cleison",
      email: EMAIL,
      passwordHash: "x",
      fullName: "Cleison",
      whatsapp: "11999999999",
      phone: "11999999999",
      cpfCnpj: "00000000191",
      createdAt: now,
      updatedAt: now,
    });

    const granted = new WabaAdminBonusEnviosService(
      new WabaSubscriberRepository(),
      orders,
      new WabaDisparosCreditsService(orders),
    ).grant({
      subscriberId: "sub-cleison",
      shipmentCount: 400,
      apiKind: "oficial",
      validityMode: "lifetime",
      createdByEmail: "marcelo.mozart@icloud.com",
    });

    assert.equal(granted.credits.remainingShipments, 2000 + 400);
    const again = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(again.byApi.oficial.remainingShipments, 2000 + 400);
    assert.equal(orders.getById(granted.order.id)?.grantActive, true);
    assert.equal(orders.getById(granted.order.id)?.creditsValidUntil, null);
  });

  it("GET /billing/disparos/credits não devolve mais 5829/0 com compra paga e bônus PTX", async () => {
    resetStore();
    delete process.env.WABA_ENABLE_CLEISON_BALANCE_REPAIR;
    process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { CLEISON_OFICIAL_FORCE_REF } = await import("./waba-cleison-oficial-balance-repair");

    new WabaDisparosBonusRepository().grantFromCampaign(
      EMAIL,
      "c213963a-209a-465e-b3b6-85fef1328caf",
      1016,
      "oficial",
    );

    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "aaaaaaaa-1111-4111-8111-ffffffffffff",
        valueCents: 0,
        shipmentCount: 5829,
        status: "paid",
        paidAt: "2026-09-07T13:30:15.000Z",
        asaasExternalReference: CLEISON_OFICIAL_FORCE_REF,
        grantSource: "admin-bonus-envios",
        grantCreatedByEmail: "system-balance-repair",
        grantActive: true,
        bonusShipmentsApplied: 1016,
      }),
    );
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 2000,
        valueCents: 60000,
        status: "paid",
        paidAt: new Date(Date.now() + 2_000).toISOString(),
        asaasPaymentId: "pay_cleison_hoje",
        asaasPaymentStatus: "CONFIRMED",
        grantActive: false,
        creditsValidUntil: PAST,
        validityMode: "custom",
        bonusShipmentsApplied: 0,
      }),
    );

    const express = (await import("express")).default;
    const { registerWabaBillingRoutes } = await import("./waba-billing.routes");
    const { createWabaSessionToken } = await import("../auth/waba-auth.service");

    const app = express();
    registerWabaBillingRoutes(app);
    const server: Server = await new Promise<Server>((resolve) => {
      const started = app.listen(0, "127.0.0.1", () => resolve(started));
    });
    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const token = createWabaSessionToken(EMAIL, "subscriber");
      const first = await fetch(`http://127.0.0.1:${port}/billing/disparos/credits`, {
        headers: { cookie: `waba_session=${token}` },
      });
      assert.equal(first.status, 200);
      const body = await first.json();
      assert.equal(Number(body.byApi.oficial.pendingBonusShipments), 0);
      assert.equal(Number(body.byApi.oficial.remainingShipments), 3016);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("não recongela 5829/0 mesmo com WABA_ENABLE_CLEISON_BALANCE_REPAIR=1", async () => {
    resetStore();
    process.env.WABA_ENABLE_CLEISON_BALANCE_REPAIR = "1";
    delete process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR;

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");
    const { CLEISON_OFICIAL_FORCE_REF } = await import("./waba-cleison-oficial-balance-repair");

    new WabaDisparosBonusRepository().grantFromCampaign(
      EMAIL,
      "c213963a-209a-465e-b3b6-85fef1328caf",
      1016,
      "oficial",
    );
    const orders = new WabaBillingOrderRepository();
    orders.create(
      baseOrder({
        id: "aaaaaaaa-1111-4111-8111-ffffffffffff",
        valueCents: 0,
        shipmentCount: 5829,
        status: "paid",
        paidAt: "2026-09-07T13:30:15.000Z",
        asaasExternalReference: CLEISON_OFICIAL_FORCE_REF,
        grantSource: "admin-bonus-envios",
        grantCreatedByEmail: "system-balance-repair",
        grantActive: true,
        bonusShipmentsApplied: 1016,
      }),
    );
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 2000,
        valueCents: 60000,
        status: "paid",
        paidAt: new Date(Date.now() + 2_000).toISOString(),
        asaasPaymentId: "pay_cleison_hoje",
        asaasPaymentStatus: "CONFIRMED",
        grantActive: false,
        creditsValidUntil: PAST,
        validityMode: "custom",
        bonusShipmentsApplied: 0,
      }),
    );

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.byApi.oficial.pendingBonusShipments, 0);
    assert.equal(summary.byApi.oficial.remainingShipments, 3016);
  });
});
