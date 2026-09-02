# Deploy

EasyPanel `waba_disparador` lê GitHub `walkup-tec/waba` `master`. Imagem faz `COPY dist ./dist`.

Checklist:

1. `npm run test:meta-phase7` quando o tema for templates.
2. `npm run build` e commitar `dist/` se o JS/HTML publicado vier do bundle.
3. Push no remoto que o EasyPanel usa.
4. Redeploy só com autorização. Depois validar `GET /health` → `deployMarker`.
