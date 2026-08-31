# Feedback de ação e recarga automática na UI

## Contexto

O operador precisava dar F5 para ver dado novo e os botões de ação não mostravam que a operação estava em andamento.

## Solução

- Spinner `.is-processing` no botão/switch no clique, até o `fetch` daquela ação terminar.
- Depois de ligar Inbox, enviar teste Cloud/template ou responder no Inbox, a lista/conversa recarrega sozinha (`wabaRefreshMetaInbox`). Sem F5.

## Arquivos

- `index.html`

## Como validar

Laboratório: ligar Inbox (anel no switch) → banner do Inbox atualiza. Enviar no Inbox: spinner no botão e a conversa recarrega.

## Palavras-chave

is-processing, wabaRefreshMetaInbox, spinner ação
