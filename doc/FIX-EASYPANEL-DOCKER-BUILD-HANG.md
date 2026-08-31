# Easypanel — build WABA fica "processando" e não termina

## Solução atual (2026-06-20)

O Dockerfile **não compila mais TypeScript no VPS**. O `dist/` vai no Git; no Easypanel só roda `npm ci --omit=dev` (1–3 min).

Antes de cada deploy: `npm run build` + commit `dist/` + `src/deploy-marker.ts`.

Marker esperado: `DEPLOY-2026-06-20-docker-prebuilt-dist`.

## Sintomas

- Deploy no Easypanel (`waba_disparador`) fica **Processando** por 10–30+ minutos sem sucesso nem erro claro.
- Ou build para em step silencioso (`npm ci`, `npm run build`, `exporting to image`).
- `https://waba.draxsistemas.com.br/health` timeout ou marker antigo.

## Causas comuns (ordem)

1. **`tsc` com pouca RAM** — `src/index.ts` é grande (~320 KB); Alpine + 512 MB RAM → swap infinito (parece travado em `npm run build`).
2. **Segundo `npm ci` no runner** — rede lenta/instável no VPS; step sem log por vários minutos.
3. **BuildKit cache corrompido** — hang em `exporting to image` / snapshot (mesmo padrão do Typebot).
4. **Disco cheio** — `docker system df` perto de 100%.
5. **Deploy anterior preso** — Swarm aguardando health de réplica que não sobe.

## Correção no código (commit `DEPLOY-2026-06-20-docker-build-fast`)

- Dockerfile: **um** `npm ci` + `npm prune --omit=dev`; runner copia `node_modules` do builder (sem segundo `npm ci`).
- `NODE_OPTIONS=--max-old-space-size=1536` durante `npm run build`.
- Echo em cada RUN para o log Easypanel mostrar em qual step parou.
- `.dockerignore`: exclui `doc/`, CSVs de aquecedor (~14 MB), scripts locais.

## Correção no VPS (root SSH)

```bash
docker builder prune -af
docker buildx prune -af
df -h /
docker system df
```

Se persistir:

```bash
systemctl restart docker
sleep 30
```

No Easypanel: **Cancelar** deploy preso (se houver) → **Redeploy** do serviço `waba_disparador`.

## Ler o log do build

| Última linha visível | Ação |
|----------------------|------|
| `>>> [builder] npm ci` | Rede/npm registry ou disco |
| `>>> [builder] npm run build` | RAM insuficiente — subir memória do serviço build ou VPS |
| `exporting to image` / snapshot | `docker builder prune -af` |
| Build OK mas serviço não sobe | Logs runtime + volume `/app/data` + env |

## Validar pós-deploy

```bash
curl -sS https://waba.draxsistemas.com.br/health
```

Esperado: `"deployMarker":"DEPLOY-2026-06-20-docker-build-fast"`.

## Traefik 404/timeout após deploy

Ver `doc/FIX-TRAEFIK-WABA.md` — router pode sumir após redeploy Easypanel.
