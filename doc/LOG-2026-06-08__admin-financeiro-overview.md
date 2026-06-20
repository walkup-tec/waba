# Admin · Financeiro — overview e pedidos

**Data:** 2026-06-08

## Pedido
Configurar área **Admin → Financeiro** (antes placeholder).

## Implementado
- `GET /admin/financeiro/overview` (master): config Asaas, resumo, lista de pedidos `waba-disparos`
- `POST /admin/financeiro/orders/:orderId/reconcile` — concilia PIX pendente
- UI `tab-admin-financeiro`: cards de config, tabela, filtro, Conciliar PIX
- Marker: `DEPLOY-2026-06-08-admin-financeiro-overview`

## Config servidor (.env.v02 / produção)
- `ASAAS_API_KEY`
- `ASAAS_API_BASE_URL` (sandbox ou produção)
- `ASAAS_WEBHOOK_ACCESS_TOKEN`
- Webhook Asaas → `{WABA_APP_LOGIN_URL}/webhooks/asaas`

## Pendências
- Dashboard admin (métricas agregadas)
- Export CSV pedidos
