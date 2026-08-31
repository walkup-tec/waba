# LOG — mitigação completa Traefik down

## Pedido
Fazer tudo que ajudar: cache cliente, Always Online, recuperação rápida, alertas.

## Entregue
1. `scripts/infra/traefik-443-watchdog-vps.sh` — timer **45s**, bootstrap se :443/Traefik down + guard + webhook opcional
2. Autoheal v3 — bootstrap prioritário se :443 ausente; http_code sem 000000
3. Entrypoint guard — se bet+disparos=000, chama bootstrap
4. Bootstrap timer permanent-all: **1 min** (era 2)
5. Uptime monitor default: **5 min** / realert 30 (era 15/60) → WhatsApp mais cedo
6. `doc/CLOUDFLARE-ALWAYS-ONLINE-LANDINGS.md` — checklist edge
7. `public-pages/sw.js` + register em bets/vendas (cobertura parcial; landings React produção precisam SW no app delas)

## Instalar VPS
```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/traefik-443-watchdog-vps.sh" -o /tmp/w443.sh
sed -i 's/\r$//' /tmp/w443.sh && bash /tmp/w443.sh install
# Cloudflare: seguir doc/CLOUDFLARE-ALWAYS-ONLINE-LANDINGS.md
# Produção: WABA_UPTIME_MONITOR_INTERVAL_MINUTES=5 (já default no código após deploy app)
```
