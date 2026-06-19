import { isWabaMasterEmail } from "../auth/waba-auth.service";
import { WabaBillingOrderRepository } from "../billing/waba-billing-order.repository";

export type WabaAuthRole = "master" | "operacional" | "suporte" | "subscriber" | "guest";

const AQUECEDOR_ACCESS_MS = 30 * 24 * 60 * 60 * 1000;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export type AquecedorEntitlement = {
  active: boolean;
  bypass: boolean;
  reason: "active" | "master" | "no_payment" | "expired" | "guest";
  email: string;
  lastPaidAt: string;
  expiresAt: string;
  daysRemaining: number;
  sourceOrderId: string;
  message: string;
};

export class WabaEntitlementService {
  constructor(private readonly orderRepository = new WabaBillingOrderRepository()) {}

  getAquecedorEntitlement(email: string, role: WabaAuthRole): AquecedorEntitlement {
    const normalizedEmail = normalizeEmail(email);
    const inactive = (reason: AquecedorEntitlement["reason"], message: string): AquecedorEntitlement => ({
      active: false,
      bypass: false,
      reason,
      email: normalizedEmail,
      lastPaidAt: "",
      expiresAt: "",
      daysRemaining: 0,
      sourceOrderId: "",
      message,
    });

    if (
      role === "master" ||
      role === "operacional" ||
      role === "suporte" ||
      isWabaMasterEmail(normalizedEmail)
    ) {
      return {
        active: true,
        bypass: true,
        reason: "master",
        email: normalizedEmail,
        lastPaidAt: "",
        expiresAt: "",
        daysRemaining: 999,
        sourceOrderId: "",
        message: "Acesso da equipe sem restrição.",
      };
    }

    if (!normalizedEmail) {
      return inactive(
        "guest",
        "Faça login com sua conta de assinante para verificar o acesso ao Aquecedor.",
      );
    }

    const paidOrders = this.orderRepository
      .list()
      .filter(
        (order) =>
          order.product === "waba-disparos" &&
          order.status === "paid" &&
          normalizeEmail(order.ownerEmail) === normalizedEmail &&
          String(order.paidAt ?? "").trim().length > 0,
      )
      .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());

    const latest = paidOrders[0];
    if (!latest?.paidAt) {
      return inactive(
        "no_payment",
        "Contrate um pacote de disparos e aguarde a confirmação do PIX para liberar o Aquecedor gratuitamente.",
      );
    }

    const paidAtMs = new Date(latest.paidAt).getTime();
    const expiresAtMs = paidAtMs + AQUECEDOR_ACCESS_MS;
    const now = Date.now();

    if (!Number.isFinite(paidAtMs) || now > expiresAtMs) {
      return {
        active: false,
        bypass: false,
        reason: "expired",
        email: normalizedEmail,
        lastPaidAt: latest.paidAt,
        expiresAt: new Date(expiresAtMs).toISOString(),
        daysRemaining: 0,
        sourceOrderId: latest.id,
        message:
          "Seu acesso ao Aquecedor expirou. Renove contratando um novo pacote de disparos (válido por 30 dias após o pagamento).",
      };
    }

    const daysRemaining = Math.max(0, Math.ceil((expiresAtMs - now) / (24 * 60 * 60 * 1000)));

    return {
      active: true,
      bypass: false,
      reason: "active",
      email: normalizedEmail,
      lastPaidAt: latest.paidAt,
      expiresAt: new Date(expiresAtMs).toISOString(),
      daysRemaining,
      sourceOrderId: latest.id,
      message: `Aquecedor liberado até ${new Date(expiresAtMs).toLocaleDateString("pt-BR")} (${daysRemaining} dia(s) restantes).`,
    };
  }

  isAquecedorAllowed(email: string, role: WabaAuthRole): boolean {
    return this.getAquecedorEntitlement(email, role).active;
  }
}
