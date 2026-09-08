import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { WabaBillingOrder } from "../billing/waba-billing-order.repository";

const originalCwd = process.cwd();
const dataRoot = mkdtempSync(path.join(os.tmpdir(), "waba-indicador-"));
const now = new Date().toISOString();

function writeJson(fileName: string, payload: unknown) {
  writeFileSync(path.join(process.cwd(), "data", fileName), JSON.stringify(payload, null, 2));
}

function paidOrder(overrides: Partial<WabaBillingOrder> = {}): WabaBillingOrder {
  return {
    id: "order-1",
    product: "waba-disparos",
    apiKind: "oficial",
    customerName: "Cliente Indicador",
    ownerEmail: "revenda@test.com",
    whatsapp: "11988888888",
    cpfCnpj: "00000000191",
    billingType: "PIX",
    valueCents: 35000,
    listValueCents: 35000,
    shipmentCount: 1000,
    status: "paid",
    asaasExternalReference: "waba:order-1",
    asaasPaymentId: "pay_1",
    createdAt: now,
    updatedAt: now,
    paidAt: now,
    indicatorUserId: "ind-1",
    purchasedShipmentCount: 1000,
    baseUnitPriceCents: 32,
    spreadUnitPriceCents: 3,
    customerUnitPriceCents: 35,
    baseAmountCents: 32000,
    spreadAmountCents: 3000,
    ...overrides,
  };
}

