# LOG — e-mails chamado/campanha finalizados

**Data:** 2026-06-18

## Pedido
Enviar e-mail ao assinante quando:
1. Chamado de suporte for finalizado (corpo = Resposta da equipe).
2. Campanha for finalizada (botão "Acesse o relatório" → painel Disparos).

SMTP via env (`MAIL_MODE=smtp`, Gmail).

## Implementação
- `src/mail/waba-mail.service.ts` — nodemailer SMTP
- `src/mail/waba-mail.templates.ts` — textos cordiais PT-BR
- `src/mail/waba-mail-delivery.ts` — disparo assíncrono
- Hook chamado: `waba-admin-support.service.ts` ao fechar
- Hook campanha: `waba-operacional-campanhas.service.ts` ao salvar relatório (status completed)
- Deep link: `?campanhaRelatorio=<id>` abre modal de relatório no painel assinante
- Marker: `DEPLOY-2026-06-18-waba-email-notifications`

## Validar
1. Finalizar chamado com resposta → e-mail para ownerEmail.
2. Finalizar campanha operacional → e-mail com botão → abre relatório logado.

## Pendências
- Reiniciar dev server após alteração env (.env.v02).
- Produção: vars já no Easypanel waba_disparador.
