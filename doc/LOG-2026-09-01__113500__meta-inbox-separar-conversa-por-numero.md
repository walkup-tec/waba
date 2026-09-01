# Meta Inbox — separar conversa por número receptor

## Contexto

O mesmo contato escreveu para Drax Sistemas e Grupo Walkup. O Atendimento exibiu
todas as mensagens em um único fio, sob o último número receptor.

## Causa

`upsertForContact()` priorizava `tenant_id + contact_wa_id` e atualizava
`phone_number_id` na conversa encontrada. Isso unia empresas/canais diferentes.

## Solução

1. Busca e criação de conversa por
   `tenant_id + phone_number_id + contact_wa_id`.
2. Fallback por conexão somente quando o evento não possui `phone_number_id`.
3. Índice único atualizado para a mesma chave.
4. Migration idempotente separa mensagens históricas:
   - inbound usa `to_wa_id` como número receptor;
   - outbound usa `from_wa_id` como número remetente oficial.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-conversation.repository.ts`
- Testes Meta fases 6, 8 e 9
- `doc/SQL-2026-09-01__split-meta-inbox-by-phone-number.sql`
- `.cursor/project-memory/02-BUSINESS_RULES.md`
- `.cursor/project-memory/03-DATABASE.md`

## Validação

- O mesmo `contact_wa_id` enviado para dois `phone_number_id` deve gerar dois
  `conversation_id`.
- Filtrar Drax mostra apenas mensagens cujo receptor/remetente oficial é Drax.
- Filtrar Walkup mostra somente o fio Walkup.

## Segurança

Todas as queries mantêm filtro por `tenant_id`. A migration não altera tokens,
credenciais ou WAMIDs.

## Palavras-chave

meta inbox, multi-número, contato duplicado, phone_number_id, fio separado
