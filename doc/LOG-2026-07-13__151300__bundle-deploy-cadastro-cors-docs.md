# LOG — Bundle deploy sessão 2026-07-13

## Marker
`DEPLOY-2026-07-13-bundle-cadastro-cors-docs`

Validar: `curl -sS https://waba.draxsistemas.com.br/health | findstr deployMarker`

## Conteúdo do bundle (já no Git / este commit)

### App WABA (já em master antes deste commit; marker novo força redeploy)
- Monitor uptime anti falso alerta + probe local
- Login heal v2 (watch + burst)
- Tarifador sem faixa 100 · R$30
- Encurtador is.gd/TinyURL + salvar seção sem apagar config

### Landing cadastro (repo separado — já pushed)
- `pv-waba-disparador` `3826a02` — form `#cadastro` + proxy API
- Redeploy separado: **`waba_paginadevendas`**

### Neste commit
- Marker novo
- `.env.v02.example` CORS landings
- Docs/memoria/LOGs sessão
- Agente Traefik incidentes (rule + skill)
- Scripts auxiliares (uptime patch, check-index, run-ts-dev, purge menus, traefik-kb)

## Deploy
1. Easypanel Redeploy **`waba_disparador`** → conferir marker no `/health`
2. Easypanel Redeploy **`waba_paginadevendas`** → form em wabadisparos.com.br/#cadastro
3. Pós-redeploy WABA: heal login deve republicar `:30180` (watch v2)

## Keywords
deploy marker, bundle-cadastro-cors-docs, wabadisparos, paginadevendas
