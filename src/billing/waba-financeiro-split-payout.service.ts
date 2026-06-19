import { buildWabaAsaasExternalReference } from "./asaas-identifiers";
import {
  createAsaasPixTransfer,
  getAsaasTransfer,
  isAsaasConfigured,
  isAsaasTransferConfigured,
} from "./asaas.client";
import { normalizePixKeyForAsaas, resolveAsaasPixKeyType } from "./asaas-pix-key";
import {
  deriveSettlementPayoutStatus,
  type FinanceiroSplitSettlement,
  type SplitSettlementLine,
  WabaFinanceiroSplitSettlementRepository,
} from "./waba-financeiro-split-settlement.repository";

const isPaidTransferStatus = (status: string | undefined): boolean => {
  const normalized = String(status ?? "").trim().toUpperCase();
  return normalized === "DONE" || normalized === "CONFIRMED";
};

const isProcessingTransferStatus = (status: string | undefined): boolean => {
  const normalized = String(status ?? "").trim().toUpperCase();
  return (
    normalized === "PENDING" ||
    normalized === "BANK_PROCESSING" ||
    normalized === "PROCESSING" ||
    normalized === "AWAITING_EXECUTION"
  );
};

const isFailedTransferStatus = (status: string | undefined): boolean => {
  const normalized = String(status ?? "").trim().toUpperCase();
  return normalized === "FAILED" || normalized === "CANCELLED" || normalized === "REFUSED";
};

const enhanceTransferFailureReason = (message: string): string => {
  const text = String(message || "").trim();
  if (text.includes("não possui permissão para realizar operações de saque")) {
    return `${text} Gere no Asaas uma chave com permissão de saque/transferência e defina ASAAS_TRANSFER_API_KEY no servidor.`;
  }
  if (text.toLowerCase().includes("autorização crítica") || text.toLowerCase().includes("codigo de confirmação")) {
    return `${text} Configure whitelist de IP ou webhook de autorização de transferências no Asaas.`;
  }
  return text;
};

const centsToCurrency = (valueCents: number): number => Number((valueCents / 100).toFixed(2));

const extractAsaasTransferIdFromFailureReason = (reason: string): string | null => {
  const text = String(reason ?? "").trim();
  const match =
    text.match(/Saque\s+([a-f0-9-]{36})\s+j[aá]\s+solicitado/i) ||
    text.match(/\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i);
  return match?.[1] ?? null;
};

export class WabaFinanceiroSplitPayoutService {
  constructor(
    private readonly settlementRepository = new WabaFinanceiroSplitSettlementRepository(),
  ) {}

  isPayoutEnabled(): boolean {
    const flag = String(process.env.WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED ?? "").trim().toLowerCase();
    if (flag === "0" || flag === "false" || flag === "no") return false;
    if (!isAsaasTransferConfigured()) return false;
    if (flag === "1" || flag === "true" || flag === "yes") return true;
    return isAsaasConfigured();
  }

  isTransferApiConfigured(): boolean {
    return isAsaasTransferConfigured();
  }

  private buildLineExternalReference(settlement: FinanceiroSplitSettlement, line: SplitSettlementLine): string {
    return buildWabaAsaasExternalReference(
      `split:${settlement.orderId}:${line.lineKind}:${line.participantId}`,
    );
  }

  private applyTransferResult(
    line: SplitSettlementLine,
    transfer: { id?: string; status?: string; failReason?: string; transactionReceiptUrl?: string },
  ): SplitSettlementLine {
    const transferId = String(transfer.id ?? "").trim();
    const receiptUrl = String(transfer.transactionReceiptUrl ?? line.transactionReceiptUrl ?? "").trim();
    if (isPaidTransferStatus(transfer.status)) {
      return {
        ...line,
        payoutStatus: "paid",
        asaasTransferId: transferId || line.asaasTransferId,
        transactionReceiptUrl: receiptUrl || line.transactionReceiptUrl,
        paidAt: new Date().toISOString(),
        failureReason: undefined,
      };
    }
    if (isFailedTransferStatus(transfer.status)) {
      return {
        ...line,
        payoutStatus: "failed",
        asaasTransferId: transferId || line.asaasTransferId,
        failureReason: String(transfer.failReason ?? "Transferência recusada pelo Asaas."),
      };
    }
    if (isProcessingTransferStatus(transfer.status)) {
      return {
        ...line,
        payoutStatus: "processing",
        asaasTransferId: transferId || line.asaasTransferId,
        failureReason: undefined,
      };
    }
    return {
      ...line,
      payoutStatus: "processing",
      asaasTransferId: transferId || line.asaasTransferId,
    };
  }

