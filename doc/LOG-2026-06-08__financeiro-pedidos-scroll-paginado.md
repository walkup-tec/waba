# LOG — Financeiro: pedidos com scroll paginado

**Data:** 2026-06-08

## Pedido
Exibir últimos 10 lançamentos; rolagem carrega mais; não trazer todos os pedidos no front.

## Backend
- `GET /admin/financeiro/orders?limit=10&offset=0&status=all`
- `listOrders` em `waba-admin-financeiro.service.ts`
- `overview` sem array `orders` (métricas/resumo continuam server-side)
- Marker: `DEPLOY-2026-06-08-financeiro-pedidos-scroll-paginado`

## Frontend
- Estado `adminFinanceiroOrdersState` (items, total, hasMore, loading)
- Primeira página: 10 itens via API
- Scroll em `#admin-financeiro-table-wrap` carrega +10
- Filtro status reseta scroll e recarrega página 1
- Hint: "Role para ver mais lançamentos"

## Validar
`npm run build` OK. Ctrl+F5 → Admin → Financeiro → rolar tabela.
