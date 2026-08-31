# LOG — 2026-07-07 19:25 — Fix definitivo Traefik landings (bet + wabadisparos)

## Solicitação
- Segunda ocorrência de `bet.waba.info` e `wabadisparos.com.br` fora do ar (404 / timeout / flapping).
- Resolver de forma definitiva — não pode cair a todo instante.

## Diagnóstico
- DNS OK → `72.60.51.127` (srv1261237).
- `bet.waba.info` → 404 Easypanel padrão ou timeout; `wabadisparos.com.br` → idem.
- Sondagem 8×: alternância `200` ↔ `000` (flapping severo).
- Backends Easypanel: `waba-paginadevendas.achpyp.easypanel.host` → 200; `waba-bets-pv` → 500 intermitente.
- `waba.draxsistemas.com.br/health` → 200 (app principal OK).
- **Causa raiz:** routers Traefik dos domínios custom somem após redeploy Easypanel; scripts `traefik-permanent-paginadevendas` e `bets-pv` existiam no repo mas **não estavam instalados no VPS** (sem timers/watch).
- SSH desta máquina: `Permission denied (publickey)` — sem chave privada em `~/.ssh`.

## Solução implementada (repo)
1. **`scripts/infra/bootstrap-vps-definitivo.sh`** — um comando instala Traefik ALL + monitor + auto-heal.
2. **`scripts/infra/vps-traefik-autoheal.sh`** — checa 3 hosts; se falhar executa `traefik-permanent-all-vps.sh run`.
3. **`install-vps-monitor.sh` v2** — instala Traefik permanent ALL + timer auto-heal **2 min**.
4. **`vps-health-audit.sh` v2** — audita landings + dispara auto-heal em falha.
5. **`traefik-permanent-all-vps.sh` v4** — versão bump.
6. **`.github/workflows/vps-infra-heal.yml`** — heal via SSH a cada 5 min (secret `VPS_SSH_PRIVATE_KEY`).
7. **`doc/FIX-TRAEFIK-DEFINITIVO.md`** — landings + bootstrap documentados.

## Aplicar no VPS (OBRIGATÓRIO — uma vez)
```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/bootstrap-vps-definitivo.sh" | bash
```

## GitHub Actions (recomendado)
Secrets: `VPS_SSH_PRIVATE_KEY`, opcional `VPS_HOST=72.60.51.127`.

## Validação
```bash
/root/traefik-permanent-all-vps.sh status
/root/waba-infra/vps-traefik-autoheal.sh check
for i in 1 2 3 4 5; do curl -sS -o /dev/null -w "%{http_code}\n" https://bet.waba.info/; sleep 2; done
```

## Pendências
- Push em `origin/master` para URL raw do bootstrap.
- Executar bootstrap no VPS (Hostinger Browser SSH) se secret GitHub ainda não configurado.

## Palavras-chave
traefik permanent, autoheal, bootstrap definitivo, bet.waba.info, wabadisparos, flapping, easypanel router, vps-infra-heal
