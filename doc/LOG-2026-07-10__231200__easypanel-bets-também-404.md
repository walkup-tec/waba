# LOG — easypanel-bets host também 404 SPA disparos

## Evidência (2026-07-10)
- Router `https-waba_bets_pv-0` OK no disco: entryPoints websecure, Host easypanel+bet, service waba_bets_pv-0, url disco 30211
- Labels Traefik nos services Swarm: **nenhuma**
- `https://waba-bets-pv.achpyp.easypanel.host/` via Traefik → **404 SPA paginadevendas** (mesmo body de bet)
- Direto `:30211` e wget do container Traefik → landing Bets OK
- Priority 99999 + force: sem efeito; disparos continua 200

## Interpretação
Config em memória ≠ router file efetivo, OU nome de service `waba_bets_pv-0` colide/resolve errado. File provider watch/HUP problemático neste VPS.

## Próximo fix
Criar service com nome único `waba_bets_landing_fix` → `http://172.17.0.1:30211/`, apontar routers http/https-bets para ele, force Traefik, validar easypanel-bets + bet.
