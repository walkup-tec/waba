# LOG — 2026-07-06 16:53 — app.chattypebot.com porta 443 down (000)

## Sintoma
```
curl https://app.chattypebot.com/health → curl: (7) Failed to connect port 443
health:000 webhook:000
```

## Diferença do 502 anterior
- **502** = Traefik vivo, upstream (API) morto
- **000 / curl (7)** = **nada escutando na 443** (Traefik down, crash, ou Swarm 0/1)

## Diagnóstico (VPS root)
```bash
ss -tlnp | grep -E ':80|:443'
docker ps -f name=easypanel-traefik --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker service ls --filter name=easypanel-traefik
docker service ps easypanel-traefik --no-trunc | head -8
getent hosts app.chattypebot.com
curl -sS -o /dev/null -w "local443:%{http_code}\n" --resolve app.chattypebot.com:443:127.0.0.1 \
  https://app.chattypebot.com/health
```

## Recuperação (ordem)

### 1) Bootstrap Traefik (se instalado)
```bash
/root/traefik-easypanel-bootstrap-vps.sh status
/root/traefik-easypanel-bootstrap-vps.sh run
```

### 2) Force Swarm Traefik
```bash
docker service update --update-failure-action continue --force easypanel-traefik
sleep 15
ss -tlnp | grep -E ':80|:443'
```

### 3) Se update pausado
```bash
docker service inspect easypanel-traefik --format '{{.UpdateStatus.State}}'
docker service update --rollback easypanel-traefik
sleep 10
docker service update --force easypanel-traefik
```

### 4) Porta 443 com docker-proxy zumbi (sem Traefik)
```bash
ss -tlnp | grep ':443 '
# se docker-proxy sem container traefik:
docker ps -a -f name=easypanel-traefik -q | xargs -r docker rm -f
docker service update --force easypanel-traefik
```

### 5) Quando 443 voltar — patch API + validar webhook
```bash
CFG=/etc/easypanel/traefik/config/main.yaml
python3 -c "
import re
p='$CFG'
t=open(p).read()
t2=re.sub(r'http://typebot_api[^\"]*','http://172.17.0.1:3333',t)
open(p,'w').write(t2)
"
docker kill -s HUP $(docker ps -q -f name=easypanel-traefik)
curl -sS -o /dev/null -w "health:%{http_code}\n" --resolve app.chattypebot.com:443:127.0.0.1 \
  https://app.chattypebot.com/health
```

## Pendência
- Colar saída de `status` + `docker service ps easypanel-traefik` se bootstrap não subir :443
