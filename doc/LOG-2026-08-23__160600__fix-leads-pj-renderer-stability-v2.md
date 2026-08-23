# LOG — Leads PJ renderer stability v2

## Evidência produção (v1)
Após `pronto para pesquisar` → `Chromium interrompido — recuperando da página 8`. Pool 140 congelado. Checkpoint nextPage=8.

## Causa provável
`locator('body').filter({ hasText })` + `body.innerText` completo após Pesquisar — reavaliação pesada do DOM → Target crashed.

## Patch v2
- Wait de resultados via `waitForFunction` em sample de `main` (8k chars)
- Cards via evaluate leve (sem scroll, sem body locator)
- Sem scrollIntoView no Pesquisar
- setToggle sem dismissBlocking por switch
- Progresso `clicando Pesquisar` / `aguardando resultados` / posicionamento retomada
- Soft-cap 2 mantido

Marker: `DEPLOY-2026-08-23-leads-pj-renderer-stability-v2`
