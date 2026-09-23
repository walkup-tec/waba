import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { WabaBillingOrder } from "./waba-billing-order.repository";

process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR = "1";
process.env.WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED = "0";
process.env.WABA_FINANCEIRO_CET_CENTS_PER_OPERATION = "0";

const EDUARDO = "eduardo.master@exemplo.com";
const WALKUP = "walkup@walkuptec.com.br";
const HIS_EMAIL = "cliente.eduardo@exemplo.com";
const OTHER_EMAIL = "cliente.site@exemplo.com";
const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-eduardo-split-"));
const now = "2026-09-23T15:00:00.000Z";

function writeJson(fileName: string, payload: unknown) {
  writeFileSync(path.join(process.cwd(), "data", fileName), JSON.stringify(payload, null, 2));
}

function seed(createdByEmail: string | null, ownerEmail: string) {
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  writeJson("waba-system-users.json", {
    version: 1,
    users: [
      {
        id: "op-1",
        fullName: "Operacional",
        email: "fornecedor@exemplo.com",
        passwordHash: "x",
        role: "operacional",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "eduardo",
        fullName: "Eduardo Master",
        email: EDUARDO,
        passwordHash: "x",
        role: "master",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "walkup",
        fullName: "Walkup",
        email: WALKUP,
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
        email: ownerEmail,
        passwordHash: "x",
        fullName: "Cliente",
        whatsapp: "11999999999",
        phone: "11999999999",
        cpfCnpj: "00000000191",
        segment: "outros",
        createdByEmail,
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
        systemUserEmail: "",
        segment: "outros",
        priority: 1,
        costPerShipmentCents: 0,
        pixKey: "fornecedor@pix.com",
        active: true,
      },
    ],
    participants: [
      {
        id: "part-eduardo",
        label: "Eduardo",
        email: EDUARDO,
        pixKey: "eduardo@pix.com",
        sharePercent: 50,
        active: true,
      },
      {
        id: "part-walkup",
        label: "Walkup",
        email: WALKUP,
        pixKey: "walkup@pix.com",
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
  writeJson("waba-master-disparos-policy.json", { version: 1, policies: [] });
}

function paidOrder(ownerEmail: string, id: string): WabaBillingOrder {
  return {
    id,
    product: "waba-disparos",
    apiKind: "oficial",
    customerName: "Cliente",
    ownerEmail,
    whatsapp: "11999999999",
    cpfCnpj: "00000000191",
    billingType: "PIX",
    valueCents: 30000,
    shipmentCount: 1000,
    purchasedShipmentCount: 1000,
    status: "paid",
    asaasExternalReference: `waba:${id}`,
    createdAt: "2026-09-16T12:00:00.000Z",
    updatedAt: "2026-09-16T12:00:00.000Z",
    paidAt: "2026-09-16T12:00:00.000Z",
  };
}

describe("Split de lucro pela origem do assinante do Eduardo", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
    seed(null, OTHER_EMAIL);
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("assinante cadastrado pelo Eduardo continua 50/50 e a config não muda", async () => {
    seed(EDUARDO, HIS_EMAIL);
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaFinanceiroSplitService } = await import("./waba-financeiro-split.service");
    const orders = new WabaBillingOrderRepository();
    const order = paidOrder(HIS_EMAIL, "order-eduardo");
    order.paidAt = now;
    order.createdAt = now;
    orders.create(order);
    const split = new WabaFinanceiroSplitService();
    const settlement = split.settlePaidOrder(order);
    const partners = (settlement?.lines ?? []).filter((line) => line.lineKind === "partner");
    assert.deepEqual(
      partners.map((line) => [line.participantEmail, line.sharePercent, line.amountCents]),
      [
        [EDUARDO, 50, 15000],
        [WALKUP, 50, 15000],
      ],
    );
    const config = split.getConfig();
    assert.deepEqual(
      config.participants.map((item) => item.sharePercent),
      [50, 50],
    );
  });

  it("assinante de outro canal a partir de hoje: Walkup 100% e Eduardo skipped", async () => {
    seed(null, OTHER_EMAIL);
    const { WabaBillingOrderRepository } = await import("./waba-billing-order.repository");
    const { WabaFinanceiroSplitService } = await import("./waba-financeiro-split.service");
    const orders = new WabaBillingOrderRepository();
    const order = paidOrder(OTHER_EMAIL, "order-site");
    order.paidAt = now;
    order.createdAt = now;
    orders.create(order);
    const split = new WabaFinanceiroSplitService();
    const settlement = split.settlePaidOrder(order);
    const partners = (settlement?.lines ?? []).filter((line) => line.lineKind === "partner");
    assert.deepEqual(
      partners.map((line) => [line.participantEmail, line.sharePercent, line.amountCents, line.payoutStatus]),
      [
        [EDUARDO, 0, 0, "skipped"],
        [WALKUP, 100, 30000, "pending"],
      ],
    );
    assert.deepEqual(
      split.getConfig().participants.map((item) => item.sharePercent),
      [50, 50],
    );
  });
});
