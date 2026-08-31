# LOG — entrypoints HTTP/HTTPS vs websecure

## Traefik env (VPS)
- `TRAEFIK_ENTRYPOINTS_HTTP_ADDRESS=:80`
- `TRAEFIK_ENTRYPOINTS_HTTPS_ADDRESS=:443`
- File provider `/data/config` watch=true
- Docker provider exposedByDefault=false; containers sem labels traefik
- API insecure=false (API vazia esperada)
- Cert SNI bet.waba.info OK (CN=bet.waba.info)

## HTTP :80
Todos os hosts → 301 (redirect HTTPS). Não prova backend.

## Hipótese
Routers bets com `entryPoints: ["websecure"]` enquanto entrypoint real é `https` → router inativo em :443.
Doc: router só atende entrypoints que existem.
https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/

## Fix
Alinhar `http-waba_bets_pv-0` → `["http"]` e `https-waba_bets_pv-0` → `["https"]` (igual paginadevendas se for o caso). Reload.
