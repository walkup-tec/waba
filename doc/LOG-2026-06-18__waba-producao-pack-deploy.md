# LOG — Deploy produção DEPLOY-2026-06-18-waba-producao-pack

**Data:** 2026-06-18  
**Alvo:** Easypanel `waba_disparador` (branch `master`) — https://waba.draxsistemas.com.br/version-02/

## Marker
`DEPLOY-2026-06-18-waba-producao-pack` → validar `GET /health` → `deployMarker`

## Pacote principal
- Campanhas operacional: reportar erro, restituição saldo, botão inline
- E-mails transacionais: chamado/campanha/boas-vindas/erro campanha
- Chamados master: ID, atraso 24h, anexos
- UI assinante: cards campanha borda verde/vermelha, link e-mail abre lista
- Billing, financeiro split, disparos dashboard, suporte, menus

## Pós-deploy
1. Easypanel: redeploy serviço Git `master`
2. `curl -sS https://waba.draxsistemas.com.br/health` → `deployMarker` correto
3. Smoke: login operacional campanhas + assinante disparos

## Variáveis produção (se ainda não configuradas)
- `MAIL_*` / `SMTP_*` para e-mails
- `WABA_APP_LOGIN_URL` = URL pública do painel
