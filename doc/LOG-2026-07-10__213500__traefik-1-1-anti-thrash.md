# LOG — Traefik 1/1 estável + anti-thrash nos scripts

## Estado VPS (2026-07-11 ~00:35 UTC)
- Traefik `1/1`, :80/:443 OK após matar storm de permanent-* run
- Timers ativos: bootstrap 1min + 443-watchdog 45s + entrypoint-guard 3min
- fix.timer 20s + config-guard + watches desligados

## Causa do 0/1
Vários `traefik-permanent-*-fix.timer` (20s) + watches + config-guard + cron/min + bootstrap forçando Traefik em paralelo → Assigned/Shutdown loop.

## Fix no repo (permanent-all v6)
- `fix.timer` default OFF (opt-in `WABA_ENABLE_FIX_TIMER=1`, intervalo 15min)
- Cron `/etc/cron.d/traefik-permanent-*-fix` removido no install
- `permanent-all` pós-install chama `disable_thrash_healers`
- config-guard só com `WABA_ENABLE_CONFIG_GUARD=1`
