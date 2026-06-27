# LOG — Traefik CPU: access log off + dashboard/API secure (produção)

## Contexto

CPU Traefik ~39,75% com envs Easypanel:
- `TRAEFIK_ACCESSLOG=true`
- `TRAEFIK_API_DASHBOARD=true`
- `TRAEFIK_API_INSECURE=true`

Plano por etapas com snapshot hPanel (expira 2026-06-28).

## Ações (srv1261237)

```bash
docker service update \
  --env-rm TRAEFIK_ACCESSLOG TRAEFIK_API_DASHBOARD TRAEFIK_API_INSECURE \
  --env-add TRAEFIK_ACCESSLOG=false \
  --env-add TRAEFIK_API_DASHBOARD=false \
  --env-add TRAEFIK_API_INSECURE=false \
  easypanel-traefik
```

Criado `/etc/easypanel/traefik/config/custom.yaml` (accessLog false, log ERROR, api dashboard/insecure false).

## Resultado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Traefik CPU | 39,75% | 4,88% → 0,00% (pós force reload) |
| WABA /health local | 200 | 200 |
| HTTPS waba.draxsistemas.com.br | 200 | 200 |

## Riscos / retomada

- **Easypanel update** pode recriar Traefik com envs antigas (`ACCESSLOG=true`). Reaplicar `docker service update` ou conferir envs.
- Scripts WABA `traefik-permanent-all-vps.sh` **mantidos** — não desligar.
- Sem access log: debug de roteamento via `docker service logs easypanel-traefik` (nível ERROR).

## Validar depois

```bash
docker stats --no-stream | grep -i traefik
docker service inspect easypanel-traefik --format '...' | grep ACCESSLOG
curl -sS -o /dev/null -w "%{http_code}\n" --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health
```

Palavras-chave: `traefik-cpu`, `TRAEFIK_ACCESSLOG=false`, `custom.yaml`, `39.75%`, `srv1261237`
