# Hotfix — waba_disparador amarelo pós-deploy

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-fix-missing-alternativa-dispatch-rules`

## Sintoma
Easypanel `waba_disparador` amarelo; site `Bad Gateway`.

## Causa
`dist/index.js` e `waba-alternativa-numbers.service.js` fazem `require("./disparos/alternativa-dispatch-rules")`, mas **`dist/disparos/alternativa-dispatch-rules.js` não estava no Git**. Container crash: `Cannot find module`.

## Correção
- Commit `src/disparos/alternativa-dispatch-rules.ts` + `dist/disparos/alternativa-dispatch-rules.js`
- Dockerfile: `test -f dist/disparos/alternativa-dispatch-rules.js` no build

## Validar
`GET /health` → marker acima; serviço verde no Easypanel.
