# LOG — 2026-08-28 — Marker forçado Redeploy

## Contexto

Operador pediu push com marker específico após já ter feito Redeploy. `GET /health` já estava em `DEPLOY-2026-08-28-093700-instancias-substitui-bloqueada`.

## Ação

Novo marker `DEPLOY-2026-08-28-095800-FORCE-INSTANCIAS-SWAP` em `src/deploy-marker.ts` e `dist/deploy-marker.js`, commit e push `origin/master` (sem force-push).

## Como validar

Após Redeploy EasyPanel `waba_disparador`: `GET /health` → `deployMarker` = `DEPLOY-2026-08-28-095800-FORCE-INSTANCIAS-SWAP`.

## Palavras-chave

deploy-marker, Redeploy, FORCE-INSTANCIAS-SWAP
