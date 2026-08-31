# LOG — Admin Dashboard: crescimento assinantes × receita

**Data:** 2026-06-17  
**Marker:** `DEPLOY-2026-06-17-subscriber-revenue-growth`

## Solicitação

Análise gráfica da proporção entre crescimento de assinantes e crescimento de receita; média de receita por usuário (ARPU); gráfico da evolução dessa média.

## Alterações

### Backend (`src/admin/waba-admin-dashboard.service.ts`)
- `buildSubscriberRevenueGrowth()` — série 30 dias com assinantes/receita acumulados, ARPU, índices base 100.
- Campo `growthAnalysis` no `GET /admin/dashboard/overview` (master: finance + subscribers).
- Summary: ARPU atual, crescimento % assinantes/receita/ARPU, razão receita÷assinantes, novos no período.

### Frontend (`index.html`)
- Seção `#admin-dashboard-growth-section` após “Receita · 30 dias”.
- 4 KPIs + 2 gráficos SVG em linha (índice proporcional + ARPU).
- `renderAdminDashboardSvgLineChart`, `renderAdminDashboardGrowthAnalysis`.

### Deploy
- `src/deploy-marker.ts` → `DEPLOY-2026-06-17-subscriber-revenue-growth`

## Validação

```bash
npm run build  # OK
node -e "require('./dist/admin/waba-admin-dashboard.service.js')..."  # growthAnalysis.summary OK
```

## Pendências

- Commit/deploy Easypanel quando usuário solicitar.
- Validar visualmente em `npm run dev:v02` → Admin → Dashboard (usuário master).
