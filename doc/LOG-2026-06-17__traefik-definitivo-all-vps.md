# LOG — Traefik definitivo WABA + Evolution

**Data:** 2026-06-17

## Pedido

Resolver em definitivo 404/502 Traefik após redeploy Easypanel (instâncias Evolution, WABA).

## Causa raiz

Easypanel regenera `main.yaml` com upstream Swarm inalcançável ou remove routers. Fixes manuais não persistiam.

## Solução

1. **`traefik-permanent-all-vps.sh`** — install único: WABA + EVO + restores + guarda
2. **`traefik-easypanel-config-guard.sh`** — inotify em `main.yaml` → `run` automático
3. **v2 evo / v5 waba** — auto-restore router do backup/golden; eventos traefik/easypanel

## VPS (uma vez)

```bash
/root/traefik-permanent-all-vps.sh install
```

## Arquivos

- `scripts/traefik-permanent-all-vps.sh`
- `scripts/traefik-easypanel-config-guard.sh`
- `scripts/traefik-permanent-walkup-evo-vps.sh` (v2)
- `scripts/traefik-permanent-waba-vps.sh` (v5)
- `doc/FIX-TRAEFIK-DEFINITIVO.md`

## Pendência

Executar `install` no VPS de produção (SSH root).
