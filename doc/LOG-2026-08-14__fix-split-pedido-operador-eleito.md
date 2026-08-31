# Fix — split do pedido segue o operacional da campanha vigente

## Contexto

Cliente Fernando cancelou/reportou erro na campanha «6 DE AGOSTO» (Gabriel) e gerou outra, atribuída ao Douglas. No Financeiro o split do pedido pago ainda mostrava Operador Gabriel.

## Investigação

- Settlement `58aa9a81-…` criado no pagamento (14/08 10:19) com fornecedor da fila naquele momento: Gabriel (prioridade 1 à época).
- Linha do fornecedor ficou `skipped` (repasse PIX só após finalizar campanha).
- Campanha antiga `22dae8e7-…`: Gabriel, `error_reported`.
- Campanha vigente `776b2c92-…`: Douglas, `in_progress`.
- Douglas é prioridade 1 hoje; Gabriel prioridade 2.
- O sync anterior só atualizava settlement `campaign-supplier:{id}`, que só existe depois de finalizar. O Financeiro lista o split do **pedido**.

## Solução

- `applyElectedSupplierToSettlement` atualiza identidade/PIX da linha fornecedor se não estiver `paid`/`processing`.
- `syncDeferredOrderSettlementsForIntake` alinha o split do pedido pago ao operacional da campanha aberta.
- Atribuição/transferência já chama o sync.
- Abrir Financeiro (overview) sincroniza campanhas `generated`/`in_progress` — corrige o caso Fernando sem edição manual.
- Lucro já pago (Walkup/Eduardo) não é recalculado.

## Como validar

```bash
npm run build
npm run verify:campaign-transfer-split-pix
```

Após redeploy: abrir Admin → Financeiro. O pedido Fernando deve mostrar **Operador Douglas** na linha do fornecedor (ainda skipped até finalizar a campanha).

## Palavras-chave

`split pedido`, `operador eleito`, `Gabriel`, `Douglas`, `campanha cancelada`, `syncDeferredOrderSettlements`
