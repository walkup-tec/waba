# LOG — Financeiro: somente cobranças conciliadas

**Data:** 2026-06-08

## Pedido
Remover botão "Conciliar PIX"; conciliação no backend; listar só cobranças já conciliadas.

## Alterações
- **API** `listOrders`: retorna apenas `status === "paid"`.
- **Removido** `POST /admin/financeiro/orders/:orderId/reconcile` e `reconcileOrder` do admin service.
- **Front:** removido botão Conciliar PIX, filtro de status, handler de conciliação.
- Ações: só "Abrir cobrança" (link Asaas) quando existir URL.
- Resumo: "X cobrança(s) conciliada(s) exibida(s) de Y no total."
- Marker: `DEPLOY-2026-06-08-financeiro-somente-conciliadas`

## Conciliação automática
Continua via webhook Asaas (`/webhooks/asaas`) e `reconcileOrderPayment` no billing service.

## Validar
`npm run build` OK. Ctrl+F5 → Admin → Financeiro: só pagos, sem botão conciliar.
