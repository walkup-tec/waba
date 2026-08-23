# LOG — Leads PJ search ACK v9

## Pedido

Corrigir A (clique sem efeito) + E (service reconnect em soft timeout): probe/ACK, fallbacks de clique, `LeadsScrapeError`, service sem scheduleResume em soft.

## Mudanças

1. `probeSearchState` / `waitForSearchAck` / `dispatchSearchWithAck` (mouse → DOM → Enter)
2. Botão Pesquisar = maior área visível (não o 1º match)
3. Detecção de resultados: CNPJ puro OR pagination OR total (não exigir `CNPJ - NOME`)
4. `LeadsScrapeError(code, recovery)` — soft retry só no adapter
5. Service: soft → `failed` pausado **sem** "Retomando da página 1"; hard → reconnect
6. Marker: `DEPLOY-2026-08-23-2100-leads-pj-search-ack-v9`

## Validar

Redeploy → progress deve mostrar ACK ou fallbacks em &lt;15s.  
`SEARCH_TIMEOUT_RESPONSIVE` **não** pode mais virar LOGIN→FILTERS.
