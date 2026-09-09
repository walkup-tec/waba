import assert from "node:assert/strict";
import type { Server } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import os from "os";
import path from "path";
import { after, before, describe, it } from "node:test";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";

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
  for (const marker of [
    path.join(dataDir, "waba-cleison-void-1016-admin-grants.json"),
    path.join(dataDir, "v01", "waba-cleison-void-1016-admin-grants.json"),
    path.join(dataDir, "v02", "waba-cleison-void-1016-admin-grants.json"),
  ]) {
    if (existsSync(marker)) unlinkSync(marker);
  }
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
    assert.equal(summary.byApi.oficial.remainingShipments, 2000);

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
      assert.equal(Number(body.byApi.oficial.remainingShipments), 2000);
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
    assert.equal(summary.byApi.oficial.remainingShipments, 2000);
  });

  it("desativa os três bônus master 1016 vitalícios duplicados do Cleison", async () => {
    resetStore();
    delete process.env.WABA_ENABLE_CLEISON_BALANCE_REPAIR;
    process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaAdminBonusEnviosService } = await import("../admin/waba-admin-bonus-envios.service");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");
    const { WabaSubscriberRepository } = await import("../subscribers/waba-subscriber.repository");

    const orders = new WabaBillingOrderRepository();
    for (const id of [
      "b1016001-0001-4000-8000-000000000001",
      "b1016001-0001-4000-8000-000000000002",
      "b1016001-0001-4000-8000-000000000003",
    ]) {
      orders.create(
        baseOrder({
          id,
          valueCents: 0,
          shipmentCount: 1016,
          status: "paid",
          paidAt: "2026-09-09T14:20:00.000Z",
          createdAt: "2026-09-09T14:20:00.000Z",
          asaasExternalReference: `waba:bonus-envios:${id}`,
          grantSource: "admin-bonus-envios",
          grantCreatedByEmail: "marcelo.mozart@icloud.com",
          grantActive: true,
          creditsValidUntil: null,
          validityMode: "lifetime",
          bonusShipmentsApplied: 0,
        }),
      );
    }

    const listed = new WabaAdminBonusEnviosService(
      new WabaSubscriberRepository(),
      orders,
      new WabaDisparosCreditsService(orders),
    ).listPublicGrants();
    assert.equal(
      listed.filter((item) => item.grantActive && item.shipmentCount === 1016).length,
      0,
    );
    assert.equal(orders.getById("b1016001-0001-4000-8000-000000000001")?.grantActive, false);
    assert.equal(orders.getById("b1016001-0001-4000-8000-000000000002")?.grantActive, false);
    assert.equal(orders.getById("b1016001-0001-4000-8000-000000000003")?.grantActive, false);

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.byApi.oficial.remainingShipments, 0);
  });

  it("segundo clique no mesmo bônus master não cria outro pedido", async () => {
    resetStore();
    delete process.env.WABA_ENABLE_CLEISON_BALANCE_REPAIR;
    process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");
    const { WabaAdminBonusEnviosService } = await import("../admin/waba-admin-bonus-envios.service");
    const { WabaSubscriberRepository } = await import("../subscribers/waba-subscriber.repository");

    const orders = new WabaBillingOrderRepository();
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

    const service = new WabaAdminBonusEnviosService(
      new WabaSubscriberRepository(),
      orders,
      new WabaDisparosCreditsService(orders),
    );
    const first = service.grant({
      subscriberId: "sub-cleison",
      shipmentCount: 400,
      apiKind: "oficial",
      validityMode: "lifetime",
      createdByEmail: "marcelo.mozart@icloud.com",
    });
    const second = service.grant({
      subscriberId: "sub-cleison",
      shipmentCount: 400,
      apiKind: "oficial",
      validityMode: "lifetime",
      createdByEmail: "marcelo.mozart@icloud.com",
    });

    assert.equal(second.order.id, first.order.id);
    assert.equal(
      orders.list().filter((order) => order.grantSource === "admin-bonus-envios" && order.grantActive !== false)
        .length,
      1,
    );
  });

  it("histórico de compras reais: 13.000 contratados e sem 1016 triplicado", async () => {
    resetStore();
    delete process.env.WABA_ENABLE_CLEISON_BALANCE_REPAIR;
    delete process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR;

    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaDisparosBonusRepository } = await import("./waba-disparos-bonus.repository");
    const { WabaCampaignIntakeRepository } = await import("../disparos/waba-campaign-intake.repository");
    const { WabaDisparosCreditsService } = await import("./waba-disparos-credits.service");
    const { CLEISON_OFICIAL_FORCE_REF } = await import("./waba-cleison-oficial-balance-repair");

    const bonus = new WabaDisparosBonusRepository();
    bonus.grantFromCampaign(EMAIL, "camp-jandira", 834, "oficial", "2026-09-02T12:00:00.000Z");
    bonus.grantFromCampaign(EMAIL, "camp-jandira-2", 829, "oficial", "2026-09-03T18:51:00.000Z");
    bonus.grantFromCampaign(EMAIL, "camp-ptx", 1016, "oficial", "2026-09-08T22:00:00.000Z");

    const intakes = new WabaCampaignIntakeRepository();
    intakes.create(
      completedIntake({
        id: "camp-jandira",
        campaignName: "Campanha Jandira",
        plannedSendCount: 1990,
        createdAt: "2026-09-02T12:00:00.000Z",
        performanceReport: {
          totalLeads: 1990,
          sent: 1156,
          delivered: 0,
          read: 0,
          failed: 0,
          filledAt: "2026-09-02T18:00:00.000Z",
          filledByEmail: "op@test.com",
        },
      }),
    );
    intakes.create(
      completedIntake({
        id: "camp-jandira-2",
        campaignName: "Campanha Jandira 2",
        plannedSendCount: 1990,
        createdAt: "2026-09-03T18:51:00.000Z",
        performanceReport: {
          totalLeads: 1990,
          sent: 1161,
          delivered: 0,
          read: 0,
          failed: 0,
          filledAt: "2026-09-03T22:00:00.000Z",
          filledByEmail: "op@test.com",
        },
      }),
    );
    intakes.create(
      completedIntake({
        id: "camp-ptx",
        campaignName: "Opt in PTX",
        plannedSendCount: 1990,
        createdAt: "2026-09-08T22:00:00.000Z",
        performanceReport: {
          totalLeads: 1990,
          sent: 1980,
          delivered: 0,
          read: 0,
          failed: 0,
          filledAt: "2026-09-09T02:00:00.000Z",
          filledByEmail: "op@test.com",
        },
      }),
    );
    intakes.create(
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

    const consumed = 1156 + 1161 + 1980;
    const orders = new WabaBillingOrderRepository();
    const freezePaidAt = "2026-09-07T13:30:15.000Z";
    orders.create(
      baseOrder({
        id: "aaaaaaaa-1111-4111-8111-ffffffffffff",
        valueCents: 0,
        shipmentCount: 5829,
        purchasedShipmentCount: 5829,
        status: "paid",
        paidAt: freezePaidAt,
        asaasExternalReference: CLEISON_OFICIAL_FORCE_REF,
        grantSource: "admin-bonus-envios",
        grantCreatedByEmail: "system-balance-repair",
        grantActive: true,
        creditsValidUntil: null,
        validityMode: "lifetime",
        bonusShipmentsApplied: 1016,
      }),
    );
    for (const [index, paidAt] of [
      "2026-09-09T19:26:00.000Z",
      "2026-09-09T14:21:00.000Z",
      "2026-09-09T13:47:00.000Z",
      "2026-09-09T13:47:30.000Z",
    ].entries()) {
      const id = `b1016001-000${index + 1}-4000-8000-00000000000${index + 1}`;
      orders.create(
        baseOrder({
          id,
          valueCents: 0,
          shipmentCount: 1016,
          purchasedShipmentCount: 1016,
          status: "paid",
          paidAt,
          createdAt: paidAt,
          asaasExternalReference: `waba:bonus-envios:${id}`,
          grantSource: "admin-bonus-envios",
          grantCreatedByEmail: "marcelo.mozart@icloud.com",
          grantActive: true,
          creditsValidUntil: null,
          validityMode: "lifetime",
        }),
      );
    }
    for (const index of [1, 2, 3]) {
      orders.create(
        baseOrder({
          id: `cccccccc-000${index}-4000-8000-000000003000`,
          valueCents: 99000,
          shipmentCount: 3000,
          purchasedShipmentCount: 3000,
          status: "paid",
          paidAt: freezePaidAt,
          createdAt: freezePaidAt,
          grantActive: true,
        }),
      );
    }
    orders.create(
      baseOrder({
        id: "dddddddd-2834-4000-8000-000000002834",
        shipmentCount: 2834,
        purchasedShipmentCount: 2834,
        valueCents: 0,
        status: "paid",
        paidAt: "2026-09-03T12:03:00.000Z",
        createdAt: "2026-09-03T12:03:00.000Z",
        bonusShipmentsApplied: 834,
      }),
    );
    orders.create(
      baseOrder({
        id: "11111111-1111-4111-8111-111111111111",
        shipmentCount: 3000,
        purchasedShipmentCount: 3000,
        valueCents: 0,
        status: "paid",
        paidAt: "2026-09-01T13:05:00.000Z",
        createdAt: "2026-09-01T13:05:00.000Z",
        grantActive: true,
      }),
    );
    orders.create(
      baseOrder({
        id: "00000000-0000-4000-8000-000000005000",
        shipmentCount: 5000,
        purchasedShipmentCount: 5000,
        valueCents: 160000,
        status: "paid",
        paidAt: "2026-08-01T15:00:00.000Z",
        createdAt: "2026-07-15T12:00:00.000Z",
        grantActive: true,
        creditsValidUntil: PAST,
        validityMode: "custom",
        bonusShipmentsApplied: 0,
      }),
    );
    orders.create(
      baseOrder({
        id: "7c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 6663,
        purchasedShipmentCount: 6663,
        valueCents: 160000,
        status: "paid",
        paidAt: "2026-09-05T19:26:22.000Z",
        createdAt: "2026-09-05T19:20:00.000Z",
        asaasPaymentId: "pay_cleison_5000_sep05",
        asaasPaymentStatus: "CONFIRMED",
        grantActive: true,
        creditsValidUntil: PAST,
        validityMode: "custom",
        bonusShipmentsApplied: 1663,
      }),
    );
    orders.create(
      baseOrder({
        id: "9c1e5000-0ff1-4c1a-9c1e-000000005000",
        shipmentCount: 7679,
        purchasedShipmentCount: 7679,
        valueCents: 160000,
        status: "paid",
        paidAt: "2026-09-09T13:20:00.000Z",
        createdAt: "2026-09-09T13:15:00.000Z",
        asaasPaymentId: "pay_cleison_5000_sep09",
        asaasPaymentStatus: "CONFIRMED",
        grantActive: true,
        bonusShipmentsApplied: 2679,
      }),
    );

    const summary = new WabaDisparosCreditsService(orders).getCreditsSummary(EMAIL);
    assert.equal(summary.contractedShipments, 13000);
    assert.equal(summary.consumedShipments, consumed);
    assert.equal(summary.byApi.oficial.remainingShipments, 13000 - consumed);
    assert.equal(summary.byApi.oficial.pendingBonusShipments, 0);
    assert.equal(summary.paidOrderCount, 3);
    assert.equal(summary.pendingBonusShipments, 0);
    assert.equal(summary.contractedValueCents, 160000 + 160000);
    assert.equal(summary.lastPaidAt, "2026-09-09T13:20:00.000Z");

    assert.equal(orders.getById("aaaaaaaa-1111-4111-8111-ffffffffffff")?.grantActive, false);
    assert.equal(orders.getById("b1016001-0001-4000-8000-000000000001")?.grantActive, false);
    const pixSep05 = orders.getById("7c1e5000-0ff1-4c1a-9c1e-000000005000");
    const pixSep09 = orders.getById("9c1e5000-0ff1-4c1a-9c1e-000000005000");
    assert.equal(pixSep05?.bonusShipmentsApplied, 834 + 829);
    assert.equal(pixSep09?.bonusShipmentsApplied, 1016);

    const credits = new WabaDisparosCreditsService(orders);
    const purchases = credits.listPurchaseHistory(EMAIL);
    assert.equal(purchases.length, 3);
    assert.deepEqual(
      purchases.map((item) => item.purchasedShipmentCount),
      [5000, 5000, 3000],
    );
    assert.equal(purchases.every((item) => item.bonusShipmentsApplied === 0), true);
    assert.equal(purchases.some((item) => item.purchasedShipmentCount === 1016), false);
    assert.equal(purchases.some((item) => item.id === "aaaaaaaa-1111-4111-8111-ffffffffffff"), false);
    assert.equal(purchases.some((item) => item.id === "dddddddd-2834-4000-8000-000000002834"), false);
    assert.equal(purchases.some((item) => item.id.startsWith("cccccccc-")), false);

    const bonusHistory = credits.listBonusHistory(EMAIL);
    assert.equal(bonusHistory.length, 3);
    assert.equal(bonusHistory.find((item) => item.campaignId === "camp-ptx")?.status, "applied");
    assert.equal(bonusHistory.find((item) => item.campaignId === "camp-jandira")?.status, "applied");
    assert.equal(bonusHistory.find((item) => item.campaignId === "camp-jandira-2")?.status, "applied");

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
      const headers = { cookie: `waba_session=${token}` };
      const response = await fetch(`http://127.0.0.1:${port}/billing/disparos/credits`, { headers });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(Number(body.contractedShipments), 13000);
      assert.equal(Number(body.consumedShipments), consumed);
      assert.equal(Number(body.byApi.oficial.remainingShipments), 13000 - consumed);
      assert.equal(Number(body.byApi.oficial.pendingBonusShipments), 0);
      assert.equal(Number(body.paidOrderCount), 3);

      const purchasesRes = await fetch(`http://127.0.0.1:${port}/billing/disparos/purchases?limit=20`, {
        headers,
      });
      assert.equal(purchasesRes.status, 200);
      const purchasesBody = await purchasesRes.json();
      const purchaseItems = Array.isArray(purchasesBody.items) ? purchasesBody.items : [];
      assert.equal(purchaseItems.length, 3);
      assert.deepEqual(
        purchaseItems.map((item: { purchasedShipmentCount: number }) => Number(item.purchasedShipmentCount)),
        [5000, 5000, 3000],
      );
      assert.equal(
        purchaseItems.some((item: { purchasedShipmentCount: number }) => Number(item.purchasedShipmentCount) === 1016),
        false,
      );

      const bonusRes = await fetch(`http://127.0.0.1:${port}/billing/disparos/bonus-history?limit=20`, {
        headers,
      });
      assert.equal(bonusRes.status, 200);
      const bonusBody = await bonusRes.json();
      const bonusItems = Array.isArray(bonusBody.items) ? bonusBody.items : [];
      assert.equal(bonusItems.length, 3);
      assert.equal(
        bonusItems.find((item: { campaignId: string }) => item.campaignId === "camp-ptx")?.status,
        "applied",
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
