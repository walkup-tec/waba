# LOG — Heal permanente login pós-redeploy (502)

**Data:** 2026-07-11 22:45  
**Pedido:** Toda atualização quebra login — resolver para não repetir.

## Causa
Redeploy Easypanel `waba_waba_disparador` remove publish host `:30180` → Traefik 502 → UI «Não foi possível entrar.» (não é senha).

## Solução permanente
1. Script `scripts/heal-waba-login-vps.sh` + timer systemd `waba-login-heal.timer` (~60s)
2. Integração em `install-vps-monitor.sh` e workflow `vps-infra-heal.yml`
3. `ensure_waba_host_port` em permanent-all usa `mode=host`
4. UI: retry login em 502/503 (6x) + mensagem de recuperação pós-deploy
5. Rule `.cursor/rules/waba-login-heal-pos-redeploy.mdc`

## Install no VPS (obrigatório uma vez)

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-waba-login-vps.sh" -o /tmp/heal-waba-login-vps.sh
sed -i 's/\r$//' /tmp/heal-waba-login-vps.sh
chmod +x /tmp/heal-waba-login-vps.sh
/tmp/heal-waba-login-vps.sh install
```

## Marker
`DEPLOY-2026-07-11-login-heal-watchdog`

## Keywords
`login`, `502`, `30180`, `heal-waba-login`, `waba-login-heal.timer`, `redeploy`
