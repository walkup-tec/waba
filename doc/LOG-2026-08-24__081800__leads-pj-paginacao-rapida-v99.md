# LOG — Leads PJ paginação rápida v9.9

## Contexto

Usuário: 5 páginas de 1000 não podem levar horas; no V02 era rápido.

## Evidência produção (antes)

- Progresso: `Copiando: avançando paginação 17 → 18. — 58s` em **um** avanço.
- Causa: após cada “próxima”, o robô fazia `waitUntilPage(10s)` + **`waitForPortalSearchResults(12s)`** (fluxo de 1ª pesquisa) + fallback Playwright locator (CDP lento).

## Correção

`goToNextResultsPage`:
- click DOM com teto Node 2,5s
- confirma só nº da página Oruga **ou** troca do 1º CNPJ (teto **4s**)
- **sem** `waitForPortalSearchResults` na paginação
- sem locator Playwright no hot path
- salto DOM / hop: espera 5s (antes 10–12s)
- retry: `sleepNode` (não `page.waitForTimeout`)

Marker: `DEPLOY-2026-08-24-0815-leads-pj-paginacao-rapida-v9.9`

## Meta observável

Página a página em segundos (não dezenas de segundos). 5 páginas ≪ 5 min em sessão saudável.

## Palavras-chave

`paginação`, `goToNextResultsPage`, `v9.9`, `lentidão`, `V02`, `waitForPortalSearchResults`
