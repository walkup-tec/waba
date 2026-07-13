# LOG — causa: Dockerfile copia dist/ sem tsc

## Causa raiz
Build Easypanel: `COPY dist ./dist` — **não** roda `npm run build`.
Commits só com `src/` + `index.html` não mudam produção.
`dist/deploy-marker.js` ficava em `DEPLOY-2026-07-10-chamados-todos-usuarios`.

## Correção
`npm run build:h` + commit `598237f` com `dist/` atualizado (Logs Sistema + marker `DEPLOY-2026-07-11-logs-sistema`).

## Próximo
Redeploy Easypanel `waba_disparador` commit `598237f`; republicar 30180 se 502; validar marker.
