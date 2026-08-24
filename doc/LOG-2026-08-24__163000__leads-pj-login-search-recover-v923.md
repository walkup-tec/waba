# LOG — Login/SEARCH recover (v9.23)

## Sintomas (prod)

- Corban: `LOGIN: autenticado — 395s+` (travado pós-login)
- Cobrança: loop SEARCH ACK com `cnpj=0` sem avançar pág. 52
- Imobiliária: timeout `input[name=email]` → failed sem reconnect

## Causas

1. `page.goto` pós-login sem teto Node → hang CDP infinito (keepAlive só incrementa segundos).
2. Timeout do formulário de login = Error genérico → “Falhou sem reconnect auto”.
3. `SEARCH_TIMEOUT_RESPONSIVE` era soft (`same-page`) → job pausava em vez de novo Chromium.

## Correções

- `gotoWithNodeBudget` (40s) + fases `autenticado — abrindo pesquisa…`
- Login timeout → `LeadsScrapeError LOGIN_TIMEOUT / new-browser`
- SEARCH timeout → `new-browser`
- Soft-cap default **2** + stagger **12s**

Marker: `DEPLOY-2026-08-24-1630-leads-pj-login-search-recover-v9.23`

## Env

```
CASADOSDADOS_MAX_CONCURRENT_SCRAPES=2
CASADOSDADOS_BROWSER_SERVER=0
CASADOSDADOS_SCRAPE_STAGGER_MS=12000
```

## Palavras-chave

`LOGIN autenticado`, `gotoWithNodeBudget`, `LOGIN_TIMEOUT`, `SEARCH_TIMEOUT`, `v9.23`
