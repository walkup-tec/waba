import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolveDataFile } from "../data-path";

export type WabaBillingOrderStatus = "pending_payment" | "paid" | "cancelled" | "failed";

export type WabaBillingOrder = {
  id: string;
  product: "waba-disparos";
  apiKind: "oficial" | "alternativa";
  customerName: string;
  ownerEmail: string;
  whatsapp: string;
  cpfCnpj: string;
  billingType: "PIX";
  valueCents: number;
  shipmentCount?: number;
  status: WabaBillingOrderStatus;
  asaasCustomerId?: string;
  asaasPaymentId?: string;
  paymentUrl?: string;
  pixCopyPaste?: string;
  pixQrCodeBase64?: string;
  asaasExternalReference: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  /** Envios bonificados aplicados na confirmação do pagamento. */
  bonusShipmentsApplied?: number;
  /** Marca que o saldo bonificado pendente já foi avaliado neste pedido. */
  bonusSettlementAt?: string;
};

const ORDERS_FILE = resolveDataFile("waba-billing-orders.json");

const ensureStorage = () => {
  const folder = dirname(ORDERS_FILE);
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
  if (!existsSync(ORDERS_FILE)) {
    writeFileSync(ORDERS_FILE, "[]", "utf-8");
  }
};

const loadOrders = (): WabaBillingOrder[] => {
  ensureStorage();
  try {
    const raw = readFileSync(ORDERS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as WabaBillingOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveOrders = (orders: WabaBillingOrder[]) => {
  ensureStorage();
  writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
};

export class WabaBillingOrderRepository {
  list(): WabaBillingOrder[] {
    return loadOrders();
  }

  getById(orderId: string): WabaBillingOrder | null {
    const normalized = String(orderId ?? "").trim();
    if (!normalized) return null;
    return loadOrders().find((order) => order.id === normalized) ?? null;
  }

  getByAsaasPaymentId(paymentId: string): WabaBillingOrder | null {
    const normalized = String(paymentId ?? "").trim();
    if (!normalized) return null;
    return loadOrders().find((order) => order.asaasPaymentId === normalized) ?? null;
  }

  getByAsaasExternalReference(externalReference: string): WabaBillingOrder | null {
    const normalized = String(externalReference ?? "").trim();
    if (!normalized) return null;
    return loadOrders().find((order) => order.asaasExternalReference === normalized) ?? null;
  }

  create(order: WabaBillingOrder): WabaBillingOrder {
    const orders = loadOrders();
    orders.push(order);
    saveOrders(orders);
    return order;
  }

  update(orderId: string, patch: Partial<WabaBillingOrder>): WabaBillingOrder | null {
    const orders = loadOrders();
    const index = orders.findIndex((order) => order.id === orderId);
    if (index === -1) return null;
    const next = {
      ...orders[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    orders[index] = next;
    saveOrders(orders);
    return next;
  }
}
