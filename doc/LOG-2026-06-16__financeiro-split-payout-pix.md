# Financeiro — Repasse PIX automático do split

**Data:** 2026-06-16

## Solicitação
Deixar o sistema pronto para executar split de pagamento (fornecedor + rateio do lucro).

## Implementado
- `asaas-pix-key.ts` — detecta tipo da chave PIX (CPF/CNPJ/EMAIL/PHONE/EVP)
- `asaas.client.ts` — `createAsaasPixTransfer`, `getAsaasTransfer`
- `waba-financeiro-split-payout.service.ts` — orquestra repasse por linha do settlement
- Settlement com `payoutStatus` por linha e no pedido
- Hook em `waba-billing.service.ts` → `settleAndPayoutPaidOrder` após pagamento
- Admin API:
  - `POST /admin/financeiro/split-backfill`
  - `POST /admin/financeiro/split-payouts/process-pending`
  - `POST /admin/financeiro/split-settlements/:orderId/payout`
- UI: coluna Repasse, botões backfill/repasse, retry por pedido

## Env
- `WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED=true` (desative com `false` em dev)
- Requer `ASAAS_API_KEY` e saldo na conta Asaas

## Marker
`DEPLOY-2026-06-16-financeiro-split-payout-pix`

## Validação
- `npm run build` OK

## Pendências
- Webhook Asaas para status de transferência (hoje consulta no retry)
- Recalcular settlement se config mudar retroativamente
