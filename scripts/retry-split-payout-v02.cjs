/**
 * Sonda permissão de transferência Asaas e reprocessa repasse PIX do split (v02).
 *
 * Uso: node scripts/retry-split-payout-v02.cjs [orderId]
 */
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env.v02") });

const ORDER_ID = process.argv[2] || "7e2213b8-3064-413f-8666-a627420f1738";

async function main() {
  const hasTransferKey = Boolean(String(process.env.ASAAS_TRANSFER_API_KEY || "").trim());
  const hasPaymentKey = Boolean(String(process.env.ASAAS_API_KEY || "").trim());
  console.log("=== Split payout retry (v02) ===\n");
  console.log("ASAAS_TRANSFER_API_KEY:", hasTransferKey ? "definida" : "ausente");
  console.log("ASAAS_API_KEY:", hasPaymentKey ? "definida" : "ausente");
  console.log("Pedido:", ORDER_ID, "\n");

  const { probeAsaasTransferPermission } = require("../dist/billing/asaas.client.js");
  const probe = await probeAsaasTransferPermission();
  console.log("Sonda transferência:", JSON.stringify(probe, null, 2), "\n");

  if (!probe.ok) {
    console.error("Bloqueado: corrija ASAAS_TRANSFER_API_KEY / permissões no Asaas antes do repasse.");
    process.exit(1);
  }

  const { WabaFinanceiroSplitPayoutService } = require("../dist/billing/waba-financeiro-split-payout.service.js");
  const payout = new WabaFinanceiroSplitPayoutService();
  const result = await payout.executeForOrderId(ORDER_ID);
  if (!result) {
    console.error("Settlement não encontrado para o pedido.");
    process.exit(1);
  }

  console.log("Resultado repasse:");
  console.log("  payoutStatus:", result.payoutStatus);
  for (const line of result.lines) {
    console.log(
      `  - ${line.lineKind} ${line.participantLabel}: ${line.payoutStatus}` +
        (line.failureReason ? ` (${line.failureReason})` : "") +
        (line.asaasTransferId ? ` [${line.asaasTransferId}]` : ""),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
