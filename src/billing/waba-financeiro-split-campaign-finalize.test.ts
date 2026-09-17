import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";
process.env.WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED = "0";
process.env.WABA_FINANCEIRO_CET_CENTS_PER_OPERATION = "298";

const EMAIL = "ana.assinante@exemplo.com";
const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-split-delivered-"));
const now = "2026-09-17T15:00:00.000Z";

function writeJson(fileName: string, payload: unknown) {
  writeFileSync(path.join(process.cwd(), "data", fileName), JSON.stringify(payload, null, 2));
}

function seedFinanceiro() {
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  writeJson("waba-system-users.json", {
    version: 1,
    users: [
      {
        id: "op-1",
        fullName: "Operacional Fornecedor",
        email: "fornecedor@exemplo.com",
        passwordHash: "x",
        role: "operacional",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "master-a",
        fullName: "Master A",
        email: "master.a@exemplo.com",
        passwordHash: "x",
        role: "master",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "master-b",
        fullName: "Master B",
        email: "master.b@exemplo.com",
        passwordHash: "x",
        role: "master",
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  writeJson("waba-subscribers.json", {
    version: 1,
    subscribers: [
      {
        id: "sub-1",
        email: EMAIL,
        passwordHash: "x",
        fullName: "Ana Souza",
        whatsapp: "11999999999",
        phone: "11999999999",
        cpfCnpj: "00000000191",
        segment: "outros",
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  writeJson("waba-financeiro-split-config.json", {
    version: 2,
    updatedAt: now,
    suppliers: [
      {
        id: "sup-oficial",
        name: "Fornecedor Oficial",
        apiKind: "oficial",
        systemUserEmail: "fornecedor@exemplo.com",
        segment: "outros",
        priority: 1,
        costPerShipmentCents: 19,
        pixKey: "fornecedor@pix.com",
        active: true,
      },
    ],
    participants: [
      {
        id: "part-a",
        label: "Master A",
        email: "master.a@exemplo.com",
        pixKey: "master.a@pix.com",
        sharePercent: 50,
        active: true,
      },
      {
        id: "part-b",
        label: "Master B",
        email: "master.b@exemplo.com",
        pixKey: "master.b@pix.com",
        sharePercent: 50,
        active: true,
      },
    ],
  });
  writeJson("waba-financeiro-split-settlements.json", { version: 1, settlements: [] });
  writeJson("waba-billing-orders.json", []);
  writeJson("waba-campaign-intakes.json", { version: 1, intakes: [] });
  writeJson("waba-indicator-commissions.json", { version: 1, commissions: [] });
  writeJson("waba-indicator-profiles.json", { version: 1, profiles: [] });
  writeJson("waba-indicator-audit.json", { version: 1, events: [] });
}

function paidOrder(overrides: Partial<WabaBillingOrder> = {}): WabaBillingOrder {
  return {
    id: "order-new",
    product: "waba-disparos",
    apiKind: "oficial",
    customerName: "Ana",
    ownerEmail: EMAIL,
    whatsapp: "11999999999",
    cpfCnpj: "00000000191",
    billingType: "PIX",
    valueCents: 30000,
    shipmentCount: 1000,
    purchasedShipmentCount: 1000,
    status: "paid",
    asaasExternalReference: "waba:order-new",
    createdAt: now,
    updatedAt: now,
    paidAt: now,
    ...overrides,
  };
}

function completedIntake(
  overrides: Partial<WabaCampaignIntake> & { id: string },
): WabaCampaignIntake {
  const createdAt = String(overrides.createdAt ?? now);
  return {
    regionDdd: "11",
    campaignName: "Campanha nova",
    textOptions: ["a", "b", "c"],
    imageFileName: "a.png",
    imageStoredPath: "/tmp/a.png",
    spreadsheetFileName: "a.csv",
    spreadsheetStoredPath: "/tmp/a.csv",
    importedLineCount: 1000,
    plannedSendCount: 1000,
    apiKind: "oficial",
    status: "completed",
    createdAt,
    updatedAt: createdAt,
    ownerEmail: EMAIL,
    assignedOperacionalEmail: "fornecedor@exemplo.com",
    assignedSupplierId: "sup-oficial",
    creditFunding: { fromPaid: 1000, fromBonus: 0 },
    performanceReport: {
      totalLeads: 1000,
      sent: 1000,
      delivered: 800,
      read: 400,
      failed: 50,
      filledAt: createdAt,
      filledByEmail: "fornecedor@exemplo.com",
    },
    ...overrides,
  };
}

describe("Split inicia só após finalizar campanha nova", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
    seedFinanceiro();
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("não cria settlement no PIX de crédito a partir de 17/09/2026", async () => {
    seedFinanceiro();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaFinanceiroSplitService } = await import("./waba-financeiro-split.service");
    const orders = new WabaBillingOrderRepository();
    const order = paidOrder({ paidAt: "2026-09-17T12:00:00.000Z" });
    orders.create(order);
    const split = new WabaFinanceiroSplitService();
    const settlement = await split.settleAndPayoutPaidOrder(order);
    assert.equal(settlement, null);
    assert.equal(split.getSettlementByOrderId(order.id), null);
  });

  it("pedido antigo ainda liquida no pagamento com a quantidade comprada", async () => {
    seedFinanceiro();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaFinanceiroSplitService } = await import("./waba-financeiro-split.service");
    const orders = new WabaBillingOrderRepository();
    const order = paidOrder({
      id: "order-old",
      paidAt: "2026-09-16T12:00:00.000Z",
      createdAt: "2026-09-16T12:00:00.000Z",
      asaasExternalReference: "waba:order-old",
    });
    orders.create(order);
    const split = new WabaFinanceiroSplitService();
    const settlement = await split.settleAndPayoutPaidOrder(order);
    assert.ok(settlement);
    assert.equal(settlement?.purchasedShipmentCount, 1000);
    assert.equal(settlement?.supplierCostCents, 19000);
  });

  it("campanha nova finalizada paga fornecedor pelas entregues e rateia o lucro", async () => {
    seedFinanceiro();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaFinanceiroSplitService } = await import("./waba-financeiro-split.service");
    const orders = new WabaBillingOrderRepository();
    const order = paidOrder();
    orders.create(order);
    const split = new WabaFinanceiroSplitService();
    assert.equal(await split.settleAndPayoutPaidOrder(order), null);

    const settlement = await split.payoutSupplierForCompletedCampaign(
      completedIntake({ id: "camp-nova", createdAt: "2026-09-17T14:00:00.000Z" }),
    );
    assert.ok(settlement);
    assert.equal(settlement?.campaignIntakeId, "camp-nova");
    assert.equal(settlement?.purchasedShipmentCount, 800);
    assert.equal(settlement?.supplierCostCents, 15200);
    assert.equal(settlement?.cetCents, 298);
    assert.equal(settlement?.distributableCents, 14502);
    const supplierLine = settlement?.lines.find((line) => line.lineKind === "supplier");
    assert.equal(supplierLine?.shipmentCount, 800);
    assert.equal(supplierLine?.amountCents, 15200);
    assert.equal(supplierLine?.payoutStatus, "pending");
    const partners = settlement?.lines.filter((line) => line.lineKind === "partner") ?? [];
    assert.equal(partners.length, 2);
    assert.equal(
      partners.reduce((sum, line) => sum + line.amountCents, 0),
      14502,
    );
  });

  it("campanha antiga finalizada ainda usa enviados no fornecedor", async () => {
    seedFinanceiro();
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaFinanceiroSplitService } = await import("./waba-financeiro-split.service");
    const orders = new WabaBillingOrderRepository();
    const order = paidOrder({
      id: "order-legacy-camp",
      paidAt: "2026-09-17T12:00:00.000Z",
      asaasExternalReference: "waba:order-legacy-camp",
    });
    orders.create(order);
    const split = new WabaFinanceiroSplitService();
    const settlement = await split.payoutSupplierForCompletedCampaign(
      completedIntake({
        id: "camp-antiga",
        createdAt: "2026-09-10T14:00:00.000Z",
        campaignName: "Campanha antiga",
      }),
    );
    assert.ok(settlement);
    assert.equal(settlement?.purchasedShipmentCount, 1000);
    assert.equal(settlement?.supplierCostCents, 19000);
    const supplierLine = settlement?.lines.find((line) => line.lineKind === "supplier");
    assert.equal(supplierLine?.shipmentCount, 1000);
  });
});
