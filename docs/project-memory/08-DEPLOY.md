# Deploy

EasyPanel `waba_disparador` lê GitHub `walkup-tec/waba` `master`. Imagem faz `COPY dist ./dist`.

Checklist:

1. `npm run test:meta-phase7` quando o tema for templates. `npm run test:meta-lab-report` quando o tema for relatório / coleta Meta. `npm run test:broadcast-header` quando o tema for Disparo Cloud.
2. `npm run build` e commitar `dist/` se o JS/HTML publicado vier do bundle.
3. Push no remoto que o EasyPanel usa.
4. Redeploy só com autorização. **Não** Redeployar se `GET /health` → `cloudBroadcastProtect.blockRedeploy=true`.
5. Depois do Redeploy, validar `GET /health` → `deployMarker`. Relatório: `DEPLOY-2026-09-09-204800-lab-report-wait-meta-statuses`.
