# LOG — Easypanel build BuildKit grpc (retry)

**Data:** 2026-06-20

## Erro Easypanel

```
ERROR: failed to build: failed to run Build function: frontend grpc server closed unexpectedly
```

Ocorreu ao baixar/extrair `docker/dockerfile:1` (linha `# syntax=docker/dockerfile:1`). **Não é erro de TypeScript** — `npm run build` local OK no commit `f9e5ffc`.

## Ação

- Removido `# syntax=docker/dockerfile:1` do `Dockerfile` (não usamos features que exigem frontend externo).
- Novo marker: `DEPLOY-2026-06-20-docker-build-retry` → redeploy.

## Se falhar de novo

1. Easypanel → serviço → **Redeploy** (retry).
2. No VPS: `docker builder prune -f` se BuildKit corrompido.
3. Verificar disco/memória do host Docker.
