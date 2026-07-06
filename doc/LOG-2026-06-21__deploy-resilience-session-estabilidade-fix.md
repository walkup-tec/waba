# LOG — Deploy resilience: overlay prematuro e logout no reload

**Data:** 2026-06-21  
**Tipo:** fix  
**Palavras-chave:** deploy-resilience, serverBootId, deployMarker, sessão, logout, overlay, reload

## Contexto do pedido

Durante deploy em produção:
1. Modal «Atualizando o sistema» fechou **antes** do deploy terminar.
2. A tela **não recarregou** automaticamente (estado JS antigo permaneceu).
3. Reload manual levou o usuário à **tela de login** (sessão aparentemente perdida).

## Causa raiz

1. **Overlay fechava cedo:** `pollUntilReady` considerava «estável» após 3 probes OK em `/health` + `/ready`, mesmo quando a instância **antiga** ainda respondia (rolling deploy Easypanel).
2. **Sem reload:** `hideDeployOverlay()` só escondia o modal; o texto prometia atualização automática, mas não havia `location.reload()`.
3. **Logout aparente no reload:** durante shutdown graceful, `/auth/session` recebia **503** (bloqueado pelo shutdown gate). `initWabaAuthGate` tratava falha como não autenticado e exibia login — cookie JWT ainda válido, mas UX de «deslogado».

## Solução implementada

### Backend
- `serverBootId` único por processo em `GET /health` (`src/index.ts`).
- `GET /auth/session` liberado durante shutdown graceful (`waba-graceful-shutdown.ts`) para validar JWT na instância que drena.
- Novo `deployMarker`: `DEPLOY-2026-06-21-deploy-resilience-session-fix`.

### Frontend (`index.html` — script `wabaDeployResilience`)
- Captura `baselineDeployMarker` + `baselineServerBootId` ao iniciar recovery.
- Só conclui deploy quando health estável **e** marker ou bootId mudou (`isDeployVersionReady`).
- Ao concluir: `sessionStorage.waba.deployReload=1`, purge SW cache, **`location.reload()`**.
- Falso positivo (503 transitório): após 45s estável na mesma versão, fecha overlay sem reload.

### Auth gate (`initWabaAuthGate`)
- Após reload pós-deploy: até 20 tentativas com backoff (503/shuttingDown não disparam logout).
- Logout POST **somente** com `response.ok && authenticated === false` (token realmente inválido).
- Remove flag `waba.deployReload` após sessão restaurada.

## Arquivos alterados

- `index.html`
- `src/index.ts`
- `src/server/waba-graceful-shutdown.ts`
- `src/deploy-marker.ts`

## Como validar

1. Deploy em produção com usuário logado em tela ativa.
2. Confirmar overlay permanece até nova versão (`curl /health` → `serverBootId` diferente).
3. Página recarrega sozinha; usuário permanece logado.
4. Reload manual imediato após deploy: sessão mantida (sem tela de login).
5. `GET /health` → `deployMarker: DEPLOY-2026-06-21-deploy-resilience-session-fix`.

## Observações de segurança

- Sessão continua stateless (JWT HMAC); não alterar `WABA_SESSION_EPOCH` em deploys rotineiros.
- Cookie HttpOnly inalterado; `/auth/session` em shutdown só lê cookie existente.
