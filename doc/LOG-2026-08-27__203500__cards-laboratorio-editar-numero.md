# LOG — Cards do Laboratório + editar nome/foto do número

## Contexto

A tela Conectar WhatsApp deve ter dois cards: etapas de integração e portfólio/números. Em cada chip, um botão Editar para foto de perfil e nome de exibição.

## Solução

- CARD 01: hero, botão conectar e as 6 etapas
- CARD 02: identidade do portfólio + lista de números
- `POST /integrations/meta/whatsapp/phone-numbers/profile`
- Foto: Resumable Upload + `whatsapp_business_profile` (`profile_picture_handle`)
- Nome: `POST /{phone-number-id}?new_display_name=` — a Meta aprova depois; reativar com PIN

Docs:
- https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names
- https://developers.facebook.com/docs/graph-api/guides/upload

## Como validar

- Laboratório Mozart: dois cards visíveis
- Editar no chip: nome e/ou JPEG/PNG
- Nome novo: mensagem de aprovação da Meta

## Palavras-chave

portfolio, etapas, editar número, display name, profile_picture_handle, whatsapp_business_profile
