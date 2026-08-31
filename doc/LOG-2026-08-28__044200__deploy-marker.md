# Marker de deploy 2026-08-28

## Contexto

Novo marker para validar o Redeploy EasyPanel do `waba_disparador`.

## Marker

`DEPLOY-2026-08-28-044200-botao-instancias-alias`

## Arquivos

- `src/deploy-marker.ts`
- `dist/deploy-marker.js`

## Como validar

Após Redeploy: `GET /health` deve trazer o marker acima.
