# LOG — Data de criação no comparativo de campanhas

**Data:** 2026-06-24  
**Pedido:** Exibir data de criação abaixo do nome de cada campanha no gráfico «Comparativo entre campanhas».

## Solução

### Backend
- `DisparosDashboardCampaignComparisonItem` passa a incluir `createdAt` (de `intake.createdAt`).
- `completedAt` mantém `updatedAt` (finalização).

### Frontend
- `formatDisparosDashboardCompareCreatedAt()` — formata em `pt-BR`; fallback para `completedAt` se API antiga.
- Linha abaixo do nome com classe `disparos-dashboard-compare-group-date`.

## Arquivos
- `src/disparos/waba-disparos-dashboard.service.ts`
- `index.html` (+ `dist/` via build)

## Validar
Dashboard Disparos → Comparativo entre campanhas: cada barra mostra nome + data (ex.: `21/06/2026`).

## Palavras-chave
`disparos-dashboard`, `campaignComparison`, `createdAt`, `comparativo campanhas`
