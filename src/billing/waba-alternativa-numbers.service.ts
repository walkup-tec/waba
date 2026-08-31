import { randomUUID } from "node:crypto";

import { wabaFazendaPoolService } from "../instances/waba-fazenda-pool.service";

import { AlternativaNumberActivationRepository } from "./alternativa-number-activation.repository";

import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import { getAlternativaDispatchRulesMeta, ALTERNATIVA_MIN_PURCHASE_QUANTITY } from "../disparos/alternativa-dispatch-rules";



export const ALTERNATIVA_NUMBER_UNIT_CENTS = 2000;

export const ALTERNATIVA_NUMBER_MAX_QUANTITY = 20;



const normalizeEmail = (value: string): string => String(value ?? "").trim().toLowerCase();

let alternativaSummaryReplenishHook: ((email: string) => Promise<void>) | null = null;
let alternativaSummaryPostProcessHook:
  | ((summary: Record<string, unknown>, email: string) => Promise<Record<string, unknown>>)
  | null = null;

export function configureAlternativaNumbersSummaryReplenish(
  hook: ((email: string) => Promise<void>) | null
): void {
  alternativaSummaryReplenishHook = hook;
}

export function configureAlternativaSummaryPostProcess(
  hook:
    | ((summary: Record<string, unknown>, email: string) => Promise<Record<string, unknown>>)
    | null
): void {
  alternativaSummaryPostProcessHook = hook;
}



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

    const normalized = normalizeEmail(email);
    if (alternativaSummaryReplenishHook && normalized.includes("@")) {
      try {
        await alternativaSummaryReplenishHook(normalized);
      } catch {
        /* segue com snapshot atual */
      }
    }

    const purchasedSlots = this.getPurchasedSlots(email);

    const activations = this.activationRepository.listForEmail(email);

    const activatedCount = this.activationRepository.countForEmail(email);

    const availableSlots = Math.max(0, purchasedSlots - activatedCount);

    const fazendaPool = await wabaFazendaPoolService.buildPoolForSubscriber(email);

    const summary = {

      ...this.getPricing(),

      dispatchRules: getAlternativaDispatchRulesMeta(),

      canPickNumbers: purchasedSlots >= getAlternativaDispatchRulesMeta().minPurchasedForPicker,

      canSend: activatedCount >= getAlternativaDispatchRulesMeta().minActivatedForSend,

      purchasedSlots,

      activatedCount,

      availableSlots,

      activations: activations.map((row) => ({
        instanceName: row.instanceName,
        activatedAt: row.activatedAt,
        status: row.status === "blocked" ? "blocked" : "active",
        blockedAt: row.blockedAt ?? null,
        replacedByInstanceName: row.replacedByInstanceName ?? null,
        replacesInstanceName: row.replacesInstanceName ?? null,
        replacementScope: row.replacementScope ?? null,
      })),

      fazendaPool: {

        items: fazendaPool.items,

        availableToClaim: fazendaPool.availableToClaim,

        assignedToSubscriber: fazendaPool.assignedToSubscriber,

      },

    };

    if (alternativaSummaryPostProcessHook) {
      return (await alternativaSummaryPostProcessHook(summary, normalized)) as typeof summary;
    }

    return summary;
  }



  validateCheckout(quantity: number, valueCents: number) {

    const qty = Math.round(Number(quantity));

    if (!Number.isFinite(qty) || qty < ALTERNATIVA_MIN_PURCHASE_QUANTITY || qty > ALTERNATIVA_NUMBER_MAX_QUANTITY) {

      throw new Error(`Compra mínima de ${ALTERNATIVA_MIN_PURCHASE_QUANTITY} números. Selecione entre ${ALTERNATIVA_MIN_PURCHASE_QUANTITY} e ${ALTERNATIVA_NUMBER_MAX_QUANTITY}.`);

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

    if (!Number.isFinite(qty) || qty < ALTERNATIVA_MIN_PURCHASE_QUANTITY) {

      throw new Error(`Compra mínima de ${ALTERNATIVA_MIN_PURCHASE_QUANTITY} números.`);

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

