# LOG — prevenção entryPoints web/websecure

## Análise do incidente
Routers bets usavam entryPoints `web`/`websecure` (doc Traefik genérica). Env Easypanel neste VPS só cria `http`/`https`. Routers órfãos no :443 → 404 SPA; backend :30211 e yaml de service estavam corretos.

## Recursos criados/atualizados
- `scripts/infra/traefik-entrypoint-guard-vps.sh` (check/fix/run/install + timer 3min)
- Integração: `vps-traefik-autoheal.sh`, `install-vps-monitor.sh`, `vps-health-audit.sh`
- `scripts/check-traefik-entrypoint-names.sh` + `npm run check:traefik-entrypoints`
- Rules: `traefik-entrypoints-http-https.mdc` + UCP Traefik
- Doc: `doc/TRAEFIK-ENTRYPOINTS-HTTP-HTTPS.md`
- Scripts geradores alinhados (fix-bet, restore, rebuild, recover, permanent-waba, sync-v02, watchdog)
- Skill infra: árvore de decisão + timers

## Instalar no VPS (após push master)
```bash
bash /tmp/traefik-entrypoint-guard-vps.sh install  # via raw GitHub
```
