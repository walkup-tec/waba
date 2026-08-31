# Inbox: mensagem enviada e resposta ao contato

## Contexto do pedido

Uma mensagem enviada não aparecia no Inbox. Também era necessário responder o mesmo contato a partir do compositor do Inbox.

## Causa

O Cloud API grava a conversa com o `phone_number_id` da conexão. O Inbox só lista o Graph ID do chip com switch verde. Se esses IDs diferem, a conversa some da lista e o envio pelo Inbox não tem thread.

Docs: [Send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/) e [Webhooks messages](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/).

## Solução implementada

- Envio (Laboratório e Inbox) usa o chip ligado ao Inbox.
- Listagem inclui o ID da conexão como alias quando há um único chip ligado (conversas antigas voltam a aparecer).
- Compositor mostra erro de envio, recarrega a thread sempre e envia com Enter.

## Arquivos alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-messaging.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-inbox.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook-inbox.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phase8.test.ts`
- `src/deploy-marker.ts`
- `index.html`

## Como validar

- `npm run test:meta-phase8`
- Switch Inbox verde → enviar teste Cloud para um celular → a conversa deve listar no Inbox → abrir e responder.

## Marker de deploy

`DEPLOY-2026-08-28-121400-inbox-envio-conversa` — validar em `GET /health` após Redeploy.

## Palavras-chave

inbox, phone_number_id, sendFromAuth, compositor, conversa
