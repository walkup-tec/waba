# LOG — Docker prebuilt dist (fim do tsc no VPS)

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-docker-prebuilt-dist`

## Sintoma

Deploy Easypanel continua **processando** por muito tempo mesmo após otimização `docker-build-fast`.  
Produção: `waba.draxsistemas.com.br/health` **timeout** (serviço fora ou rede/VPS).

## Causa raiz (build)

`npm run build` dentro do Docker executa **tsc** em `src/index.ts` (~320 KB). Em VPS com pouca RAM isso não falha com erro claro — fica em swap por 30–60+ minutos ou nunca termina.

## Solução

Dockerfile **single-stage runtime**:

- Copia `dist/` já compilado do repositório (build local/CI antes do push).
- Só roda `npm ci --omit=dev` (~1–3 min no VPS).
- `.dockerignore` exclui `src/`, `index.html`, scripts de build — contexto mínimo.

## Causa provável (site fora)

Timeout total (não 502) sugere também:

- Deploy Swarm preso / container não sobe
- VPS ou Traefik inacessível
- Necessário SSH: `docker builder prune -af`, `docker service ps waba_waba_disparador`, Traefik (`doc/FIX-TRAEFIK-WABA.md`)

## Validar

```bash
curl -sS https://waba.draxsistemas.com.br/health
# deployMarker: DEPLOY-2026-06-20-docker-prebuilt-dist
```

Build Easypanel deve mostrar só:

```
>>> npm ci --omit=dev
>>> npm ci OK
```

Sem step `npm run build`.
