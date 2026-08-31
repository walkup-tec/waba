# Inbox opt-in: switch nasce desligado

## Contexto

O switch Inbox nascia verde. O operador ligava (na prática o primeiro clique desligava) e o número já aparecia no Inbox. Pedido: nascer cinza; só depois de ligar o chip entra no Inbox para enviar e receber como um chat normal.

## Solução

- `inboxEnabled === true` é opt-in. Sem flag ou `false` = cinza, fora da lista, webhook não persiste inbound, responder no Inbox recusa.
- Canais do Inbox só os chips ligados. Não inclui mais o telefone da conexão por padrão.
- Com o switch verde: webhook grava a conversa no `phoneNumberId` do evento; o Inbox lista, abre e envia.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-inbox.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-conversation.repository.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook-inbox.service.ts`
- `index.html`

## Como validar

- Card: switch cinza. Ligar → verde. Inbox → canal do número. Mandar mensagem ao chip e responder pelo Inbox.

## Palavras-chave

inboxEnabled opt-in, includePhoneNumberIds, inbox_disabled
