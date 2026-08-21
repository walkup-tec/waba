# Fix — split PIX ao transferir campanha entre operacionais

## Contexto

Pedido: quando uma campanha é transferida de um operador para outro, o repasse PIX do fornecedor deve usar a chave do operador **eleito**, não do anterior.

## Investigação

- Repasse ao fornecedor operacional é **adiado** até a finalização da campanha (`payoutSupplierForCompletedCampaign`).
- A transferência (`forceAssignToOperacionalEmail` / `assignToSupplier`) já gravava `assignedOperacionalEmail` e `assignedSupplierId`.
- **Lacunas:**
  1. O payout resolvia fornecedor só por `assignedSupplierId` via `getSupplierById` — IDs `manual-*` (transferência master) não existiam no config e falhavam.
  2. Settlement `campaign-supplier:{id}` existente com linha `pending`/`failed` não era atualizado se o operador mudasse antes do PIX.

## Solução

1. `resolveSupplierForCampaignIntake` — resolve fornecedor pelo e-mail do operacional atribuído + plano + segmento (fallback por ID).
2. `syncCampaignSupplierSettlementForIntake` — atualiza linha `supplier` pendente/falha com `participantId`, e-mail e `pixKey` do eleito; não altera linhas `paid`/`processing`.
3. `assignToSupplier` chama sync após cada atribuição/transferência.
4. `payoutSupplierForCompletedCampaign` usa resolução por operacional eleito e sincroniza settlement existente antes de repassar.

## Arquivos alterados

- `src/billing/waba-financeiro-split.service.ts`
- `src/services/waba-campaign-supplier-assignment.service.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-14-campaign-transfer-split-pix`
- `scripts/verify-campaign-transfer-split-pix.cjs`
- `package.json` (script `verify:campaign-transfer-split-pix`)

## Como validar

```bash
npm run build
npm run verify:campaign-transfer-split-pix
```

Funcional (v02/prod após redeploy):

1. Campanha atribuída ao operador A → transferir para B (master).
2. Finalizar campanha com envios billable.
3. Settlement `campaign-supplier:{id}` deve ter PIX/e-mail do operador B.

## Palavras-chave

`transferência operacional`, `split PIX`, `campaign-supplier`, `resolveSupplierForCampaignIntake`, `syncCampaignSupplierSettlement`