  private async payoutLine(
    settlement: FinanceiroSplitSettlement,
    line: SplitSettlementLine,
  ): Promise<SplitSettlementLine> {
    if (line.lineKind === "cet") {
      return { ...line, payoutStatus: "skipped" };
    }
    if (line.amountCents <= 0) {
      return { ...line, payoutStatus: "skipped" };
    }
    if (line.payoutStatus === "paid") return line;
    if (!line.pixKey || line.pixKey.length < 5) {
      return {
        ...line,
        payoutStatus: "failed",
        failureReason: "Chave PIX ausente para repasse.",
      };
    }

    const externalReference =
      line.payoutExternalReference || this.buildLineExternalReference(settlement, line);
    const keyType = resolveAsaasPixKeyType(line.pixKey);
    const pixAddressKey = normalizePixKeyForAsaas(line.pixKey, keyType);
    const description =
      line.lineKind === "supplier"
        ? `WABA split fornecedor ${settlement.orderId}`
        : `WABA split lucro ${settlement.orderId}`;

    try {
      const transfer = await createAsaasPixTransfer({
        value: centsToCurrency(line.amountCents),
        pixAddressKey,
        pixAddressKeyType: keyType,
        description,
        externalReference,
      });
      return {
        ...this.applyTransferResult(line, transfer),
        payoutExternalReference: externalReference,
      };
    } catch (error) {
      return {
        ...line,
        payoutStatus: "failed",
        payoutExternalReference: externalReference,
        failureReason: enhanceTransferFailureReason(
          error instanceof Error ? error.message : "Falha ao solicitar repasse PIX.",
        ),
      };
    }
  }

  private finalizeSettlementRecord(settlement: FinanceiroSplitSettlement): FinanceiroSplitSettlement {
    const payoutStatus = deriveSettlementPayoutStatus(settlement.lines);
    const payoutCompletedAt =
      payoutStatus === "paid" ? settlement.payoutCompletedAt ?? new Date().toISOString() : undefined;
    return this.settlementRepository.save({
      ...settlement,
      payoutStatus,
      payoutCompletedAt,
    });
  }

  async executeForSettlementId(settlementId: string): Promise<FinanceiroSplitSettlement | null> {
    const current = this.settlementRepository.getById(settlementId);
    if (!current) return null;
    return this.executeForSettlement(current);
  }

  async executeForOrderId(orderId: string): Promise<FinanceiroSplitSettlement | null> {
    const current = this.settlementRepository.getByOrderId(orderId);
    if (!current) return null;
    return this.executeForSettlement(current);
  }

  async executeForSettlement(settlement: FinanceiroSplitSettlement): Promise<FinanceiroSplitSettlement> {
    if (!this.isPayoutEnabled()) {
      return settlement;
    }
    if (!this.isTransferApiConfigured()) {
      const reason =
        "Repasse PIX indisponível: configure ASAAS_TRANSFER_API_KEY com permissão de saque no Asaas.";
      const lines = settlement.lines.map((line) =>
        line.payoutStatus === "paid" || line.payoutStatus === "skipped"
          ? line
          : { ...line, payoutStatus: "failed" as const, failureReason: reason },
      );
      return this.finalizeSettlementRecord({ ...settlement, lines });
    }

    let working = { ...settlement };
    for (const [index, line] of working.lines.entries()) {
      if (line.lineKind === "cet") continue;
      if (line.payoutStatus === "paid" || line.payoutStatus === "skipped") continue;

      if (line.payoutStatus === "processing" && line.asaasTransferId) {
        try {
          const transfer = await getAsaasTransfer(line.asaasTransferId);
          working.lines[index] = this.applyTransferResult(line, transfer);
        } catch (error) {
          console.warn(
            `[SplitPayout] consulta transfer ${line.asaasTransferId} indisponível:`,
            error instanceof Error ? error.message : error,
          );
          working.lines[index] = { ...line, payoutStatus: "processing", failureReason: undefined };
        }
        continue;
      }

      if (line.payoutStatus === "processing" && !line.asaasTransferId) {
        working.lines[index] = await this.payoutLine(working, line);
        continue;
      }

      if (line.payoutStatus === "failed" || line.payoutStatus === "pending") {
        working.lines[index] = await this.payoutLine(working, line);
      }
    }

    return this.finalizeSettlementRecord(working);
  }

