"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsaasTransferAuthService = void 0;
const asaas_identifiers_1 = require("./asaas-identifiers");
const waba_financeiro_split_settlement_repository_1 = require("./waba-financeiro-split-settlement.repository");
const normalizeReference = (value) => String(value ?? "").trim();
class AsaasTransferAuthService {
    constructor(settlementRepository = new waba_financeiro_split_settlement_repository_1.WabaFinanceiroSplitSettlementRepository()) {
        this.settlementRepository = settlementRepository;
    }
    resolveTransferAuthorization(payload) {
        if (String(payload?.type ?? "").toUpperCase() !== "TRANSFER") {
            return { status: "REFUSED", refuseReason: "Tipo de operação não suportado." };
        }
        const transfer = payload.transfer ?? {};
        const transferId = normalizeReference(transfer.id);
        const externalReference = normalizeReference(transfer.externalReference);
        if (!externalReference.startsWith(`${asaas_identifiers_1.WABA_ASAAS_ORDER_PREFIX}split:`)) {
            return { status: "REFUSED", refuseReason: "Transferência sem referência WABA split." };
        }
        const settlements = this.settlementRepository.list(500);
        for (const settlement of settlements) {
            for (const line of settlement.lines) {
                const lineRef = normalizeReference(line.payoutExternalReference) ||
                    `${asaas_identifiers_1.WABA_ASAAS_ORDER_PREFIX}split:${settlement.orderId}:${line.lineKind}:${line.participantId}`;
                if (lineRef !== externalReference)
                    continue;
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
                        lines: settlement.lines.map((item) => item.participantId === line.participantId && item.lineKind === line.lineKind
                            ? { ...item, asaasTransferId: transferId, payoutStatus: "processing" }
                            : item),
                    });
                }
                return { status: "APPROVED" };
            }
        }
        return { status: "REFUSED", refuseReason: "Split não encontrado para esta transferência." };
    }
}
exports.AsaasTransferAuthService = AsaasTransferAuthService;
