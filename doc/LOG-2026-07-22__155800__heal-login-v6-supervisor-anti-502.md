# LOG — Heal login v6 supervisor anti-502 permanente

**Data:** 2026-07-22 15:58  
**Versão:** `heal-waba-login-2026-07-22-v6-supervisor-anti-502`

## Por que o 502 voltou «com contingência»

A contingência v5 (watch+timer) **existe**, mas falhava em cenários reais:

1. Easypanel remove o publish **depois** do 1º `burst` (corrida).
2. `flock -n` fazia o 2º burst **pular** se o 1º ainda rodava.
3. Se watch/timer eram desativados (limpeza Guardião / reboot parcial), **ninguém os religava**.

«Estar active ou falhar» não é aceitável — precisa **auto-revive**.

## v6 — o que mudou

| Camada | Mudança |
|--------|---------|
| Watch | Bursts escalonados: 0.3s, 8s, 25s, 60s, 120s após evento |
| Lock | `flock -w 120` (espera, não skip) |
| Timer | ~8s |
| **Supervisor** | timer ~20s: revive unidades mortas + burst se HTTPS≠200 |
| Actions | Assert supervisor; bursts em 0/8/20/40s |
| Guardião | Assert `waba-login-heal-supervisor.timer` após install heals |

## Install no VPS (obrigatório uma vez / após push master o Actions faz)

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-waba-login-vps.sh" \
  -o /tmp/heal-waba-login-vps.sh
sed -i 's/\r$//' /tmp/heal-waba-login-vps.sh
chmod +x /tmp/heal-waba-login-vps.sh
/tmp/heal-waba-login-vps.sh install
systemctl is-active waba-login-heal-watch.service \
  waba-login-heal.timer waba-login-heal-supervisor.timer
```

## Arquivos

- `scripts/heal-waba-login-vps.sh`
- `scripts/guardiao-sistemas-traefik-vps.sh`
- `.github/workflows/heal-waba-login-on-deploy.yml`
- `.cursor/rules/waba-login-heal-pos-redeploy.mdc`

## Palavras-chave

502, supervisor, v6, waba-login-heal, bursts escalonados, anti-queda, publish 30180
