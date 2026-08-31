# Falha ao editar nome e foto do número WhatsApp

## Contexto

Mozart tentou Editar no chip (nome + imagem) e não salvou.

## Causa (código)

1. `POST /{phone-number-id}?new_display_name=` e `POST /{app-id}/uploads` iam com `Content-Type: application/json` **sem body**. A doc oficial do nome não usa JSON ([Display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names)).
2. A foto era tentada **antes** do nome; qualquer falha de upload abortava o pedido inteiro.
3. Número **Pendente** não pode receber `whatsapp_business_profile` (conta não registrada). Mensagem genérica.

Foto: [Business Profiles](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/) + [Resumable Upload](https://developers.facebook.com/docs/graph-api/guides/upload/).

## Solução

- Graph client: `Content-Type` só com body JSON
- Nome e foto independentes; aviso se só uma parte falhar
- Sem registro (`PENDING`): código `phone_not_registered`
- Log com `graphCode`

## Como validar

1. Número **Ativo**: mudar só o nome → “enviado para aprovação”
2. Número **Pendente**: só foto → mensagem de ativar com PIN
3. `npm run test:meta-portfolio`

## Palavras-chave

new_display_name, whatsapp_business_profile, resumable-upload, phone_not_registered, content-type
