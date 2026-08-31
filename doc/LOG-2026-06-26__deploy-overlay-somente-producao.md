# LOG — Overlay de deploy só em produção (Easypanel)

## Problema

Tela "Estamos atualizando o sistema" aparecia ao editar código localmente (Cursor reinicia o servidor / falha de rede), não apenas durante deploy no Easypanel.

## Causa

1. `DOMContentLoaded` acionava overlay em **qualquer** falha de `/health` (incluindo connection refused).
2. `fetchWithTimeout` acionava overlay em **qualquer** erro de rede no `catch`.
3. Service worker registrado também em `localhost`.

## Solução

1. **`isDeployResilienceEnabled()`** — ativo apenas em `*.draxsistemas.com.br` (exclui localhost e IPs privados).
2. **`probeHealth()`** — retorna `deploySignal` só para 502/503/504 ou JSON `shuttingDown: true`; erro de rede não é sinal de deploy.
3. Overlay e poll só após `startDeployRecovery()` com sinal explícito de deploy.
4. `fetchWithTimeout` — remove trigger no `catch`; mantém só 502/503/504 em produção.
5. Service worker registrado apenas quando resiliência está habilitada.

## Arquivos

- `index.html`
- `dist/index.html`
- `src/deploy-marker.ts`

## Validar

1. `localhost` / dev local: salvar arquivos e reiniciar Node → **sem** overlay.
2. Produção durante redeploy Easypanel → overlay + poll até `/health` OK.
3. `GET /health` com `shuttingDown: true` em produção → overlay.

## Palavras-chave

`deploy overlay`, `localhost`, `draxsistemas`, `shuttingDown`, `502`, `service worker`
