# LOG — Marker paginadevendas para redeploy cadastro

## Marker
`DEPLOY-2026-07-14-paginadevendas-cadastro-form`

Repo: `walkup-tec/pv-waba-disparador` (serviço Easypanel `waba_paginadevendas`)

## Como validar após Redeploy
```bash
curl -sS https://wabadisparos.com.br/api/health
# esperado: "deployMarker":"DEPLOY-2026-07-14-paginadevendas-cadastro-form"

curl -sS https://wabadisparos.com.br/ | findstr /i "waba-deploy-marker Crie sua conta em minutos Comece Hoje"
```

Também em meta HTML: `name="waba-deploy-marker"` e `data-deploy-marker` na `#cadastro`.

## Keywords
paginadevendas, deploy marker, cadastro form, wabadisparos
