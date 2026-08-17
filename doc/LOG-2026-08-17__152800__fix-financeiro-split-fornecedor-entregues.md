# LOG — Financeiro: comprovante na linha do pedido e PIX por entregues

**Data:** 2026-08-17

## Contexto

Ao concluir o pagamento do fornecedor, o Financeiro criava linhas `campaign-supplier:` com comprovante, em vez de atualizar a discriminação já existente no pedido. O valor usava mensagens enviadas; deve usar **entregues**.

## Solução

- Localizar o settlement original (mesmo assinante/plano/fornecedor) e pagar só a linha `supplier`.
- Absorver settlements sintéticos já gravados (copia comprovante, remove a linha extra, sem segundo PIX).
- Base do valor: `performanceReport.delivered`, limitada por enviados, planejado e créditos pagos (bônus continua sem split).
- UI: após vincular a campanha, a linha mostra “entregues”.

## Arquivos

- `src/billing/waba-financeiro-split.service.ts`
- `src/billing/waba-financeiro-split-payout.service.ts`
- `src/billing/waba-financeiro-split-settlement.repository.ts`
- `src/billing/waba-campaign-credit-funding.ts`
- `index.html`
- `src/deploy-marker.ts`

## Validar

1. Abrir Admin → Financeiro: linhas `campaign-supplier:` somem; Operador Douglas no pedido original ganha ícone de comprovante.
2. Nova campanha: PIX = entregues × custo; não nasce linha `campaign-supplier` se o pedido original existir.
3. `GET /health` com marker `DEPLOY-2026-08-17-financeiro-split-fornecedor-entregues`.

## Palavras-chave

`campaign-supplier`, entregues, `delivered`, split fornecedor
