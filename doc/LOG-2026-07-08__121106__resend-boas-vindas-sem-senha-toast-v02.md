# LOG — 2026-07-08 12:11 — Reenviar boas-vindas sem pedir senha (V02)

## Pedido
No Admin Assinantes (V02), reenviar notificação de boas-vindas **não** deve pedir senha/modal.
Apenas confirmar no sistema (toast) que o reenvio foi feito.

## Por que a senha existia
`POST /admin/subscribers/:id/resend-welcome` exigia `password` no body para incluir no e-mail/WhatsApp.
A senha plaintext **não é armazenada** (só hash) — o modal forçava o master a digitar de novo.

## Solução
- Backend: `resendSubscriberWelcome(id)` sem password; envia com senha vazia.
- Templates e-mail/WhatsApp: se senha vazia, texto “a senha definida no seu cadastro (use Esqueci a senha…)”.
- UI: clique no ícone reenvio dispara na hora; toast “Reenviando…” e depois sucesso/parcial/erro.
- Removido overlay/modal de senha e listeners associados.

## Arquivos
- `src/admin/waba-admin-subscribers.service.ts`
- `src/admin/waba-admin.routes.ts`
- `src/mail/waba-mail.templates.ts`
- `src/mail/waba-welcome-whatsapp.service.ts`
- `index.html`

## Validar (V02 local)
1. Master → Assinantes → ícone reenviar em uma linha.
2. Sem modal de senha.
3. Toast de confirmação (e-mail e/ou WhatsApp conforme ambiente SMTP/EVO).

## Palavras-chave
resend-welcome, boas-vindas sem senha, toast, admin assinantes, V02
