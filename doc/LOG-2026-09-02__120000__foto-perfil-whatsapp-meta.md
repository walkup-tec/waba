# LOG — Foto de perfil do WhatsApp do sistema para a Meta

## Contexto

O card do chip (ex.: Relacionamento Jandira Feghali) só lia a foto da Graph. A edição que enviava o arquivo à Meta tinha sido removida quando o laboratório passou a tratar a Meta como fonte da verdade.

Pedido: ditar a foto no Waba e atualizar o perfil que o cliente vê no WhatsApp.

Docs oficiais:
- https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/
- https://developers.facebook.com/docs/graph-api/guides/upload/

## Solução

1. Clique na foto ou em **Editar perfil** no card do número.
2. Upload resumable (`POST /{app-id}/uploads` + binário) → `profile_picture_handle`.
3. `POST /{phone-number-id}/whatsapp_business_profile` com `messaging_product: whatsapp`.
4. Número precisa estar **Ativo** (CONNECTED). Pendente: `phone_not_registered`.
5. PNG/JPEG pelos bytes, até 5 MB. Nome de exibição continua com aprovação da Meta.

## Como validar

```bash
npm run test:meta-portfolio
```

Após Redeploy: abrir o card do número → Editar perfil → JPEG/PNG ≤ 5 MB → Enviar para a Meta. Marker: `DEPLOY-2026-09-02-120000-foto-perfil-whatsapp`.

## Palavras-chave

foto perfil, whatsapp_business_profile, profile_picture_handle, Editar perfil, chip
