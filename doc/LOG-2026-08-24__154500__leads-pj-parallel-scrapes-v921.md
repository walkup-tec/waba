# LOG — Leads PJ raspagens paralelas (v9.21)

## Contexto

Com 3 jobs, só 1 raspava (`máx. 1 em paralelo`); Corban/Imobiliaria ficavam na fila.
Pedido: N jobs (ex. 10) devem fazer login + cópia **ao mesmo tempo**.

## Causa

`CASADOSDADOS_BROWSER_SERVER` default=1 + `resolveMaxConcurrentScrapes()` forçava **1**
(browser compartilhado não aguenta N contexts).

## Solução

1. Soft-cap default **10** (clamp 1–12); stagger default **0**.
2. Browser **dedicado** por job (`CASADOSDADOS_BROWSER_SERVER` default **0**).
3. Fecha Chromium ao fim de cada sessão de job.

Marker: `DEPLOY-2026-08-24-1545-leads-pj-parallel-scrapes-v9.21`

## Env (opcional no Easypanel)

- `CASADOSDADOS_MAX_CONCURRENT_SCRAPES=10`
- `CASADOSDADOS_BROWSER_SERVER=0`
- `CASADOSDADOS_SCRAPE_STAGGER_MS=0`

## Validação

- `tsc` OK.
- Após Redeploy: 3 jobs ativos sem “posição 1/2 na fila”; `/health` marker v9.21.

## Palavras-chave

`leads-pj`, `paralelo`, `MAX_CONCURRENT_SCRAPES`, `BROWSER_SERVER`, `v9.21`
