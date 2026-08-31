# LOG — Leads PJ sem parada prematura em ~104 págs. (v9.20)

## Contexto

Job Corban: **104/1.000** páginas, **2.061** CNPJs, Copiando ✓ e já em **Enriquecendo** (ReceitaWS).
Produto exige continuar a cópia até `maxPages` (1000) / teto UI ou fim real da paginação.

## Causa raiz

`pagesToFetch = min(maxPages, ceil(portalTotal/20))`. Com `portalTotal` subestimado (~2 080), a meta virava **104**.
`MAX_PAGES` / `BEYOND_TOTAL` marcavam `scrapeCompleted=true` e o pipeline ia para ReceitaWS.

## Solução

1. Adapter: `portalTotal` só informativo — **não** encolhe o teto; meta = `maxPages` (cap UI 1000).
2. Service: `isPortalScrapeReallyComplete` — exige `pagesDone >= maxPages` ou fim real (`THREE_EMPTY_*`, `UI_MAX_PAGE`, …).
3. Enrich prematuro (Corban atual): devolve lote ao pool e retoma COPY.
4. `resumeIncompletePortalScrape` limpa `scrapeCompleted` e força `pagesToFetch = maxPages`.

Marker: `DEPLOY-2026-08-24-1515-leads-pj-no-early-stop-v9.20`

## Validação

- `tsc` OK.
- Funcional: após Redeploy, Corban deve sair de Enriquecendo e voltar a Copiando além de 104; `/health` com marker v9.20.

## Palavras-chave

`leads-pj`, `104`, `portalTotal`, `pagesToFetch`, `scrapeCompleted`, `prematuro`, `v9.20`
