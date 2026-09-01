# Meta Inbox — envio usa conexão do número receptor

## Contexto

Após separar os fios de Drax e Walkup, respostas no fio Walkup eram persistidas
como `failed` com “Não foi possível enviar a mensagem”.

## Causa

A conversa Walkup herdou o `connection_id` antigo da Drax durante a separação
histórica. O envio combinava token/conexão Drax com `phone_number_id` Walkup,
e a Meta recusava a operação.

## Solução

- O provider resolve primeiro a conexão pelo `phone_number_id` receptor.
- `sendForTenant` passa o número da conversa ao resolver a conexão.
- Ao atualizar o fio, `connection_id` é sincronizado com a conexão efetivamente usada.
- A migration histórica também recalcula `connection_id` pela mensagem mais
  recente daquele número oficial.

## Arquivos

- `src/integrations/whatsapp/meta-cloud-provider.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-messaging.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-conversation.repository.ts`
- `doc/SQL-2026-09-01__split-meta-inbox-by-phone-number.sql`
- Testes Meta fases 6, 8 e 9

## Validação

- Teste automatizado: conversa Walkup com `connection_id` Drax escolhe
  `conn-walkup`, token Walkup e `phone-walkup`.
- Reexecutar a migration no Supabase.
- Após deploy, responder uma única vez no fio Walkup e confirmar status `aceita`.

## Segurança

Tokens continuam cifrados e não são registrados. A resolução exige o mesmo
`tenant_id`.

## Palavras-chave

Meta Inbox, send_failed, connection_id, phone_number_id, Walkup, Drax
