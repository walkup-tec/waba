# Perfil comercial do WhatsApp na Drax

## Contexto

O operador precisa gravar no Laboratório as mesmas informações da tela Perfil do WhatsApp Manager: logo, nome, categoria, descrição, endereço e e-mail. O card só mostrava telefone/nome e o modal só enviava display name e foto.

Docs: [Business Profiles](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/) (`GET/POST /{phone-number-id}/whatsapp_business_profile`) e [Display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names).

## Solução

- Listagem busca `profile_picture_url`, `vertical`, `description`, `address`, `email`.
- Card mostra logo (foto da Meta, local ou fallback) + nome; clique abre o editor.
- Modal do número inclui categoria, descrição (512), endereço (256) e e-mail (128).
- Grava no card e envia à Meta se o número estiver Ativo. Nome continua por `new_display_name`.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-phone-profile.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html`

## Palavras-chave

whatsapp-business-profile, vertical, description, address, email, display-name
