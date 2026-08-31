# LOG — 502 por restore-easypanel overlay DNS + HUP

## Causa
1. `restore-landing` colocou `172.17.0.1:30210` → disparos **200**
2. `restore-easypanel-traefik-backends` v1 reverteu para `http://waba_paginadevendas:3000/` → **502**
3. HUP derrubou Traefik → tudo **000**

Apps locais `:30180`/`:30210` estavam **200** o tempo todo.

## Fix repo
- backends v2: host gateway + sem HUP
- landing v9: file watch default (sem HUP)

## Heal VPS imediato
Bootstrap + curl raw scripts novos OU python inline 172.17.0.1 — **não** rodar backends v1 antigo.
