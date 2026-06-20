# LOG — Dashboard Disparos visão master (assinantes)

**Data:** 2026-06-08  
**Pedido:** Master deve ver relatório somando envios de todos os assinantes (apenas assinantes).

## Implementação

- `buildMasterSubscribersDisparosDashboardOverview` em `waba-disparos-dashboard.service.ts`.
- Filtra campanhas cujo `ownerEmail` está em `waba-subscribers.json`.
- `GET /disparos/dashboard/overview`: se `auth.role === "master"` → agregação global; senão → escopo `owner`.
- Front: `scope === "master_subscribers"` ajusta resumo e rótulo do consolidado.

## Validação

- `npm run build` — OK.
