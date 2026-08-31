# LOG — JSON Cannot GET /api/errors/bad-gateway = 502 paginadevendas pós-redeploy

## O que é
Não é bug do formulário. Easypanel mostra tela de Bad Gateway e tenta GET `/api/errors/bad-gateway` → JSON 404.

Probe: wabadisparos + host EP = **502**; WABA/bet = 200.

## Heal
`scripts/heal-paginadevendas-pos-redeploy-vps.sh` → publish :30210 + fix-landings-both.

## Keywords
bad-gateway, api/errors, paginadevendas 502, pós-redeploy
