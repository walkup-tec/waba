# LOG — Excluir template na Meta e no front

## Contexto

O Excluir da tabela só escondia a linha. O pedido: apagar também na biblioteca da Meta.

## Doc oficial

https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management

- `DELETE /{waba-id}/message_templates?name=&hsm_id=`
- Permissão `whatsapp_business_management`
- Só o ID (hsm_id + name) para não apagar outros idiomas do mesmo nome
- Template aprovado: o nome fica bloqueado 30 dias
- DISABLED não pode ser excluído
- Já enviado e não entregue: status `PENDING_DELETION`

## Ações

- Client Graph `deleteWabaMessageTemplate`
- `DELETE /integrations/meta/whatsapp/templates/:id` autenticado, isolado por tenant
- Front confirma e, se a Meta aceitar (ou o template já não existir), remove da lista

## Como validar

```bash
npm run test:meta-phase7
```

Clicar Excluir, confirmar, conferir que some na tabela e no WhatsApp Manager.

## Palavras-chave

delete, message_templates, hsm_id, excluir, meta
