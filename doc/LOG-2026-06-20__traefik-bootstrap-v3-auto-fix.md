# LOG — Traefik bootstrap v3 (auto-fix porta 80 zumbi)

**Data:** 2026-06-20

## Objetivo

Evitar recorrência do incidente easypanel-traefik 0/1 (docker-proxy zumbi na :80).

## Novo módulo

`scripts/traefik-easypanel-bootstrap-vps.sh` (`traefik-bootstrap-2026-06-20-v1`)

- Libera porta 80 se docker-proxy sem Traefik running
- Remove containers easypanel-traefik stale
- Rollback update Swarm pausado + force service
- Valida :80 e :443 escutando

## Integrações

| Script | Versão |
|--------|--------|
| traefik-permanent-all-vps.sh | v3 |
| traefik-permanent-waba-vps.sh | v6 |
| traefik-permanent-walkup-evo-vps.sh | v3 |
| traefik-easypanel-config-guard.sh | v2 |
| typebot traefik-permanent-vps.sh | bootstrap no run_fix |
| systemd timer | traefik-easypanel-bootstrap.timer (2 min) |

## VPS — aplicar

```bash
/root/traefik-permanent-all-vps.sh install
# ou copiar do repo waba master e install
```

Validar: `/root/traefik-easypanel-bootstrap-vps.sh status`
