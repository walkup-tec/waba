# LOG — 2026-07-10 — HUP derruba Traefik (:443 000)

## Achado

Após bootstrap OK (Traefik 1/1, :443 up, backends 200), `docker kill -s HUP` no container Traefik → imediatamente `curl (7)` em :443.

Landings YAML já patchadas por `fix-landings-both`. Não precisa HUP se file provider watch estiver ativo.

## Recuperação

1. Bootstrap de novo (sem HUP)
2. Validar HTTPS com --resolve
3. Evitar HUP / restore / reconcile neste VPS até estabilizar