function seedBase() {
  writeJson("waba-system-users.json", {
    version: 1,
    users: [
      {
        id: "ind-1",
        fullName: "João Silva",
        email: "joao.indicador@test.com",
        passwordHash: "x",
        role: "indicador",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "ind-2",
        fullName: "Maria Souza",
        email: "maria.indicador@test.com",
        passwordHash: "x",
        role: "indicador",
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
        spreadCentsPerSend: 3,
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "prof-2",
        userId: "ind-2",
        cpfCnpj: "12345678901",
        pixKey: "maria@pix.com",
        pixKeyType: "EMAIL",
        spreadCentsPerSend: 5,
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  writeJson("waba-subscribers.json", {
    version: 1,
    subscribers: [
      {
        id: "sub-ind",
        email: "revenda@test.com",
        passwordHash: "x",
        fullName: "Cliente ABC",
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
        email: "alheio@test.com",
        passwordHash: "x",
        fullName: "Cliente Alheio",
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
  writeJson("waba-billing-orders.json", []);
  writeJson("waba-indicator-commissions.json", { version: 1, commissions: [] });
  writeJson("waba-indicator-audit.json", { version: 1, events: [] });
  writeJson("waba-campaign-intakes.json", { version: 1, intakes: [] });
  writeJson("waba-disparos-bonus-balances.json", { version: 2, entries: [] });
  writeJson("waba-disparos-credit-usage.json", { version: 2, entries: [] });
  writeJson("waba-financeiro-split.json", { version: 1, config: { suppliers: [], participants: [] } });
}

describe("Módulo Indicador — comissão, bônus, IDOR e snapshot", () => {
  before(() => {
    mkdirSync(path.join(dataRoot, "data"), { recursive: true });
    process.chdir(dataRoot);
    seedBase();
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it("checkout ignora valor enviado pelo frontend e usa o PricingService", async () => {
    seedBase();
    const { WabaBillingService } = await import("../billing/waba-billing.service");
    const service = new WabaBillingService();
    const validated = (
      service as unknown as {
        validateCheckoutInput: (input: Record<string, unknown>) => {
          valueCents: number;
          listValueCents: number;
          spreadAmountCents?: number;
        };
      }
    ).validateCheckoutInput({
      apiKind: "oficial",
      customerName: "Cliente ABC",
      ownerEmail: "revenda@test.com",
      cpfCnpj: "00000000191",
      whatsapp: "11988888888",
      shipmentCount: 1000,
      valueCents: 1,
    });
    assert.equal(validated.listValueCents, 35000);
    assert.equal(validated.valueCents, 35000);
    assert.equal(validated.spreadAmountCents, 3000);
  });

  it("pagamento confirmado gera comissão uma única vez mesmo com webhook duplicado", async () => {
    seedBase();
    const { WabaBillingOrderRepository } = await import("../billing/waba-billing-order.repository");
    const { WabaBillingService } = await import("../billing/waba-billing.service");
    const { WabaIndicatorCommissionRepository } = await import("./waba-indicator-commission.repository");
    const orders = new WabaBillingOrderRepository();
    orders.create(paidOrder({ status: "pending_payment", paidAt: undefined }));
    const billing = new WabaBillingService();
    const payload = {
      id: "pay_1",
      externalReference: "waba:order-1",
      status: "RECEIVED",
    };
    await billing.handleAsaasWebhook("PAYMENT_RECEIVED", payload);
    await billing.handleAsaasWebhook("PAYMENT_RECEIVED", payload);
    await billing.handleAsaasWebhook("PAYMENT_CONFIRMED", payload);
    const commissions = new WabaIndicatorCommissionRepository().list();
    assert.equal(commissions.length, 1);
    assert.equal(commissions[0]?.commissionAmountCents, 3000);
    assert.notEqual(commissions[0]?.status, "paid");
    assert.equal(commissions[0]?.spreadUnitPriceCents, 3);
  });

  it("bônus administrativo não gera comissão", async () => {
    seedBase();
    const { WabaBillingOrderRepository } = await import("../billing/waba-billing-order.repository");
    const { WabaIndicatorCommissionService } = await import("./waba-indicator-commission.service");
    const orders = new WabaBillingOrderRepository();
    const bonus = paidOrder({
      id: "order-bonus",
      grantSource: "admin-bonus-envios",
      valueCents: 0,
      spreadAmountCents: 3000,
    });
    orders.create(bonus);
    const created = new WabaIndicatorCommissionService().ensureForPaidOrder(bonus);
    assert.equal(created, null);
    assert.equal(new (await import("./waba-indicator-commission.repository")).WabaIndicatorCommissionRepository().list().length, 0);
  });

  it("alteração futura do spread não reescreve comissão histórica", async () => {
    seedBase();
    const { WabaIndicatorCommissionService } = await import("./waba-indicator-commission.service");
    const { WabaIndicatorProfileRepository } = await import("./waba-indicator-profile.repository");
    const commissionService = new WabaIndicatorCommissionService();
    commissionService.ensureForPaidOrder(paidOrder());
    new WabaIndicatorProfileRepository().updateByUserId("ind-1", {
      spreadCentsPerSend: 5,
      updatedAt: new Date().toISOString(),
    });
    commissionService.ensureForPaidOrder(paidOrder());
    const stored = new (await import("./waba-indicator-commission.repository")).WabaIndicatorCommissionRepository().getByOrderId("order-1");
    assert.equal(stored?.spreadUnitPriceCents, 3);
    assert.equal(stored?.commissionAmountCents, 3000);
  });

  it("estorno/chargeback cancela a comissão sem apagar o histórico", async () => {
    seedBase();
    const { WabaBillingOrderRepository } = await import("../billing/waba-billing-order.repository");
    const { WabaBillingService } = await import("../billing/waba-billing.service");
    const { WabaIndicatorCommissionRepository } = await import("./waba-indicator-commission.repository");
    new WabaBillingOrderRepository().create(paidOrder());
    const billing = new WabaBillingService();
    await billing.handleAsaasWebhook("PAYMENT_RECEIVED", {
      id: "pay_1",
      externalReference: "waba:order-1",
      status: "RECEIVED",
    });
    await billing.handleAsaasWebhook("PAYMENT_REFUNDED", {
      id: "pay_1",
      externalReference: "waba:order-1",
      status: "REFUNDED",
    });
    const stored = new WabaIndicatorCommissionRepository().getByOrderId("order-1");
    assert.equal(stored?.status, "canceled");
    assert.ok(stored?.canceledAt);
  });

  it("indicador não acessa assinante, comissão ou comprovante de outro indicador", async () => {
    seedBase();
    const { WabaIndicatorService } = await import("./waba-indicator.service");
    const { WabaIndicatorCommissionRepository } = await import("./waba-indicator-commission.repository");
    const service = new WabaIndicatorService();
    assert.throws(() => service.assertOwnsSubscriber("ind-1", "sub-other"), /Assinante não encontrado/);
    new WabaIndicatorCommissionRepository().createIfAbsent({
      id: "com-2",
      indicatorUserId: "ind-2",
      subscriberId: "sub-other",
      subscriberEmail: "alheio@test.com",
      orderId: "order-other",
      asaasPaymentId: "pay_other",
      campaignId: "",
      quantity: 1000,
      baseUnitPriceCents: 32,
      spreadUnitPriceCents: 9,
      customerUnitPriceCents: 41,
      baseAmountCents: 32000,
      commissionAmountCents: 9000,
      totalAmountCents: 41000,
      status: "paid",
      payoutExternalReference: "split:order-other:indicator:ind-2",
      asaasTransferId: "tr_1",
      transactionReceiptUrl: "https://example.com/recibo.pdf",
      failureReason: "",
      createdAt: now,
      updatedAt: now,
      paidAt: now,
      canceledAt: "",
    });
    assert.throws(() => service.getCommissionForIndicator("ind-1", "com-2"), /Comissão não encontrada/);
    assert.throws(() => service.getReceiptForIndicator("ind-1", "com-2"), /Comprovante não encontrado/);
    const ownFinance = service.financeSummary("ind-1", {});
    assert.equal(ownFinance.items.length, 0);
  });

  it("limite acumulado de bônus do indicador é 100 envios por assinante", async () => {
    seedBase();
    const { WabaAdminBonusEnviosService } = await import("../admin/waba-admin-bonus-envios.service");
    const { WabaIndicatorService } = await import("./waba-indicator.service");
    const bonus = new WabaAdminBonusEnviosService();
    const indicator = new WabaIndicatorService();
    bonus.grant({
      subscriberId: "sub-ind",
      shipmentCount: 40,
      apiKind: "oficial",
      validityMode: "lifetime",
      createdByEmail: "joao.indicador@test.com",
      applyIndicatorBonusCap: true,
    });
    bonus.grant({
      subscriberId: "sub-ind",
      shipmentCount: 40,
      apiKind: "oficial",
      validityMode: "lifetime",
      createdByEmail: "joao.indicador@test.com",
      applyIndicatorBonusCap: true,
    });
    assert.equal(indicator.remainingBonusQuota("sub-ind"), 20);
    assert.throws(
      () => indicator.assertIndicatorBonusGrant("ind-1", "sub-ind", 30),
      /Restam apenas 20/,
    );
    bonus.grant({
      subscriberId: "sub-ind",
      shipmentCount: 20,
      apiKind: "oficial",
      validityMode: "lifetime",
      createdByEmail: "joao.indicador@test.com",
      applyIndicatorBonusCap: true,
    });
    assert.equal(indicator.remainingBonusQuota("sub-ind"), 0);
    assert.throws(
      () =>
        bonus.grant({
          subscriberId: "sub-ind",
          shipmentCount: 1,
          apiKind: "oficial",
          validityMode: "lifetime",
          createdByEmail: "joao.indicador@test.com",
          applyIndicatorBonusCap: true,
        }),
      /Limite de 100/,
    );
  });

  it("indicador visualiza campanha própria e não consegue alterar", async () => {
    seedBase();
    writeJson("waba-campaign-intakes.json", {
      version: 1,
      intakes: [
        {
          id: "camp-own",
          ownerEmail: "revenda@test.com",
          campaignName: "Campanha Setembro",
          status: "generated",
          importedLineCount: 1000,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "camp-other",
          ownerEmail: "alheio@test.com",
          campaignName: "Campanha Alheia",
          status: "generated",
          importedLineCount: 500,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    const { WabaOperacionalCampanhasService } = await import("../admin/waba-operacional-campanhas.service");
    const campanhas = new WabaOperacionalCampanhasService();
    const own = campanhas.listCampaigns({ email: "joao.indicador@test.com", role: "indicador" });
    assert.equal(own.some((item) => item.id === "camp-own"), true);
    assert.equal(own.some((item) => item.id === "camp-other"), false);
    const detail = campanhas.getCampaignDetail("camp-own", {
      email: "joao.indicador@test.com",
      role: "indicador",
    });
    assert.equal(detail?.readOnly, true);
    assert.equal(detail?.canStartCampaign, false);
    assert.equal(campanhas.getCampaignDetail("camp-other", {
      email: "joao.indicador@test.com",
      role: "indicador",
    }), null);
    assert.throws(
      () =>
        campanhas.markCampaignStarted("camp-own", {
          email: "joao.indicador@test.com",
          role: "indicador",
        }),
      /apenas consultar/,
    );
  });

  it("financeiro do indicador lista somente os próprios lançamentos", async () => {
    seedBase();
    const { WabaIndicatorCommissionService } = await import("./waba-indicator-commission.service");
    const { WabaIndicatorService } = await import("./waba-indicator.service");
    new WabaIndicatorCommissionService().ensureForPaidOrder(paidOrder());
    new WabaIndicatorCommissionService().ensureForPaidOrder(
      paidOrder({
        id: "order-other",
        ownerEmail: "alheio@test.com",
        indicatorUserId: "ind-2",
        spreadUnitPriceCents: 9,
        spreadAmountCents: 9000,
      }),
    );
    const finance = new WabaIndicatorService().financeSummary("ind-1", {});
    assert.equal(finance.items.length, 1);
    assert.equal(finance.items[0]?.orderId, "order-1");
    assert.equal(finance.generatedCents, 3000);
  });
});
