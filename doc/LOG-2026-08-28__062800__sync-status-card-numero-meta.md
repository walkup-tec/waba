# Status de sincronização Meta dentro do card do número

## Contexto

O aviso `Número: foto atualizada · nome atualizado · nome enviado para aprovação da Meta` aparecia em `#meta-tp-connect-status`, abaixo da lista. O operador precisa ver isso **dentro** do card, com ícone de check quando a Meta já aplicou e ampulheta enquanto não aplicou.

Docs: [Display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names) (`verified_name`) e [Business Profiles](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/) (`profile_picture_url`).

## Solução

- Nome: `applied` se o nome local for igual ao `verified_name` da Graph; senão `pending`.
- Foto: `applied` se a Graph devolver `profile_picture_url` https; senão `pending` quando há foto local.
- O card renderiza `foto atualizada` e `nome atualizado` com check (verde) ou ampulheta (âmbar).
- O toast de baixo do número deixa de receber esse texto no save do chip.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html`

## Palavras-chave

nameSyncStatus, photoSyncStatus, verified_name, profile_picture_url, card-numero
