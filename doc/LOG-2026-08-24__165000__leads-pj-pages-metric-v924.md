# LOG — Páginas reais + E2E dual (v9.24)

## Problemas reportados

1. Coluna Páginas = 59 enquanto log `322→323`
2. Job falhou com `page.goto: net::ERR_ABORTED`
3. Pedido: especialistas + E2E interno 2 jobs antes do Easypanel

## Causas (confiança alta)

1. `resolveScrapeHistoryMetrics` forçava `pagesDone = CNPJs/20` quando checkpoint ≫ volume (1180→59).
2. Checkpoint era rebobinado para `volumeFloor` se `completedPage > volume+50`.
3. Retomada adotava UI distante (322) quando salto falhava → pulava páginas.
4. `ERR_ABORTED` fora do hard-recover.

## Correções

- Coluna Páginas = `nextPage-1` do checkpoint (página Oruga real)
- Checkpoint sempre sequencial (sem rewind por volume)
- Nunca adotar UI se `cur > floor+2`
- `ERR_ABORTED` / frame detached → new-browser
- Script `scripts/e2e-leads-pj-dual.cjs` (unit métrica + 2 scrapes maxPages=2)

Marker: `DEPLOY-2026-08-24-1650-leads-pj-pages-metric-v9.24`

## Validação

- Unit: pagesDone=322 com pool 1180
- E2E dual local (ver log `.tmp-e2e-leads-pj-dual.log`)

## Palavras-chave

`pagesDone`, `59 vs 322`, `ERR_ABORTED`, `e2e dual`, `v9.24`
