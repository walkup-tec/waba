# LOG — 2026-07-05 — overlay deploy falso positivo (serverBootId)

## Sintoma

Usuário master (`walkup@walkuptec.com.br`) via modal «ATUALIZANDO O SISTEMA» intermitente com `waba_disparador` **verde e estável** no Easypanel.

## Investigação (últimos minutos / produção)

| Probe | Resultado |
|-------|-----------|
| `GET /health` ×15 | 200 estável; bootId único `mr8120ei-9e21d348`; marker `DEPLOY-2026-07-05-healthcheck-live-waba-disparador` |
| `GET /ready` ×20 | 200 estável; `ready:true`; sem `shuttingDown` |

Servidor estável — problema no **frontend** (overlay de deploy resilience).

## Causa raiz

Em `index.html`, `watchDeployInBackground()` roda a cada **8s** e chama `startDeployRecovery()` quando `hasDeployVersionDrift(probe)` é true.

A função comparava **`deployMarker` e `serverBootId`**. O `serverBootId` muda em **todo restart** do processo Node (SIGTERM, healthcheck recovery, redeploy), mesmo **sem** novo deploy/marker.

Fluxo do falso positivo:
1. Aba aberta captura baseline com bootId A
2. Container reinicia (mesmo marker) → bootId B
3. Poll detecta drift → modal «Atualizando»
4. Após ~6s estável → reload automático
5. Ciclo pode repetir se houver restarts ou baseline desatualizado

Isso contradiz a regra de 2026-07-03 (overlay só com `shuttingDown` real), pois drift de bootId não exige shutdown.

## Fix

| Arquivo | Mudança |
|---------|---------|
| `index.html` | `hasDeployMarkerDrift()` — só marker para gatilho do watch em background |
| `index.html` | `hasDeployVersionDrift()` — bootId só após `sawDeploySignal` (shutdown observado) |
| `index.html` | `watchDeployInBackground` usa `hasDeployMarkerDrift` |
| `src/deploy-marker.ts` | `DEPLOY-2026-07-05-deploy-overlay-bootid-false-alarm-fix` |
| `dist/` | rebuild |

## Próximo

Commit + push + redeploy Easypanel `waba_disparador`.

## Workaround imediato (sem deploy)

Hard refresh (Ctrl+Shift+R) ou limpar sessionStorage `waba.deployReload` — reduz overlay pós-deploy, mas não corrige bootId drift.
