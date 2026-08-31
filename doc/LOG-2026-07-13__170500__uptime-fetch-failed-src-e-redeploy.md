# LOG — Uptime Fetch failed (src sync + redeploy pendente)

**Data:** 2026-07-13 ~17:05  
**Pedido:** Monitor aponta sistemas fora do ar com Fetch failed nos três links — corrigir.

## Diagnóstico

| Checagem | Resultado |
|----------|-----------|
| HTTPS público bet / disparos / waba / drax | **200** (sites no ar) |
| Prod `/health` `deployMarker` | `DEPLOY-2026-07-11-logs-sistema-ui-dark` (código antigo) |
| Git `master` | já tinha probe local em `dist/` (`94c939d`) mas **sem** sync em `src/` |

**Causa:** probe do uptime roda **dentro do container** Swarm e chama URL pública → hairpin/TLS → `TypeError: fetch failed` (falso negativo). Produção ainda não redeployou o fix.

## Correção (esta sessão)

1. Portou probe local para `src/monitoring/uptime-monitor.service.ts` (antes só estava no `dist/`).
2. Fallbacks:
   - bet → `http://172.17.0.1:30211/`
   - disparos → `http://172.17.0.1:30210/`
   - waba → `http://172.17.0.1:30180/health`
   - drax / só-público: se HTTPS falhar por rede → Traefik `:80` com `Host` (node:http)
3. Marker: `DEPLOY-2026-07-13-uptime-local-probe-src`

## Validar após Redeploy Easypanel

```bash
curl -sS https://waba.draxsistemas.com.br/health | jq .deployMarker
# esperado: DEPLOY-2026-07-13-uptime-local-probe-src
```

Luzes do Monitor devem ir a verde no próximo tick (~5 min) ou refresh fresh.

## Doc oficial usada

- Traefik Host rules: https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/
- Conceito: routing/dynamic vs hairpin do container para o próprio host.

## Keywords

`uptime`, `fetch failed`, `hairpin`, `172.17.0.1`, `30210`, `30211`, `30180`, `Host header`
