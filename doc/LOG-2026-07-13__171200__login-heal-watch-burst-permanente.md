# LOG — Login heal v2 permanente (watch + burst + Actions)

**Data:** 2026-07-13 ~17:12  
**Pedido:** login pós-deploy não pode mais falhar (Not Found / 502 recorrente).

## Causa raiz
Redeploy Easypanel do `waba_waba_disparador` remove publish host `:30180` e/ou backend Traefik deixa de ser `http://172.17.0.1:30180/` → HTTPS 502/404. Timer de 60s sozinho era lento demais / às vezes não instalado.

## Precauções (3 camadas)

1. **Watch** `waba-login-heal-watch.service` — `docker events` no serviço → `burst` imediato  
2. **Timer** `waba-login-heal.timer` — a cada **20s**  
3. **GitHub Actions** `Heal WABA Login (pós-deploy)` — push `master` → SSH `install` + `burst` até `/health` 200  

UI: retry login em 502/503/**404**/HTML Not Found (até 10x) + mensagem clara «não é a senha».

Marker: `DEPLOY-2026-07-13-login-heal-watch-v2`

## Install obrigatório no VPS (uma vez)

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-waba-login-vps.sh" -o /tmp/heal-waba-login-vps.sh
sed -i 's/\r$//' /tmp/heal-waba-login-vps.sh && chmod +x /tmp/heal-waba-login-vps.sh
/tmp/heal-waba-login-vps.sh install
systemctl is-active waba-login-heal-watch.service
```

Secret GitHub: `VPS_SSH_PRIVATE_KEY` (necessário para o workflow).

## Doc Traefik
Backends = routing dinâmica; sem HUP.  
https://doc.traefik.io/traefik/getting-started/configuration-overview/

## Keywords
`login`, `30180`, `heal-waba-login`, `watch`, `burst`, `Not Found`, `502`, `pós-redeploy`
