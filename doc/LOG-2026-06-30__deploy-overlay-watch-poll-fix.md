# LOG — Overlay deploy: modal intermitente em produção

**Data:** 2026-06-30

## Problema

Em alguns deploys, o modal **"ATUALIZANDO O SISTEMA"** não aparecia para o usuário master com a aba aberta em produção.

## Causas

1. **Sem polling em background** — overlay só reagia a erro 502/503 em chamadas API ou ao carregar a página. Aba ociosa durante redeploy rápido não via sinal.
2. **Baseline sobrescrito** — `startDeployRecovery()` chamava `captureDeployBaseline()` após o deploy já ter terminado, gravando marker/bootId **novos** como baseline → `isDeployVersionReady` nunca detectava mudança → após 45s o modal sumia **sem reload**.
3. **`/auth/session` bypass no shutdown** — sessão master continuava OK durante SIGTERM; poucas rotas retornavam 503 se o usuário não clicava em nada.
4. **FTP sem restart Node** — só Easypanel redeploy muda `serverBootId`; FTP sozinho não dispara overlay (esperado).

## Correções (`index.html`)

1. **Watch a cada 8s** + ao voltar para a aba (`visibilitychange`) — compara `deployMarker` / `serverBootId` com baseline.
2. **`captureDeployBaselineIfEmpty()`** — não sobrescreve baseline da sessão ao iniciar recovery.
3. **Reload após deploy** — 3 probes estáveis com `sawDeploySignal` bastam (mesmo se marker igual, ex.: hotfix sem alterar marker).
4. **`fetchWithTimeout`** — só dispara recovery em 502/504 ou 503 com `shuttingDown`/`maintenanceMode` (menos falso positivo, mais preciso no shutdown real).

**Marker:** `DEPLOY-2026-06-30-deploy-overlay-watch-poll-fix`

## Validar

1. Easypanel redeploy com master logado e aba parada → modal aparece em até ~8s.
2. Após estabilizar → reload automático.
3. Dev local (`localhost`) → sem modal.

## Palavras-chave

`deploy overlay`, `watch poll`, `serverBootId`, `baseline`, `master`, `Easypanel`
