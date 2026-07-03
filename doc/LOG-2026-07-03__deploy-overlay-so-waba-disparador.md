# LOG — Overlay deploy só no container waba_disparador

**Data:** 2026-07-03

## Pedido

Modal «ATUALIZANDO O SISTEMA» apenas durante deploy do container **`waba_disparador`** — não em v01/v02, dev, nem por 502/504 genéricos.

## Solução

1. **`src/waba-container-service.ts`** — identifica serviço (`waba_disparador`, `waba_disparador_v01`, etc.) via `WABA_CONTAINER_SERVICE` ou `WABA_ENV` + `BASE_PATH`.
2. **`resolveDeployResilienceForClient()`** — `true` só se `waba_disparador`.
3. **`GET /health`** — campo `containerService`.
4. **Frontend** — `isDeployResilienceEnabled()` exige `containerService === waba_disparador`; gatilho do overlay **somente** `503` + `shuttingDown: true` (removidos 502/504 e maintenance).

## Validar

- Produção `waba_disparador`: redeploy Easypanel → overlay durante shutdown.
- v01/v02/local: `/health` com `deployResilienceEnabled: false` → sem overlay.
- Marker `DEPLOY-2026-07-03-deploy-overlay-so-waba-disparador`.

## Palavras-chave

`waba_disparador`, `deployResilienceEnabled`, `shuttingDown`, overlay atualização
