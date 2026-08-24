# LOG — Leads PJ pré-CTA lite probe v9.4

## Problema

`SEARCH: preparando CTA Pesquisar… — 128s+`
Após Escape, `runSearchOnce` fazia `await probeSearchState(page)` **sem** Node timeout.
`findSearchButtonCandidates` travava a fila CDP.

## Fix

- Pré-CTA: só `probeSearchAckLite` + `withNodeTimeout(3s)`
- `waitForSearchTransition`: lite probe + sleep Node (sem page.waitForTimeout / probe completo)
- Marker: `DEPLOY-2026-08-23-2240-leads-pj-precta-lite-probe-v9.4`
