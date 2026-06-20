# LOG — Easypanel build processando infinito

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-docker-build-fast`

## Solicitação

Deploy `DEPLOY-2026-06-20-docker-build-retry` no Easypanel fica só **processando** e não finaliza.

## Diagnóstico

- Build local OK (~14s `npm run build`).
- `src/index.ts` ~326 KB — `tsc` no VPS com pouca RAM pode parecer travado.
- Dockerfile antigo fazia **dois** `npm ci` (builder + runner) — segundo step comum de hang silencioso.
- Build context incluía CSVs de aquecedor (~14 MB) e pasta `doc/` desnecessários.
- Produção: `GET /health` timeout 15s (serviço/Traefik possivelmente down durante deploy preso).

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `Dockerfile` | Um npm ci; prune prod; copia node_modules; echo progress; NODE_OPTIONS 1536MB |
| `.dockerignore` | doc, CSVs, agent-tools, scripts ps1/dev |
| `src/deploy-marker.ts` | Novo marker |
| `doc/FIX-EASYPANEL-DOCKER-BUILD-HANG.md` | Runbook VPS + leitura de logs |

## Próximo passo operacional

1. Push commit → redeploy Easypanel.
2. Se ainda travar: SSH VPS → `docker builder prune -af` → redeploy.
3. Validar `curl https://waba.draxsistemas.com.br/health` → marker novo.

## Pendências

- Confirmar com usuário última linha visível no log Easypanel se falhar de novo.
