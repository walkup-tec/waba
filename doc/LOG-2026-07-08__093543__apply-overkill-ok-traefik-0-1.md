# LOG — 2026-07-08 09:35 — Apply overkill off OK; Traefik 0/1 visto no status

## Contexto
Usuário rodou no VPS `traefik-heal-disable-overkill-vps.sh` status + apply.

## Resultado apply
- 8 units permanent (timers + watches) → **inactive**
- 4 crons permanent → **removidos**
- bootstrap.timer + config-guard → **mantidos active**
- Serviços de negócio listados **1/1** (WABA, Evolution, landings, DBs, Redis)
- `curl` WABA health via `--resolve ...127.0.0.1` → **200**

## Alerta
Na mesma saída: `easypanel-traefik` → **0/1**. Isso NÃO foi causado pelo disable-overkill (script não toca Swarm). Possíveis causas: update Pending, bootstrap já tentando recover, proxy zumbi :80/:443.

Load ~11–12 em 4 vCPU + Traefik 0/1 = prioridade: estabilizar Traefik com bootstrap (sem pausar apps WABA).

## Próximo (usuário no VPS)
```bash
docker service ls --filter name=easypanel-traefik
/root/traefik-easypanel-bootstrap-vps.sh status
ss -tlnp | grep -E ':80 |:443 '
/root/traefik-easypanel-bootstrap-vps.sh run
docker service ls --filter name=easypanel-traefik
curl -sS -o /dev/null -w "%{http_code}\n" --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health
```

## Palavras-chave
heal overkill apply ok, traefik 0/1, bootstrap, load 12
