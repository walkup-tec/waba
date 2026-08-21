# LOG — Auto-heal permanente instalado (paginadevendas + bets)

- **Data:** 2026-07-21 ~12:45
- **Contexto:** Redeploy do `waba_paginadevendas` derrubou o site de novo (502, publish `:30210` perdido). Usuário cobrou solução definitiva — a proteção existia no repo mas nunca tinha sido confirmada ativa no VPS, e o script do Bets nem estava no GitHub (404 no raw).

## O que foi feito

1. **Landing wabadisparos** — heal burst recuperou (`https=200` rodada 2) e `install` ativou:
   - `waba-paginadevendas-heal-watch.service` → **active**
   - `waba-paginadevendas-heal.timer` (20s) → **active**
2. **Script Bets publicado** — `scripts/heal-bets-pos-redeploy-vps.sh` commit `2959bf3` (antes ausente no remoto → curl 404). Também removido HUP do Traefik do script (File provider tem hot-reload; HUP neste VPS já derrubou `:443`): `patch_bets_backends` só edita `main.yaml` e aguarda watch.
3. **Bets instalado no VPS**:
   - `waba-bets-heal-watch.service` → **active**
   - `waba-bets-heal.timer` (20s) → **active**
   - burst OK rodada 1 (`https=200`; `health=fail` é esperado se o app não expõe `/api/health`)

## Validação final (de fora)

- `bet.waba.info` → 200
- `wabadisparos.com.br` → 200
- `waba.draxsistemas.com.br/health` → 200

## Resultado

Próximo Redeploy Easypanel de qualquer landing se recupera sozinho em ~20–60s (watch docker events + timer 20s), sem colar comando manual.

## Palavras-chave

`heal-bets`, `heal-paginadevendas`, `waba-bets-heal.timer`, `waba-paginadevendas-heal.timer`, auto-heal permanente, 502 pós-redeploy, publish 30210 30211
