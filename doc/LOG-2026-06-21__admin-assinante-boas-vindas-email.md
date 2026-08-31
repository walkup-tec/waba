# Admin assinante — e-mail boas-vindas

## Contexto
Assinantes cadastrados pelo site (`POST /subscribers/register`) já recebiam e-mail de boas-vindas. Cadastro pelo master em Admin · Assinantes não disparava o mesmo e-mail.

## Solução
Centralizado em `WabaSubscriberService.register()`: após persistir o assinante, chama `notifySubscriberWelcomeEmail` (assíncrono, mesmo template da landing).

Fluxos cobertos:
- Landing / site — `POST /subscribers/register`
- Admin master — `POST /admin/subscribers`

## Arquivos
- `src/subscribers/waba-subscriber.service.ts` — disparo do e-mail
- `src/subscribers/waba-subscriber.routes.ts` — removido duplicata
- `src/deploy-marker.ts` — `DEPLOY-2026-06-21-admin-assinante-boas-vindas-email`

## Validar
1. SMTP configurado (`MAIL_MODE=smtp`, `SMTP_*`, `WABA_APP_LOGIN_URL`)
2. Master cria assinante → e-mail «Bem-vindo à Drax — seu cadastro foi confirmado»
3. Cadastro na landing continua recebendo (sem duplicata)
