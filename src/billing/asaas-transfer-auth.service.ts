import { WABA_ASAAS_ORDER_PREFIX } from "./asaas-identifiers";
import { WabaFinanceiroSplitSettlementRepository } from "./waba-financeiro-split-settlement.repository";

type TransferAuthPayload = {
  type?: string;
  transfer?: {
    id?: string;
    value?: number;
    status?: string;
    operationType?: string;
    externalReference?: string;
    description?: string;
  };
};

const normalizeReference = (value: unknown): string => String(value ?? "").trim();

export class AsaasTransferAuthService {
  constructor(
    private readonly settlementRepository = new WabaFinanceiroSplitSettlementRepository(),
  ) {}

  resolveTransferAuthorization(
    payload: TransferAuthPayload,
  ): { status: "APPROVED" } | { status: "REFUSED"; refuseReason: string } {
    if (String(payload?.type ?? "").toUpperCase() !== "TRANSFER") {
      return { status: "REFUSED", refuseReason: "Tipo de operação não suportado." };
    }

    const transfer = payload.transfer ?? {};
    const transferId = normalizeReference(transfer.id);
    const externalReference = normalizeReference(transfer.externalReference);

    if (!externalReference.startsWith(`${WABA_ASAAS_ORDER_PREFIX}split:`)) {
      return { status: "REFUSED", refuseReason: "Transferência sem referência WABA split." };
    }

    const settlements = this.settlementRepository.list(500);
    for (const settlement of settlements) {
      for (const line of settlement.lines) {
        const lineRef =
          normalizeReference(line.payoutExternalReference) ||
          `${WABA_ASAAS_ORDER_PREFIX}split:${settlement.orderId}:${line.lineKind}:${line.participantId}`;

        if (lineRef !== externalReference) continue;

        if (line.payoutStatus === "paid") {
          return { status: "REFUSED", refuseReason: "Linha de split já repassada." };
        }

        const expectedValue = Number((line.amountCents / 100).toFixed(2));
        const receivedValue = Number(transfer.value ?? 0);
        if (Math.abs(expectedValue - receivedValue) > 0.01) {
          return {
            status: "REFUSED",
            refuseReason: `Valor divergente (esperado R$ ${expectedValue.toFixed(2)}).`,
          };
        }

        if (transferId && !line.asaasTransferId) {
          line.asaasTransferId = transferId;
          this.settlementRepository.save({
            ...settlement,
            lines: settlement.lines.map((item) =>
              item.participantId === line.participantId && item.lineKind === line.lineKind
                ? { ...item, asaasTransferId: transferId, payoutStatus: "processing" }
                : item,
            ),
          });
        }

        return { status: "APPROVED" };
      }
    }

    return { status: "REFUSED", refuseReason: "Split não encontrado para esta transferência." };
  }
}
