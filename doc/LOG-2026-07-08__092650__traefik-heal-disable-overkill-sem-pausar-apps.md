# LOG — 2026-07-08 09:26 — Script disable overkill heal (sem pausar apps)

## Contexto
- Usuário pediu script de desligamento do overkill Traefik, com restrição explícita: **não pausar processos/serviços** que o WABA ou o usuário usem (evitar instabilidade/lentidão ao acessar recurso).

## O que o script FAZ
Arquivo: `scripts/infra/traefik-heal-disable-overkill-vps.sh`

- `status` — lista timers/watches/cron candidatos + lê replicas de serviços (só leitura)
- `apply` (root) — `systemctl disable --now` em:
  - `traefik-permanent-*-fix.timer` (WABA, EVO, PV, bets) — polling 20s
  - `traefik-permanent-*-watch.service` — `docker events` contínuo
  - remove `/etc/cron.d/traefik-permanent-*-fix`
- Mantém: `traefik-easypanel-bootstrap.timer`, `traefik-easypanel-config-guard.service`
- Scripts em `/root` e no repo **permanecem** (restore manual após redeploy)

## O que o script NÃO FAZ (garantia)
- Não `docker service scale|pause|update --replicas 0`
- Não para/reinicia WABA, Evolution, Redis, Postgres, Traefik, Typebot, Chatwoot, n8n
- Não `docker system prune`, não restart Docker, não edita `main.yaml`/volumes
- Não desliga o próprio Traefik nem portas 80/443

## Trade-off aceito
Sem timer 20s: se Easypanel apagar Host custom, até alguém rodar `traefik-permanent-all-vps.sh run` ou `restore-landing-routers-vps.sh`, landings/domínio podem 404. Apps já roteados corretamente **não** ficam mais lentos por pausa de processo.

## Validar no VPS
```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/traefik-heal-disable-overkill-vps.sh" -o /tmp/traefik-heal-disable-overkill-vps.sh
sed -i 's/\r$//' /tmp/traefik-heal-disable-overkill-vps.sh
bash /tmp/traefik-heal-disable-overkill-vps.sh status
bash /tmp/traefik-heal-disable-overkill-vps.sh apply
curl -sS -o /dev/null -w "%{http_code}\n" --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health
```

## Palavras-chave
traefik heal disable overkill, sem pausar apps, timer 20s off, docker events off
