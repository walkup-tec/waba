# LOG — Sync remove templates apagados na Meta

## Contexto

Templates excluídos no WhatsApp Manager continuavam na tabela após **Atualizar da Meta**.

## Causa

`syncFromAuth` só fazia upsert do que a Graph listava. O local órfão ficava. O teste antigo “não apaga local ausente na página” documentava essa escolha (medo de paginação incompleta).

## Doc oficial

https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management

GET `/{waba-id}/message_templates` é a fonte da biblioteca. Template excluído some da lista (salvo `PENDING_DELETION` se ainda há entrega pendente).

## Solução

Depois de paginar todas as páginas (`complete`), apagar do tenant+connection o registro local cujo `meta_template_id` ou `name+language` não veio na Graph.

Se a listagem for truncada (20 páginas com cursor seguinte), não prune.

## Como validar

```bash
npm run test:meta-phase7
```

No painel: Atualizar da Meta e conferir que o que não está mais no WhatsApp Manager some da tabela.

## Palavras-chave

sync, prune, Atualizar da Meta, message_templates, órfão
