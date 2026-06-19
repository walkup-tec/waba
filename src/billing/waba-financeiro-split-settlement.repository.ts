import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../data-path";
import type { WabaDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";

export type SplitSettlementLineKind = "supplier" | "partner" | "cet";

export type SplitSettlementPayoutStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "skipped";

export type FinanceiroSplitPayoutStatus =
  | "pending"
  | "processing"
  | "partial"
  | "paid"
  | "failed";

export type SplitSettlementLine = {
  lineKind: SplitSettlementLineKind;
  participantId: string;
  participantLabel: string;
  participantEmail: string;
  pixKey: string;
  sharePercent: number;
  amountCents: number;
  shipmentCount?: number;
  costPerShipmentCents?: number;
  payoutStatus: SplitSettlementPayoutStatus;
  asaasTransferId?: string;
  payoutExternalReference?: string;
  transactionReceiptUrl?: string;
  paidAt?: string;
  failureReason?: string;
};

export type FinanceiroSplitSettlement = {
  id: string;
  orderId: string;
  apiKind: WabaDispatchesApiKind;
  ownerEmail: string;
  customerName: string;
  paidValueCents: number;
  purchasedShipmentCount: number;
  costPerShipmentCents: number;
  /** Custo do fornecedor (envios × custo/envio) — repasse PIX. */
  supplierCostCents?: number;
  /** Custo total = fornecedor + CET (CET retido pelo Asaas). */
  totalCostCents: number;
  grossProfitCents?: number;
  /** @deprecated leitura legada — use cetCents */
  cofCents?: number;
  cetCents?: number;
  distributableCents: number;
  supplierId?: string;
  supplierName?: string;
  lines: SplitSettlementLine[];
  payoutStatus: FinanceiroSplitPayoutStatus;
  payoutCompletedAt?: string;
  createdAt: string;
};

type Store = {
  version: 1;
  settlements: FinanceiroSplitSettlement[];
};

const FILE_NAME = "waba-financeiro-split-settlements.json";

const normalizePayoutStatus = (value: unknown): SplitSettlementPayoutStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "processing" ||
    normalized === "paid" ||
    normalized === "failed" ||
    normalized === "skipped"
  ) {
    return normalized;
  }
  return "pending";
};

const normalizeSettlementPayoutStatus = (value: unknown): FinanceiroSplitPayoutStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "processing" ||
    normalized === "partial" ||
    normalized === "paid" ||
    normalized === "failed"
  ) {
    return normalized;
  }
  return "pending";
};

export const deriveSettlementPayoutStatus = (
  lines: SplitSettlementLine[],
): FinanceiroSplitPayoutStatus => {
  const payable = lines.filter(
    (line) => line.amountCents > 0 && line.lineKind !== "cet" && line.payoutStatus !== "skipped",
  );
  if (!payable.length) return "paid";
  if (payable.every((line) => line.payoutStatus === "paid" || line.payoutStatus === "skipped")) {
    return "paid";
  }
  if (payable.some((line) => line.payoutStatus === "failed")) {
    return payable.some((line) => line.payoutStatus === "paid") ? "partial" : "failed";
  }
  if (payable.some((line) => line.payoutStatus === "processing")) return "processing";
  if (payable.some((line) => line.payoutStatus === "paid")) return "partial";
  return "pending";
};

const normalizeLineKind = (value: unknown): SplitSettlementLineKind => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "supplier") return "supplier";
  if (normalized === "cet") return "cet";
  return "partner";
};

