# LOG — Toolbar assinante: contratado, compra e extrato

**Data:** 2026-06-08

## Pedido

Na tela Campanhas (assinante / `tab-disparos`):

1. Opção de compra mesmo com saldo
2. Total contratado em R$ no topo à direita
3. Ícone de extrato com últimas 20 compras

## Implementação

- Toolbar no header: chip **Contratado R$ …** + ícone carrinho (abre modal compra) + ícone extrato
- API `GET /billing/disparos/purchases?limit=20`
- `WabaDisparosCreditsService.listPurchaseHistory()`
- Modal extrato com lista de compras pagas

## Arquivos

- `index.html` — UI + JS
- `waba-billing.routes.ts`, `waba-disparos-credits.service.ts`
- `deploy-marker.ts`
