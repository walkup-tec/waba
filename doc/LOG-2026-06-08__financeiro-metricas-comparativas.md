# LOG — Financeiro: métricas comparativas por indicador

**Data:** 2026-06-08  
**Contexto:** Pedido de layout mais comparativo nos cards do Admin → Financeiro (API Oficial vs API Alternativa).

## Solicitação
- Trocar visão agrupada por produto (2 colunas) por visão agrupada por **indicador** (3 cards).
- Dentro de cada card: comparar Oficial vs Alternativa com barras proporcionais + total consolidado.

## Alterações
- `index.html`:
  - CSS: `.admin-financeiro-compare-card`, `.admin-financeiro-compare-row`, barras, legenda.
  - HTML: `#admin-financeiro-metrics-legend` acima do root.
  - JS: `renderAdminFinanceiroProductMetrics` refatorado; helpers `adminFinanceiroProfitClass`, `renderAdminFinanceiroCompareRow`.
- `dist/index.html` via `node scripts/copy-index-html.mjs`.

## Validação
- Copy script OK.
- Teste visual: recarregar Admin → Financeiro com Ctrl+F5 em `npm run dev:v02`.

## Pendências
- Deploy Easypanel não solicitado.
- Opcional: atualizar `src/deploy-marker.ts` se for para produção.
