# LOG — Boas-vindas WhatsApp no cadastro do assinante

**Data:** 2026-07-03

## Contexto

Enviar mensagem de boas-vindas no WhatsApp do assinante ao se cadastrar, tanto pelo site quanto pelo master, com o texto oficial DRAX (credenciais + link da comunidade).

## Solução

1. **`src/mail/waba-welcome-whatsapp.service.ts`**
   - `buildSubscriberWelcomeWhatsAppText()` — template com e-mail, senha, URL do sistema e link da comunidade.
   - `deliverSubscriberWelcomeWhatsApp()` — envia via Evolution `sendText` (`sendEvoTextAlert`).
   - Instância: `WABA_WELCOME_WHATSAPP_EVO_INSTANCE` → push config → `resolveDefaultPushCommunityEvoInstance()`.
   - Link comunidade: `WABA_WELCOME_COMMUNITY_LINK` → `waba-push-config.json` → padrão `https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7`.

2. **`notifySubscriberWelcomeEmail`** — dispara e-mail e WhatsApp em paralelo (fluxo único em `WabaSubscriberService.register()`).

## Arquivos

- `src/mail/waba-welcome-whatsapp.service.ts` (novo)
- `src/mail/waba-mail-delivery.ts`
- `src/deploy-marker.ts`
- `.env.example`

## Validar

1. Cadastrar assinante (site ou admin) com WhatsApp válido.
2. Verificar recebimento da mensagem no número informado.
3. `GET /health` → marker `DEPLOY-2026-07-03-boas-vindas-whatsapp-assinante`.

## Segurança

- Senha enviada apenas no canal WhatsApp do próprio assinante (número do cadastro).
- Logs não incluem senha.

## Palavras-chave

`notifySubscriberWelcomeWhatsApp`, `buildSubscriberWelcomeWhatsAppText`, `WABA_WELCOME_WHATSAPP_EVO_INSTANCE`, boas-vindas cadastro
