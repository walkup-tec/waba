# LOG — Contingência anti-502 pós-redeploy (heal + modal)

## Por que mudou / por que o Bad Gateway voltou

Em **2026-07-21** a limpeza do Guardião desligou o `waba-login-heal` **v2** (ele escrevia Traefik). A versão **publish-only** (v4) foi criada, mas no VPS o `activate` do Guardião só **baixava** os scripts — **não rodava `install`**. Resultado: watch/timer mortos → Redeploy Easypanel derruba `:30180` → Traefik **Bad Gateway** sem auto-cura.

O modal «ATUALIZANDO O SISTEMA» só disparava com `503` + `shuttingDown`. Quando o publish some, o proxy devolve **502** sem esse sinal → usuário via texto «Bad Gateway» em vez do modal.

## Correção permanente

1. **`guardiao-sistemas-traefik-vps.sh`**: `refresh_publish_heals` chama `install` em login/pv/bets e valida watch/timer active.
2. **`heal-waba-login-vps.sh` v5**: burst mais cedo no docker event (0,3s).
3. **UI**: 502/504 (e falhas sustentadas) → `deploySignal` → modal + poll → reload quando estável.
4. **Actions** Heal Login: sleep 8s, assert units active, 3 bursts.

## Ação VPS AGORA (obrigatória)

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-waba-login-vps.sh" -o /tmp/heal-waba-login-vps.sh
sed -i 's/\r$//' /tmp/heal-waba-login-vps.sh
chmod +x /tmp/heal-waba-login-vps.sh
/tmp/heal-waba-login-vps.sh install
/tmp/heal-waba-login-vps.sh burst
systemctl is-active waba-login-heal-watch.service
systemctl is-active waba-login-heal.timer
```

Ambos devem imprimir `active`. Site: `/health` → 200.

## Palavras-chave

502, bad-gateway, waba-login-heal, guardiao install heals, deploy overlay, shuttingDown, contingencia
