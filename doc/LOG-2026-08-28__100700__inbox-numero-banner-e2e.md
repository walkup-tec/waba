# Inbox: switch cinza, número visível, webhook ao ligar

## Contexto

A mensagem de teste não aparecia no Inbox. O switch do Laboratório já nascia verde. O Inbox não mostrava qual número estava ligado.

## Causa

- Produção ainda tratava `inboxEnabled !== false` como ligado (verde sem opt-in).
- Sem identidade persistida, o canal não levava o telefone exibido.
- Webhook só resolvia conexão `status=connected`; WABA em `pending_confirmation` descartava inbound.
- Inscrição `POST /{WABA}/subscribed_apps` era manual.

Docs: [Webhooks WhatsApp](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/) e [subscribed_apps](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/subscribed_apps/).

## Solução

- Switch só verde com `inboxEnabled === true`.
- Ao ligar: grava telefone/nome do card e tenta `subscribed_apps`.
- Inbox mostra «Números no Inbox: nome · +55…» ou aviso se nenhum chip estiver ligado.
- Inbound e listagem aceitam conexão `connected` ou `pending_confirmation`.

## Validação

- Teste ponta a ponta em `meta-whatsapp-phase8.test.ts`: cinza → ligar → envio Cloud → webhook inbound → listar com telefone → responder.
- `npx tsc` + testes Meta da fase 6/8 e portfólio.

Limite: inbound real da Meta só depois do deploy, com switch verde e WABA inscrita.

## Palavras-chave

inboxEnabled, subscribed_apps, pending_confirmation, meta-inbox-banner
