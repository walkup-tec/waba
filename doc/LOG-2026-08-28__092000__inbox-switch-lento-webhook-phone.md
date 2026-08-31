# Switch Inbox lento/grande + conversas fora do Inbox

## Contexto

O switch Inbox do card esticava na altura da linha e só mudava depois de duas listagens Graph. O operador ligou o Inbox, mandou mensagem ao número e não viu nada no chat/Inbox.

## Causa

1. CSS grid `align-items: stretch` fazia o switch ocupar a altura do card.
2. `setPhoneInboxFromAuth` chamava `listPortfolioAssets` duas vezes (GET business, números, nome e perfil por chip) e o clique ficava `disabled` até voltar. O card só redesenhava no fim.
3. Switch já nasce ligado. O primeiro clique **desliga**. Com Inbox off a lista oculta as conversas daquele `phoneNumberId`.
4. Inbound gravava `connection.phoneNumberId` em vez do `phone_number_id` do webhook — filtro por canal do chip escondia a thread.

O switch **não** liga o chatbot (automação). Automação é outra tela e nasce desligada.

## Solução

- Switch 34×18, `align-self: center`, clique otimista (não espera Graph).
- POST Inbox só grava o JSON local.
- Webhook persiste no `phoneNumberId` do evento.

## Arquivos

- `index.html`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook-inbox.service.ts`
- testes portfolio / phase6

## Como validar

- Switch muda na hora; verde = Inbox ligado.
- Mandar mensagem ao chip e ver a conversa em Inbox · Todas.
- Resposta automática só com Automação ligada no Laboratório.

## Palavras-chave

inbox switch, listPortfolioAssets, phoneNumberId webhook, excludePhoneNumberIds
