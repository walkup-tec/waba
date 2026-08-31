# LOG — 2026-07-05 — fix healthcheck /live waba_disparador

## Contexto / chats abertos

- Solicitação: estabilizar healthcheck do container `waba_disparador` (Easypanel/Docker).
- Problema: `HEALTHCHECK` em `/ready` passava por body parsers, maintenance e middlewares pesados → timeouts e restarts.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/index.ts` | `/live` (ultra-leve) e `/ready` registrados logo após `stripBasePathMiddleware`, antes de parsers/maintenance; removido handler duplicado (~L507). |
| `Dockerfile` | HEALTHCHECK usa `/live`; timeout interno 8000ms; docker timeout 15s; interval 45s; retries 5. |
| `src/deploy-marker.ts` | `DEPLOY-2026-07-05-healthcheck-live-waba-disparador` |
| `dist/` | Rebuild via `npm run build` |

## Comandos executados

```powershell
git clone https://github.com/walkup-tec/waba.git waba-repo
npm ci
npm run build
```

## Validação

- `npm run build` — OK (tsc + copy-index-html).

## Pendências

- Validar em produção: deploy Easypanel com título `[sha] fix: ...`; confirmar `GET /live` → 200 `ok` e marker em `GET /health`.
