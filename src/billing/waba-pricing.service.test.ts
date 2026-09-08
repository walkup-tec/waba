import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-pricing-"));

const now = new Date().toISOString();

function writeJson(fileName: string, payload: unknown) {
  writeFileSync(path.join(process.cwd(), "data", fileName), JSON.stringify(payload, null, 2));
}

function seedStores(options?: { indicatorSpreadCents?: number; indicatorStatus?: "active" | "inactive" }) {
  const spread = options?.indicatorSpreadCents ?? 3;
  const status = options?.indicatorStatus ?? "active";
  writeJson("waba-subscribers.json", {
    version: 1,
    subscribers: [
      {
        id: "sub-plain",
        email: "livre@test.com",
        passwordHash: "x",
        fullName: "Cliente Livre",
        whatsapp: "11999999999",
        phone: "11999999999",
        cpfCnpj: "00000000191",
        segment: "outros",
        indicatorUserId: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sub-ind",
        email: "revenda@test.com",
        passwordHash: "x",
        fullName: "Cliente Indicador",
        whatsapp: "11988888888",
        phone: "11988888888",
        cpfCnpj: "00000000191",
        segment: "outros",
        indicatorUserId: "ind-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "sub-other",
        email: "outro@test.com",
        passwordHash: "x",
        fullName: "Outro Indicador",
        whatsapp: "11977777777",
        phone: "11977777777",
        cpfCnpj: "00000000191",
        segment: "outros",
        indicatorUserId: "ind-2",
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  writeJson("waba-indicator-profiles.json", {
    version: 1,
    profiles: [
      {
        id: "prof-1",
        userId: "ind-1",
        cpfCnpj: "12345678901",
        pixKey: "joao@pix.com",
        pixKeyType: "EMAIL",
        spreadCentsPerSend: spread,
        status,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "prof-2",
        userId: "ind-2",
        cpfCnpj: "12345678901",
        pixKey: "maria@pix.com",
        pixKeyType: "EMAIL",
        spreadCentsPerSend: 9,
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
}

describe("WabaPricingService — spread do indicador", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
    seedStores();
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("assinante sem indicador vê o preço-base Drax", async () => {
    seedStores();
    const { wabaPricingService } = await import("./waba-pricing.service");
    const quote = wabaPricingService.quote({
      apiKind: "oficial",
      shipmentCount: 1000,
      ownerEmail: "livre@test.com",
    });
    assert.equal(quote?.baseAmountCents, 32000);
    assert.equal(quote?.spreadAmountCents, 0);
    assert.equal(quote?.totalAmountCents, 32000);
    assert.equal(quote?.customerUnitPriceCents, 32);
    assert.equal(quote?.indicatorUserId, "");
  });

  it("assinante do indicador vê apenas o preço final com spread", async () => {
    seedStores({ indicatorSpreadCents: 3 });
    const { wabaPricingService } = await import("./waba-pricing.service");
    const quote = wabaPricingService.quote({
      apiKind: "oficial",
      shipmentCount: 1000,
      ownerEmail: "revenda@test.com",
    });
    assert.equal(quote?.baseAmountCents, 32000);
    assert.equal(quote?.spreadUnitPriceCents, 3);
    assert.equal(quote?.spreadAmountCents, 3000);
    assert.equal(quote?.totalAmountCents, 35000);
    assert.equal(quote?.customerUnitPriceCents, 35);
    const packs = wabaPricingService.listCustomerPackages({
      apiKind: "oficial",
      ownerEmail: "revenda@test.com",
    });
    const pack1000 = packs.find((item) => item.shipments === 1000);
    assert.equal(pack1000?.valueCents, 35000);
    assert.equal(pack1000?.unitPriceCents, 35);
  });

  it("outro assinante não herda o spread de um indicador alheio", async () => {
    seedStores();
    const { wabaPricingService } = await import("./waba-pricing.service");
    const quote = wabaPricingService.quote({
      apiKind: "oficial",
      shipmentCount: 1000,
      ownerEmail: "outro@test.com",
    });
    assert.equal(quote?.spreadUnitPriceCents, 9);
    assert.equal(quote?.totalAmountCents, 41000);
    const plain = wabaPricingService.quote({
      apiKind: "oficial",
      shipmentCount: 1000,
      ownerEmail: "livre@test.com",
    });
    assert.equal(plain?.totalAmountCents, 32000);
  });

  it("todas as faixas oficiais somam spread fixo por envio", async () => {
    seedStores({ indicatorSpreadCents: 3 });
    const { wabaPricingService } = await import("./waba-pricing.service");
    const expected: Array<[number, number, number]> = [
      [1000, 32000, 3000],
      [3000, 93000, 9000],
      [5000, 150000, 15000],
      [8000, 232000, 24000],
      [10000, 270000, 30000],
      [20000, 520000, 60000],
      [30000, 750000, 90000],
    ];
    for (const [qty, base, spread] of expected) {
      const quote = wabaPricingService.quote({
        apiKind: "oficial",
        shipmentCount: qty,
        ownerEmail: "revenda@test.com",
      });
      assert.equal(quote?.baseAmountCents, base, `${qty} base`);
      assert.equal(quote?.spreadAmountCents, spread, `${qty} spread`);
      assert.equal(quote?.totalAmountCents, base + spread, `${qty} total`);
    }
  });

  it("indicador inativo não aplica spread em novas cotações", async () => {
    seedStores({ indicatorSpreadCents: 3, indicatorStatus: "inactive" });
    const { wabaPricingService } = await import("./waba-pricing.service");
    const quote = wabaPricingService.quote({
      apiKind: "oficial",
      shipmentCount: 1000,
      ownerEmail: "revenda@test.com",
    });
    assert.equal(quote?.spreadAmountCents, 0);
    assert.equal(quote?.totalAmountCents, 32000);
  });
});
