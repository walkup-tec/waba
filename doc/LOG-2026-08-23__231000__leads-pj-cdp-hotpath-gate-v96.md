# LOG — Leads PJ CDP hot-path gate v9.6

## Contexto

Sensação de “avança e retrocede”: patches v9.x corrigiam um hang CDP e o próximo aparecia. Plano único até a 1ª página copiada.

## Inventário (FILTERS → SEARCH → 1ª COPY)

| Risco | Tratamento v9.6 |
|-------|-----------------|
| `clickSearchDom` / `focusSearchButton` com `findSearchButtonCandidates` pesado | Fast + `withNodeTimeout` |
| `waitForSearchTransition` lite null infinito | 3 misses → `renderer-unresponsive` |
| `page.waitForTimeout` pós-goto / CNAE / waitUntilPage / reread | `sleepNode` |
| `readResultsSampleText` / cards / page number sem teto | `cdpOrReconnect` → `new-browser` |
| UI stepper: erro SEARCH → “Abrindo Portal” | `resolveMarketingLeadsCnpjStage` reconhece `SEARCH:` / CDP / CTA |

## Solução

- Helper `cdpOrReconnect` + `sleepNode`
- Gate no hot path até primeira leitura COPY
- Correção de estágio na UI (`index.html` + `dist/index.html`)

## Marker

`DEPLOY-2026-08-23-2310-leads-pj-cdp-hotpath-gate-v9.6`

## Validação

1. Push + Redeploy → `/health` com marker v9.6
2. Corban: pills devem marcar **Pesquisando** em msgs `SEARCH:…` (não Abrindo Portal)
3. Sucesso funcional: `COPY: página 1 arquivada` + pool > 0
4. Se CDP morrer: reconnect Chromium, não failed soft com “botão não achado”

## Palavras-chave

leads-pj, cdpOrReconnect, sleepNode, hot-path, v9.6, stepper, COPY page 1
