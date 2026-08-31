# LOG — Landings 502 — restauração emergencial

- **Data:** 2026-07-20 ~19:46
- **Sintoma:** `bet.waba.info` + `wabadisparos.com.br` → **502** JSON Easypanel `Cannot GET /api/errors/bad-gateway`
- **Contraste:** `waba.draxsistemas.com.br/health` → **200**
- **Pedido:** restaurar ao estado de antes de hoje (como bak Traefik 19/07)

## Diagnóstico

Padrão clássico pós-redeploy Easypanel: publish host `:30210`/`:30211` perdido e/ou backend overlay. Não é 404 Traefik (router); é Bad Gateway.

## Bloqueio local

Sem chave SSH em `~/.ssh`; `gh` sem login. Correção só via console Hostinger root.

## Script

`scripts/emergency-restore-landings-502-vps.sh` — thrash OFF + publish-add + bak 19/07 (ou melhor bak) + backends `172.17.0.1` + validação. Sem force/HUP Traefik.

## Palavras-chave

`502 landings`, `bad-gateway`, `30210`, `30211`, `restore bak 20260719`, `emergency-restore-landings-502`
