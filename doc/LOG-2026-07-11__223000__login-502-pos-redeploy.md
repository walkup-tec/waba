# LOG — Login «Não foi possível entrar» = HTTPS 502 pós-redeploy

**Data:** 2026-07-11 22:30  
**Sintoma:** Tela Acesso WABA → «Não foi possível entrar.» (email master ok).  
**Diagnóstico externo:** `https://waba.draxsistemas.com.br/health` → **HTTP 502 Bad Gateway** (via DNS e via `--resolve …:72.60.51.127`). Não é senha.

## Causa típica
Redeploy Easypanel `waba_waba_disparador` perde publish host `:30180→80` e/ou backend Traefik deixa de apontar para `http://172.17.0.1:30180/`.

## Bloqueio desta máquina
Sem chave SSH local (`~/.ssh` só known_hosts); `gh` sem auth. Correção = Hostinger console / root@srv1261237.

## Fix (colar no VPS como root)

```bash
docker service ls | grep -E 'traefik|waba_disparador'
ss -tlnp | grep -E ':443|:30180' || true
curl -sS --max-time 8 http://127.0.0.1:30180/health || echo "30180_DOWN"

# Republicar porta se 30180 fechada / health falhou
docker service update --publish-rm 30180 waba_waba_disparador 2>/dev/null || true
docker service update --publish-add published=30180,target=80,mode=host waba_waba_disparador
sleep 8
curl -sS --max-time 10 http://127.0.0.1:30180/health

# Backends Traefik (host gateway; SEM HUP)
bash /root/restore-easypanel-traefik-backends-vps.sh || \
  curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/restore-easypanel-traefik-backends-vps.sh" \
    -o /tmp/restore-ep-backends.sh && sed -i 's/\r$//' /tmp/restore-ep-backends.sh && bash /tmp/restore-ep-backends.sh

sleep 3
curl -sS -o /dev/null -w "https:%{http_code}\n" --max-time 12 \
  --resolve waba.draxsistemas.com.br:443:127.0.0.1 \
  https://waba.draxsistemas.com.br/health
curl -sS --max-time 12 --resolve waba.draxsistemas.com.br:443:127.0.0.1 \
  https://waba.draxsistemas.com.br/health | head -c 400
```

Esperado: local e HTTPS **200** com marker `DEPLOY-2026-07-11-logs-dentro-monitor-cpu`.

## Keywords
`502`, `login`, `Não foi possível entrar`, `30180`, `redeploy`, `waba_disparador`
