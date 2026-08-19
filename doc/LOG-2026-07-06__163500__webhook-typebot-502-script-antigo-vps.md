# LOG — 2026-07-06 16:35 — Webhook Typebot 502: script antigo no VPS

## Sintoma (VPS srv1261237)
```
/root/traefik-permanent-vps.sh run
→ template parsing error (index .NetworkSettings.Networks easypanel-typebot)
→ ERRO: LP ou painel sem IP em easypanel-typebot
→ health:502 webhook:000
```

## Causa
1. `/root/traefik-permanent-vps.sh` no VPS é **versão antiga** — aborta com `ERRO` quando LP/painel não têm IP na rede `easypanel-typebot`, **antes** de corrigir o backend da API.
2. LP/painel podem estar down ou em outra rede — **não bloqueia** o fix da API se `172.17.0.1:3333/health` responder 200.
3. Scripts corrigidos existem em `D:\typebot-Saas\scripts\` mas **ainda não estão no GitHub/VPS**.

## Correção imediata (colar no VPS como root)

### 1) API responde localmente?
```bash
curl -sS -o /dev/null -w "local:%{http_code}\n" http://127.0.0.1:3333/health
curl -sS -o /dev/null -w "gw:%{http_code}\n" http://172.17.0.1:3333/health
docker ps -f name=typebot_api --format '{{.Names}} {{.Status}}'
```

Se ambos ≠ 200:
```bash
/root/force-api-swarm-rollout-vps.sh auto
sleep 10
curl -sS http://172.17.0.1:3333/health
```

### 2) Patch Traefik só API (não depende de LP/painel)
```bash
CFG=/etc/easypanel/traefik/config/main.yaml
cp -a "$CFG" "${CFG}.bak-asaas-$(date +%Y%m%d-%H%M%S)"
python3 -c "
import re
p='$CFG'
t=open(p).read()
t2=re.sub(r'http://typebot_api[^\"]*','http://172.17.0.1:3333',t)
t2=re.sub(r'http://tasks\.typebot_api[^\"]*','http://172.17.0.1:3333',t2)
open(p,'w').write(t2)
print('patched' if t2!=t else 'already ok')
"
docker kill -s HUP $(docker ps -q -f name=easypanel-traefik) 2>/dev/null || \
  docker restart $(docker ps -q -f name=easypanel-traefik)
sleep 3
```

### 3) Validar
```bash
curl -sS -o /dev/null -w "health:%{http_code}\n" https://app.chattypebot.com/health
curl -sS -o /dev/null -w "webhook:%{http_code}\n" -X POST \
  https://app.chattypebot.com/api/webhooks/asaas \
  -H "Content-Type: application/json" -d '{}'
```
Esperado: `health:200` e `webhook:200` ou `webhook:401`.

### 4) Atualizar script permanente (após push no repo typeBot)
```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/typeBot/master/scripts/traefik-permanent-vps.sh" \
  -o /root/traefik-permanent-vps.sh
sed -i 's/\r$//' /root/traefik-permanent-vps.sh
chmod +x /root/traefik-permanent-vps.sh
```

Ou script all-in-one:
```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/typeBot/master/scripts/fix-typebot-asaas-webhook-vps.sh" \
  -o /tmp/fix-typebot-asaas-webhook.sh
sed -i 's/\r$//' /tmp/fix-typebot-asaas-webhook.sh
chmod +x /tmp/fix-typebot-asaas-webhook.sh
/tmp/fix-typebot-asaas-webhook.sh
```

## Alterações locais (typebot-Saas, não no VPS ainda)
- `traefik-permanent-vps.sh`: patch parcial API-only; `container_ip` sem nil pointer; LP/painel opcional
- `fix-typebot-asaas-webhook-vps.sh`: `patch_api_traefik_emergency()` antes do traefik-permanent

## Após endpoint OK
1. Easypanel → typebot → api → `ASAAS_WEBHOOK_ACCESS_TOKEN` = token webhook typebot no Asaas → redeploy
2. Asaas → Integrações → Webhooks → **typebot** → Reativar fila

## Pendência
- Push dos scripts para `walkup-tec/typeBot` (master) para curl funcionar sem cópia manual
