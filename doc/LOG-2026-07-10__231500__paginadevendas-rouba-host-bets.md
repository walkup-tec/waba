# LOG — paginadevendas rouba Host bets + :443 caiu

## Achados
1. Diagnóstico `hosts bets no yaml`: **`https-waba_paginadevendas-0`** aparece junto com routers bets → rule do paginadevendas contém `bet.waba.info` e/ou `waba-bets-pv.achpyp.easypanel.host`.
2. Por isso easypanel-bets e bet.waba.info devolvem SPA disparos (404), mesmo com service `waba_bets_landing_fix` → 30211.
3. Após force, curls → `SSL_ERROR_SYSCALL` / `pub-*:000` — Traefik `:443` caiu de novo (body HTML no output provavelmente residual de `/tmp/bets-body.html`).

## Fix
1. Bootstrap Traefik
2. Remover Hosts bets do router `*paginadevendas*`
3. Manter `waba_bets_landing_fix` → 30211 nos routers bets
4. Validar sem HUP desnecessário
