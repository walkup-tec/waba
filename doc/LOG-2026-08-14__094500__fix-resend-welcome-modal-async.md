# LOG — Modal reenviar boas-vindas travado em "Enviando…"

## Contexto

Admin → Assinantes → **Reenviar boas-vindas** ficava preso no botão **Enviando…** mesmo com WhatsApp entregue. O endpoint aguardava ACK/failover (minutos) enquanto o frontend esperava até 120s.

## Solução

1. **`POST /admin/subscribers/:id/resend-welcome`** responde **202** imediatamente com `{ queued: true }`.
2. **`queueSubscriberWelcomeResend`** valida assinante e dispara `resendSubscriberWelcome` em background.
3. **`index.html`** trata `202`/`queued`, exibe toast e fecha o modal; timeout do fetch reduzido para 30s.

## Arquivos alterados

- `src/admin/waba-admin.routes.ts`
- `src/admin/waba-admin-subscribers.service.ts`
- `src/deploy-marker.ts`
- `index.html`
- `dist/admin/waba-admin.routes.js`
- `dist/admin/waba-admin-subscribers.service.js`
- `dist/deploy-marker.js`
- `dist/index.html`

## Validar

1. Redeploy Easypanel `waba_disparador`.
2. `GET /health` → marker `DEPLOY-2026-08-14-resend-welcome-async-ui`.
3. Reenviar boas-vindas: modal fecha em segundos; WhatsApp/e-mail continuam em background.

## Palavras-chave

resend-welcome, boas-vindas, modal, 202, async, admin assinantes