const normalizeLine = (line: Partial<SplitSettlementLine>): SplitSettlementLine => ({
  lineKind: normalizeLineKind(line.lineKind),
  participantId: String(line.participantId ?? ""),
  participantLabel: String(line.participantLabel ?? ""),
  participantEmail: String(line.participantEmail ?? ""),
  pixKey: String(line.pixKey ?? ""),
  sharePercent: Number(line.sharePercent ?? 0),
  amountCents: Math.max(0, Math.round(Number(line.amountCents ?? 0))),
  shipmentCount:
    line.shipmentCount != null ? Math.max(0, Math.round(Number(line.shipmentCount))) : undefined,
  costPerShipmentCents:
    line.costPerShipmentCents != null
      ? Math.max(0, Math.round(Number(line.costPerShipmentCents)))
      : undefined,
  payoutStatus: normalizePayoutStatus(line.payoutStatus),
  asaasTransferId: line.asaasTransferId ? String(line.asaasTransferId) : undefined,
  payoutExternalReference: line.payoutExternalReference
    ? String(line.payoutExternalReference)
    : undefined,
  transactionReceiptUrl: line.transactionReceiptUrl
    ? String(line.transactionReceiptUrl)
    : undefined,
  paidAt: line.paidAt ? String(line.paidAt) : undefined,
  failureReason: line.failureReason ? String(line.failureReason) : undefined,
});

const normalizeSettlement = (item: FinanceiroSplitSettlement): FinanceiroSplitSettlement => {
  const lines = Array.isArray(item.lines) ? item.lines.map((line) => normalizeLine(line)) : [];
  const payoutStatus =
    item.payoutStatus != null
      ? normalizeSettlementPayoutStatus(item.payoutStatus)
      : deriveSettlementPayoutStatus(lines);
  return {
    ...item,
    lines,
    payoutStatus,
    payoutCompletedAt: item.payoutCompletedAt ? String(item.payoutCompletedAt) : undefined,
  };
};

export class WabaFinanceiroSplitSettlementRepository {
  private readStore(): Store {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return { version: 1, settlements: [] };
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Store;
      if (parsed?.version !== 1 || !Array.isArray(parsed.settlements)) {
        return { version: 1, settlements: [] };
      }
      return {
        version: 1,
        settlements: parsed.settlements.map((item) =>
          normalizeSettlement({
            ...item,
            lines: Array.isArray(item.lines)
              ? item.lines.map((line) =>
                  normalizeLine({
                    ...line,
                    lineKind: normalizeLineKind(line.lineKind),
                  }),
                )
              : [],
          }),
        ),
      };
    } catch {
      return { version: 1, settlements: [] };
    }
  }

  private writeStore(store: Store) {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    writeFileSync(filePath, readFileSync(tmp));
  }

  list(limit = 200): FinanceiroSplitSettlement[] {
    const cap = Math.max(1, Math.min(500, Math.floor(limit)));
    return this.readStore()
      .settlements.slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, cap);
  }

  getById(settlementId: string): FinanceiroSplitSettlement | null {
    const normalized = String(settlementId ?? "").trim();
    if (!normalized) return null;
    return this.readStore().settlements.find((item) => item.id === normalized) ?? null;
  }

  getByOrderId(orderId: string): FinanceiroSplitSettlement | null {
    const normalized = String(orderId ?? "").trim();
    if (!normalized) return null;
    return this.readStore().settlements.find((item) => item.orderId === normalized) ?? null;
  }

  create(settlement: Omit<FinanceiroSplitSettlement, "id" | "createdAt">): FinanceiroSplitSettlement {
    const store = this.readStore();
    const lines = settlement.lines.map((line) =>
      normalizeLine({
        ...line,
        payoutStatus: line.payoutStatus ?? "pending",
      }),
    );
    const record: FinanceiroSplitSettlement = normalizeSettlement({
      ...settlement,
      lines,
      payoutStatus: settlement.payoutStatus ?? deriveSettlementPayoutStatus(lines),
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    store.settlements.push(record);
    this.writeStore(store);
    return record;
  }

  save(settlement: FinanceiroSplitSettlement): FinanceiroSplitSettlement {
    const store = this.readStore();
    const index = store.settlements.findIndex((item) => item.id === settlement.id);
    if (index < 0) {
      throw new Error("Settlement não encontrado.");
    }
    const record = normalizeSettlement(settlement);
    store.settlements[index] = record;
    this.writeStore(store);
    return record;
  }
}
