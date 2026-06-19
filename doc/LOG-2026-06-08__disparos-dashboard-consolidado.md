# LOG — Dashboard Disparos relatório consolidado

**Data:** 2026-06-08  
**Pedido:** Cada usuário vê só seus indicadores; no dashboard, mesmo relatório das campanhas somando todas.

## Regra de escopo

- `GET /disparos/dashboard/overview` autentica por sessão e agrega **somente** campanhas com `ownerEmail === auth.email`.
- Créditos continuam em `/billing/disparos/credits` (já por e-mail).

## Backend

- `src/disparos/waba-disparos-dashboard.service.ts` — soma `performanceReport` das campanhas `completed`.
- `GET /disparos/dashboard/overview` em `waba-campaign-intake.routes.ts`.

## Frontend

- Painel `#disparos-dashboard-report` reutiliza `buildCampaignPerformanceDashboardHtml` (progresso, contagem, pizza, taxas).
- Resumo textual com saldo + status das campanhas.
- Sem relatório ainda: mensagem orientando aguardar finalização/consolidação.

## Validação

- `npm run build` — OK.

## Pendências

- Deploy Easypanel (não solicitado).
