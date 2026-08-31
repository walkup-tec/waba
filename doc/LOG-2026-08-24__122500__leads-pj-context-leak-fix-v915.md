# LOG — Leads PJ context leak fix v9.15

## Sintoma

Com v9.14 + shm 2G: sessão reiniciava LOGIN→FILTERS→CNAE→**BOOT** sem chegar em Copiando (pool 0).

## Causa (confiança alta)

1. Em erro no meio de FILTERS/CNAE, o `BrowserContext` **não era fechado** (`finally` só limpava timers).
2. Chromium compartilhado acumulava contexts → crash → `releaseSharedBrowser` → BOOT.
3. Retry do wrapper **sempre** matava o browser mesmo quando ainda estava vivo.
4. Soft-cap 2 + browser compartilhado = 2 jobs no mesmo Chromium.

## Correção

- `context.close()` sempre no `finally`
- Retry só faz `releaseSharedBrowser` se `!isSharedBrowserConnected()`
- Com `CASADOSDADOS_BROWSER_SERVER=1`, max concurrent scrape = **1**
- Marker `…context-leak-fix-v9.15`

## Validar

Redeploy → Corban deve passar FILTERS e entrar em `COPY: página N` sem voltar a `BOOT: conectando Chromium`.
