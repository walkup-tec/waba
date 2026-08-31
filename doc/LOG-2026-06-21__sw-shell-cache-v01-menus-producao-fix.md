# LOG — Menus V01/disparo legado ao recarregar produção

## Problema

Intermitentemente, ao atualizar a página em produção (`waba.draxsistemas.com.br`), apareciam menus antigos do ambiente V01/local (ex.: **Disparos** legado, fluxo `full`/baseline) em vez da UI produção atual.

## Causa raiz

1. **Service worker (`sw-deploy-resilience.js`)** ao cachear qualquer navegação HTML também gravava a resposta na chave **`/`**, inclusive visitas a **`/version-01/`** (UI baseline/V01).
2. Em falha de rede ou **502/503/504** durante redeploy, o SW servia essa shell contaminada para a raiz de produção.
3. Sem classe `waba-ui-production` no `<body>` antes do JS principal, menus `.waba-full-only` ficavam visíveis até `initUiProfile()` rodar.

## Solução

1. **Cache isolado por rota (SW v3)**
   - Removido `cache.put("/", …)` cross-path.
   - Cache só grava quando header `X-Waba-Shell-Cache-Key` coincide com a rota:
     - `/` → `waba-shell-production-root`
     - `/version-01` → `waba-shell-baseline-version-01`
     - `/version-02` → `waba-shell-production-version-02`
   - Bump `CACHE_SHELL` → `waba-deploy-shell-v3`; SW URL `?v=3`.

2. **Header no servidor** — `sendIndexHtml` envia `X-Waba-Shell-Cache-Key` via `resolveShellCacheKey()`.

3. **UI profile síncrono** — script inline logo após `<body>` aplica `waba-ui-production` / `waba-ui-baseline` com base em `WABA_UI_PROFILE` injetado.

## Arquivos

- `media/sw-deploy-resilience.js`
- `src/base-path.ts` — `resolveShellCacheKey()`
- `src/index.ts` — header de cache
- `index.html` — script early + SW v3
- `src/deploy-marker.ts`

## Validar

1. Produção: hard refresh (Ctrl+Shift+R) — menus **Disparos** com Dashboard, Créditos, API Alternativa, API Oficial; **sem** Disparos legado / Meta checklist V01.
2. Visitar `/version-01/` no mesmo browser e voltar à raiz `/` — refresh normal continua com UI produção.
3. Durante redeploy: overlay + shell produção (não V01).
4. `GET /health` → marker `DEPLOY-2026-06-21-sw-shell-cache-isolamento-ui-profile`.

## Palavras-chave

`service worker`, `waba-deploy-shell`, `version-01`, `WABA_UI_PROFILE`, `waba-full-only`, `shell cache`, `menus V01`
