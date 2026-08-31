# Traefik entryPoints neste VPS (prevenção)

## O que aconteceu (2026-07-10)

| Sintoma | Observação |
|---------|------------|
| `bet.waba.info` → 404 SPA DRAX/Disparos | Mesmo HTML de path inexistente em wabadisparos |
| `:30211` local → 200 landing Bets | Backend OK |
| `main.yaml` service → `172.17.0.1:30211/` | Disco/container OK |
| `wabadisparos.com.br` → 200 | Outro router no mesmo arquivo |

**Causa raiz:** routers `waba_bets_pv` com `entryPoints: ["web"]` / `["websecure"]`.  
Neste VPS o Traefik só define **`http`** e **`https`** (variáveis de ambiente). Routers em `websecure` ficam **órfãos** no `:443`.

Disparos já usava `http`/`https` → por isso só o bet quebrava.

File provider `watch=true` aplicou a correção em ~8s **sem** `force`/HUP.

## Prevenção instalada no repo

| Recurso | Função |
|---------|--------|
| `scripts/infra/traefik-entrypoint-guard-vps.sh` | **v2:** detecta + corrige `web`/`websecure` → `http`/`https`; se bet=502 e `:30211`=200, força URL `http://172.17.0.1:30211/`; probe Bets; timer 3 min |
| `scripts/infra/vps-traefik-autoheal.sh` | Chama o guard antes/depois do heal |
| `scripts/infra/install-vps-monitor.sh` | Instala o timer do guard junto com o monitor |
| `scripts/infra/vps-health-audit.sh` | Issue `traefik_entrypoint_web_or_websecure` + dispara guard |
| `scripts/check-traefik-entrypoint-names.sh` | CI/local: falha se scripts geradores voltarem a emitir `websecure` |
| `npm run check:traefik-entrypoints` | Atalho do check acima |
| `.cursor/rules/traefik-entrypoints-http-https.mdc` | Rule alwaysApply para agentes |
| `.cursor/rules/ucp-traefik-static-dynamic.mdc` | Atualizado com a mesma regra |

Scripts geradores de routers (restore/fix-bet/rebuild/…) alinhados para `http`/`https`.

## Contingência v2 (2026-07-10)

Além de entryPoints, o guard **auto-corrige backend**:

1. Probe HTTPS `bet.waba.info`
2. Se **502/503/504** e `http://127.0.0.1:30211/` = 200 → patch services `waba_bets_*` / `waba_bets_landing_fix` para `http://172.17.0.1:30211/`
3. Aguarda file provider watch (~10s), re-probe
4. Se `:30211` local DOWN → só log (precisa redeploy Easypanel)

Comando: `fix-backend` ou `run` (heal completo).

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/traefik-entrypoint-guard-vps.sh" \
  -o /tmp/traefik-entrypoint-guard-vps.sh
sed -i 's/\r$//' /tmp/traefik-entrypoint-guard-vps.sh
chmod +x /tmp/traefik-entrypoint-guard-vps.sh
bash /tmp/traefik-entrypoint-guard-vps.sh install
bash /tmp/traefik-entrypoint-guard-vps.sh status
```

Ou reinstalar o monitor completo:

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/install-vps-monitor.sh" \
  -o /tmp/install-vps-monitor.sh
sed -i 's/\r$//' /tmp/install-vps-monitor.sh
bash /tmp/install-vps-monitor.sh install
```

Logs: `/var/log/waba-traefik-entrypoint-guard.log`

## Doc oficial

- Entrypoints: https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/
- Routers: https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
- File provider watch: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
