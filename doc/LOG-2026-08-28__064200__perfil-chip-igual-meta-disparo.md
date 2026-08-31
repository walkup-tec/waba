# Perfil do chip = o que a Meta já aplicou (disparo)

## Contexto

Não pode a Drax mostrar logo/nome novos e a Meta continuar com o antigo: no disparo o cliente vê o perfil da Cloud API. O card gravava identidade local mesmo se a Graph falhasse.

Docs: [Business Profiles](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/) (foto/descrição no POST) e [Display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names) (nome só após aprovação + PIN).

## Solução

- Número precisa estar Ativo. Sem PIN, a API recusa nome/foto.
- Foto e descrição: POST Graph tem de dar certo; só então grava no card. Check na hora.
- Nome: POST `new_display_name` tem de ser aceito. O card continua com o `verified_name` da Meta (o que o cliente vê) e mostra `solicitado: …` até a Meta aplicar.
- Se a Graph recusar, o save falha — a Drax não finge que mudou.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-errors.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html`

## Palavras-chave

fail-closed, verified_name, profile_update_failed, phone_not_registered, disparo-identidade
