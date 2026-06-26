# LOG — Deploy sem Bad Gateway para o usuário

**Data:** 2026-06-26  
**Marker:** `DEPLOY-2026-06-26-deploy-zero-downtime-ux`

## Problema

Durante redeploy no Easypanel, refresh em `waba.draxsistemas.com.br` exibia **Bad Gateway** (502 do Traefik/proxy), gerando chamados de suporte.

## Causa

No restart do container Node, o proxy fica sem upstream saudável por alguns segundos. O browser recebe HTML/texto cru do proxy, não a aplicação.

## Solução (3 camadas)

### 1. Service Worker (`media/sw-deploy-resilience.js`)

- Cache da última `index.html` bem-sucedida.
- Em navegação com 502/503/504 ou falha de rede, serve a shell em cache.
- Registrado no carregamento da página.

### 2. Overlay de atualização (`index.html`)

- Script inline + CSS: “Estamos atualizando o sistema”.
- Poll em `/health` a cada 2,5s (até 3 min).
- `fetchWithTimeout` aciona o overlay em 502/503/504 nas APIs.
- Mensagem orienta a não abrir chamado.

### 3. Graceful shutdown (`src/server/waba-graceful-shutdown.ts`)

- `SIGTERM`/`SIGINT`: `/health` e `/ready` passam a 503 (`shuttingDown: true`) para o load balancer tirar o pod da rota.
- APIs retornam 503 JSON; GET estático (`/`, assets, SW) continua servindo a shell.
- `SHUTDOWN_GRACE_MS` (padrão 25s) para drenar conexões.

## Arquivos

- `media/sw-deploy-resilience.js`
- `scripts/copy-index-html.mjs`
- `index.html`
- `src/server/waba-graceful-shutdown.ts`
- `src/index.ts`
- `src/deploy-marker.ts`

## Validar

1. Redeploy Easypanel com health check em `/health` ou `/ready`.
2. Com app já aberto antes: refresh durante deploy → overlay amigável, não “Bad Gateway”.
3. Logs: `[shutdown] SIGTERM — drenando conexões...`
4. `GET /health` durante shutdown → 503 + `shuttingDown: true`.

## Easypanel (recomendado)

- Health check: `GET /ready` ou `/health`, intervalo 10s, start period 60s.
- Preferir **rolling update** (nova réplica healthy antes de matar a antiga).

## Palavras-chave

`502`, `bad gateway`, `deploy`, `service worker`, `graceful shutdown`, `overlay`, `zero downtime`
