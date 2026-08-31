# LOG — Page crashed → hard recover + soft-cap 3 (v9.22)

## Contexto

Após v9.21 (10 paralelos): Cobrança `page.goto: Page crashed`; Imobiliária timeout no login;
Corban travado em FILTERS. Jobs marcavam **Falhou (sem reconnect auto)**.

## Causa

1. Regex de hard recover só tinha `Target crashed`, não `Page crashed` (Playwright).
2. 3 Chromiums dedicados no mesmo VPS/Xvfb já saturam memória → crash/timeout.

## Solução

- Incluir `Page crashed` no recover (adapter + service) → retoma checkpoint/pool.
- Soft-cap default **3** + stagger **8s** (override até 12).
- Marker `DEPLOY-2026-08-24-1610-leads-pj-page-crash-recover-v9.22`

## Env recomendado

```
CASADOSDADOS_MAX_CONCURRENT_SCRAPES=3
CASADOSDADOS_SCRAPE_STAGGER_MS=8000
CASADOSDADOS_BROWSER_SERVER=0
```

## Palavras-chave

`Page crashed`, `hardRecovery`, `soft-cap 3`, `v9.22`
