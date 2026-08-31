# LOG — Traefik 0/1 pós permanent-all (thrash)

## Sintoma (2026-07-11 ~00:25 UTC)
- `easypanel-traefik 0/1`; ss sem :80/:443; HTTPS bet/disparos/waba = 000
- Bootstrap reporta OK e minutos depois cai de novo
- Guard + watchdog + bootstrap + permanent-* fix 20s competindo com `force`

## Hipótese
Thrash: vários timers forçam Traefik em paralelo; porta :80/:443 presa por docker-proxy zumbi OU task Failed/Rejected.

## Ação pedida ao usuário
1. Pausar timers que force
2. `docker service ps easypanel-traefik --no-trunc`
3. Bootstrap único + validar 1/1
4. Religar timers
