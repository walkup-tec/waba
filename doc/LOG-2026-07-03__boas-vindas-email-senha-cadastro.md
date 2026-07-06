# LOG — E-mail boas-vindas com senha do cadastro

**Data:** 2026-07-03  
**Marker:** `DEPLOY-2026-07-03-boas-vindas-senha-cadastro`

## Contexto

O e-mail de boas-vindas deve informar a **senha cadastrada** ao assinante, tanto no cadastro pelo site quanto no cadastro pelo master (ambos usam `WabaSubscriberService.register()`).

## Solução

- `buildSubscriberWelcomeTemplate` — nova linha **Senha de acesso** no resumo do cadastro.
- `notifySubscriberWelcomeEmail` / `deliverSubscriberWelcomeEmail` — recebem `password`.
- `register()` — repassa a senha em texto (antes do hash) para o e-mail.

## Arquivos

- `src/mail/waba-mail.templates.ts`
- `src/mail/waba-mail-delivery.ts`
- `src/subscribers/waba-subscriber.service.ts`
- `src/deploy-marker.ts`

## Validar

1. Cadastro pela landing → e-mail com senha informada no formulário.
2. Admin · Assinantes → criar assinante → mesmo e-mail com a senha definida no master.

## Palavras-chave

`buildSubscriberWelcomeTemplate`, `notifySubscriberWelcomeEmail`, `Senha de acesso`
