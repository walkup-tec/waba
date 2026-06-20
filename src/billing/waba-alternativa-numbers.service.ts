import { randomUUID } from "node:crypto";
import { wabaFazendaPoolService } from "../instances/waba-fazenda-pool.service";
import { AlternativaNumberActivationRepository } from "./alternativa-number-activation.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";

export const ALTERNATIVA_NUMBER_UNIT_CENTS = 2000;
export const ALTERNATIVA_NUMBER_MAX_QUANTITY = 20;

const normalizeEmail = (value: string): string => String(value ?? "").trim().toLowerCase();

export class WabaAlternativaNumbersService {
  constructor(
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly activationRepository = new AlternativaNumberActivationRepository(),
  ) {}

  getPricing() {
    return {
      unitCents: ALTERNATIVA_NUMBER_UNIT_CENTS,
      unitLabel: "R$ 20,00",
      maxQuantity: ALTERNATIVA_NUMBER_MAX_QUANTITY,
      product: "waba-alternativa-numbers" as const,
    };
  }

  getPurchasedSlots(email: string): number {
    const normalized = normalizeEmail(email);
    if (!normalized) return 0;
    return this.orderRepository
      .list()
      .filter(
        (order) =>
          order.product === "waba-alternativa-numbers" &&
          order.status === "paid" &&
          normalizeEmail(order.ownerEmail) === normalized,
      )
      .reduce((sum, order) => sum + Math.max(0, Math.round(Number(order.shipmentCount ?? 0))), 0);
  }

  async getSummaryAsync(email: string) {
    const purchasedSlots = this.getPurchasedSlots(email);
    const activations = this.activationRepository.listForEmail(email);
    const activatedCount = activations.length;
    const availableSlots = Math.max(0, purchasedSlots - activatedCount);
    const fazendaPool = await wabaFazendaPoolService.buildPoolForSubscriber(email);
    return {
      ...this.getPricing(),
      purchasedSlots,
      activatedCount,
      availableSlots,
      activations: activations.map((row) => ({
        instanceName: row.instanceName,
        activatedAt: row.activatedAt,
      })),
      fazendaPool: {
        items: fazendaPool.items,
        availableToClaim: fazendaPool.availableToClaim,
        assignedToSubscriber: fazendaPool.assignedToSubscriber,
      },
    };
  }

  validateCheckout(quantity: number, valueCents: number) {
    const qty = Math.round(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > ALTERNATIVA_NUMBER_MAX_QUANTITY) {
      throw new Error(`Selecione entre 1 e ${ALTERNATIVA_NUMBER_MAX_QUANTITY} números.`);
    }
    const expected = qty * ALTERNATIVA_NUMBER_UNIT_CENTS;
    const cents = Math.round(Number(valueCents));
    if (cents !== expected) {
      throw new Error("Valor total inválido para a quantidade selecionada.");
    }
    return { quantity: qty, valueCents: cents };
  }

  async registerActivation(email: string, instanceName: string) {
    const summary = await this.getSummaryAsync(email);
    if (summary.availableSlots <= 0) {
      throw new Error("Você não possui números disponíveis para ativar. Compre novos números primeiro.");
    }
    await wabaFazendaPoolService.assertCanAssignToSubscriber(email, instanceName);
    if (this.activationRepository.hasInstance(email, instanceName)) {
      return this.activationRepository.listForEmail(email).find(
        (row) => row.instanceName.toLowerCase() === instanceName.toLowerCase(),
      )!;
    }
    return this.activationRepository.register(email, instanceName, "slot");
  }

  /** Simula compra paga (somente dev/V02). Saldo fica atrelado ao ownerEmail. */
  async simulatePaidPurchase(email: string, quantity: number) {
    const normalized = normalizeEmail(email);
    if (!normalized.includes("@")) {
      throw new Error("Informe um e-mail válido.");
    }
    const qty = Math.round(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error("Informe uma quantidade válida de números.");
    }

    const now = new Date().toISOString();
    const orderId = randomUUID();
    const order = this.orderRepository.create({
      id: orderId,
      product: "waba-alternativa-numbers",
      apiKind: "alternativa",
      customerName: "Simulação V02",
      ownerEmail: normalized,
      whatsapp: "11987654321",
      cpfCnpj: "00000000000",
      billingType: "PIX",
      valueCents: qty * ALTERNATIVA_NUMBER_UNIT_CENTS,
      shipmentCount: qty,
      status: "paid",
      asaasExternalReference: `waba:simulate:${orderId}`,
      createdAt: now,
      updatedAt: now,
      paidAt: now,
    });

    return {
      ok: true,
      simulated: true,
      orderId: order.id,
      ownerEmail: normalized,
      quantity: qty,
      summary: await this.getSummaryAsync(normalized),
    };
  }
}
