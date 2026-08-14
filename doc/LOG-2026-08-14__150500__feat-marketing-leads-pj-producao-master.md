# LOG — Marketing · Leads PJ em produção (master-only)

## Contexto
Publicar o módulo Marketing → Leads PJ em produção, visível/utilizável apenas por usuários com role `master`.

## Escopo commitado
- `src/marketing/leads-cnpj/*` + `dist/marketing/leads-cnpj/*`
- Wiring em `src/index.ts` / `dist/index.js`
- UI em `index.html` / `dist/index.html` (menu Marketing · Leads PJ)
- Dependência `playwright` + placeholders em `.env.example`
- Marker `DEPLOY-2026-08-14-marketing-leads-pj-master`

## Segurança
- API `/admin/marketing/leads-cnpj*` rejeita não-master (403)
- Menu com `admin-master-only` + `isMarketingTab` / `hasMasterAccess`

## Pós-deploy (EasyPanel)
1. Redeploy `waba_disparador`
2. Confirmar `GET /health` com marker acima
3. Configurar secrets no host: `CASADOSDADOS_*`, `RECEITAWS_*` (sem logar valores)
4. Garantir Chromium do Playwright no container (`npx playwright install chromium` se scrape portal)

## Keywords
leads-pj, leads-cnpj, master-only, producao, marketing