  /** Consulta Asaas e atualiza linhas em processamento — sem reenviar PIX nem retentar falhas. */
  async syncProcessingTransfersForSettlement(
    settlement: FinanceiroSplitSettlement,
  ): Promise<FinanceiroSplitSettlement> {
    if (!this.isTransferApiConfigured()) return settlement;

    const hasProcessing = settlement.lines.some(
      (line) => line.payoutStatus === "processing" && line.asaasTransferId,
    );
    if (!hasProcessing) return settlement;

    let working = { ...settlement, lines: settlement.lines.map((line) => ({ ...line })) };
    for (const [index, line] of working.lines.entries()) {
      if (line.payoutStatus !== "processing" || !line.asaasTransferId) continue;
      try {
        const transfer = await getAsaasTransfer(line.asaasTransferId);
        working.lines[index] = this.applyTransferResult(line, transfer);
      } catch (error) {
        console.warn(
          `[SplitPayout] sync transfer ${line.asaasTransferId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return this.finalizeSettlementRecord(working);
  }

  async syncProcessingTransfers(limit = 100): Promise<number> {
    const cap = Math.max(1, Math.min(500, Math.floor(limit)));
    const candidates = this.settlementRepository
      .list(cap)
      .filter((item) =>
        item.lines.some((line) => line.payoutStatus === "processing" && line.asaasTransferId),
      );

    let synced = 0;
    for (const settlement of candidates) {
      const before = JSON.stringify(settlement.lines);
      const updated = await this.syncProcessingTransfersForSettlement(settlement);
      if (JSON.stringify(updated.lines) !== before) synced += 1;
    }
    return synced;
  }

  async retryLineForOrder(
    orderId: string,
    participantId: string,
  ): Promise<FinanceiroSplitSettlement | null> {
    const current = this.settlementRepository.getByOrderId(orderId);
    if (!current) return null;

    const index = current.lines.findIndex(
      (line) => String(line.participantId) === String(participantId),
    );
    if (index < 0) return current;

    let line = current.lines[index];
    if (line.lineKind === "cet" || line.payoutStatus === "paid" || line.payoutStatus === "skipped") {
      return current;
    }
    if (!this.isPayoutEnabled() || !this.isTransferApiConfigured()) {
      return current;
    }

    const working = { ...current, lines: current.lines.map((item) => ({ ...item })) };

    const syncTransferById = async (transferId: string): Promise<SplitSettlementLine | null> => {
      try {
        const transfer = await getAsaasTransfer(transferId);
        return this.applyTransferResult(line, transfer);
      } catch (error) {
        console.warn(
          `[SplitPayout] retry sync transfer ${transferId}:`,
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    };

    if (line.asaasTransferId) {
      const synced = await syncTransferById(line.asaasTransferId);
      if (synced) {
        working.lines[index] = synced;
        if (synced.payoutStatus === "paid" || synced.payoutStatus === "processing") {
          return this.finalizeSettlementRecord(working);
        }
        line = synced;
      }
    } else {
      const recoveredId = extractAsaasTransferIdFromFailureReason(line.failureReason || "");
      if (recoveredId) {
        const synced = await syncTransferById(recoveredId);
        if (synced) {
          working.lines[index] = synced;
          if (synced.payoutStatus === "paid" || synced.payoutStatus === "processing") {
            return this.finalizeSettlementRecord(working);
          }
          line = synced;
        }
      }
    }

    const baseRef = line.payoutExternalReference || this.buildLineExternalReference(working, line);
    const retryLine: SplitSettlementLine = {
      ...line,
      payoutStatus: "pending",
      asaasTransferId: undefined,
      payoutExternalReference: `${baseRef}:retry:${Date.now()}`,
      failureReason: undefined,
    };
    working.lines[index] = await this.payoutLine(working, retryLine);
    return this.finalizeSettlementRecord(working);
  }

  async resolveLineReceiptUrl(
    orderId: string,
    participantId: string,
  ): Promise<{ url: string } | null> {
    const settlement = this.settlementRepository.getByOrderId(orderId);
    if (!settlement) return null;

    const index = settlement.lines.findIndex(
      (line) => String(line.participantId) === String(participantId),
    );
    if (index < 0) return null;

    const line = settlement.lines[index];
    if (line.lineKind === "cet" || line.payoutStatus !== "paid") return null;

    const cached = String(line.transactionReceiptUrl ?? "").trim();
    if (cached) return { url: cached };

    const transferId = String(line.asaasTransferId ?? "").trim();
    if (!transferId || !this.isTransferApiConfigured()) return null;

    const transfer = await getAsaasTransfer(transferId);
    const url = String(transfer.transactionReceiptUrl ?? "").trim();
    if (!url) return null;

    const lines = settlement.lines.map((item, itemIndex) =>
      itemIndex === index
        ? { ...item, transactionReceiptUrl: url, asaasTransferId: transferId || item.asaasTransferId }
        : item,
    );
    this.settlementRepository.save({ ...settlement, lines });
    return { url };
  }

  async executePendingSettlements(limit = 50): Promise<{
    processed: number;
    paid: number;
    failed: number;
  }> {
    const cap = Math.max(1, Math.min(200, Math.floor(limit)));
    const pending = this.settlementRepository
      .list(500)
      .filter((item) => item.payoutStatus !== "paid")
      .slice(0, cap);

    let paid = 0;
    let failed = 0;
    for (const settlement of pending) {
      const updated = await this.executeForSettlement(settlement);
      if (updated.payoutStatus === "paid") paid += 1;
      else if (updated.payoutStatus === "failed" || updated.payoutStatus === "partial") failed += 1;
    }

    return { processed: pending.length, paid, failed };
  }
}
