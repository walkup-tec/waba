# LOG — Leads PJ CNAE modal Node timeout v9.2

## Problema

Job preso 175s+ em `SEARCH: fechando modal CNAE…`.
`Promise.race([locator/evaluate, page.waitForTimeout])` não funciona: fila CDP serial — timeout nunca dispara.

## Fix

- Removido `locator('button:has-text("Fechar")')`
- Dismiss só com `keyboard.press("Escape")` + **setTimeout Node** (800ms)
- Segue imediatamente para descoberta do CTA Pesquisar
- Marker: `DEPLOY-2026-08-23-2205-leads-pj-cnae-modal-node-timeout-v9.2`
