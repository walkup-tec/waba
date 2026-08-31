# Foto e descrição do perfil na hora (POST Graph)

## Contexto

No WhatsApp Manager, foto e descrição entram na hora. Na Drax o card ficava em ampulheta até um GET posterior (`profile_picture_url` / texto igual), o que não é o contrato da Cloud API.

Docs: [Business Profiles](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/) — `POST /{phone-number-id}/whatsapp_business_profile` responde `{ success: true }` e aplica na hora. Upload: [Resumable Upload API](https://developers.facebook.com/docs/graph-api/guides/upload). Display name continua com revisão: [Display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names).

## Solução

- Se o POST do perfil (foto via `profile_picture_handle` e/ou descrição) retorna sucesso, grava `photoMetaApplied` / `profileMetaApplied`.
- O card mostra check nesses campos na hora. O GET só reforça se a Meta já tiver URL/texto.
- Nome de exibição segue `verified_name` (ampulheta até a Meta aprovar).

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html`

## Palavras-chave

whatsapp_business_profile, profile_picture_handle, photoMetaApplied, profileMetaApplied
