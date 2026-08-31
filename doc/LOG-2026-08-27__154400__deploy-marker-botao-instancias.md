# Marker de deploy: + Instâncias alias WB-2102

## Contexto

Novo marker para validar o Redeploy EasyPanel do `waba_disparador` com o fix do botão **+ Instâncias** (WB-2102 / 5197462102).

## Marker

`DEPLOY-2026-08-27-154400-botao-instancias-alias`

## Arquivos

- `src/deploy-marker.ts`
- `dist/deploy-marker.js`

## Como validar

Após Redeploy: `GET /health` deve trazer o marker acima.
