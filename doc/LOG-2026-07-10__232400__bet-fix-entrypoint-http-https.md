# LOG — bet.waba.info 200: entryPoints web/websecure → http/https

## Causa raiz
Neste VPS o Traefik Easypanel define:
- `TRAEFIK_ENTRYPOINTS_HTTP_ADDRESS=:80` → nome **`http`**
- `TRAEFIK_ENTRYPOINTS_HTTPS_ADDRESS=:443` → nome **`https`**

Routers `waba_paginadevendas` já usavam `http`/`https`.
Routers `waba_bets_pv` estavam com **`web`/`websecure`** (não existem) → router HTTPS inativo → tráfego/cert sem rota útil → SPA 404 de outro app.

## Fix aplicado (VPS, 2026-07-10)
- `http-waba_bets_pv-0` entryPoints → `["http"]`
- `https-waba_bets_pv-0` entryPoints → `["https"]`
- File provider `watch=true` aplicou em ~8s **sem** force/HUP

## Validação
- local-bet: **200** + `class="dark"` (Bets)
- easypanel-bets: **200**
- pub-bet: **200**
- pub-disparos: **200**
- :443 LISTEN OK

## Doc oficial
- Entrypoints: https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/
- Routers entryPoints: https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
- File watch: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/

## Lição permanente
Neste VPS **nunca** usar `web`/`websecure` no `main.yaml` Easypanel — só `http`/`https`.
