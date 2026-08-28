# Identidade local do card do número WhatsApp

## Contexto

Editar nome e foto do chip criado via Drax não atualizava o CARD 02. A listagem só mostra `verified_name` da Graph; esse campo só muda depois da aprovação da Meta. A foto na Meta exige número **Ativo** (`whatsapp_business_profile`). Se a Graph recusasse os dois, o pedido falhava e o card ficava igual.

Docs: [Display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names) (`POST /{phone-number-id}?new_display_name=`; `verified_name` só após aprovação + re-register) e [Business Profiles](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/).

## Solução

Mesmo contrato do portfólio: o card WABA é a fonte visível.

1. Nome e foto por `phoneNumberId` em `data/.../meta-whatsapp/phone-identity/`
2. Overlay na listagem (`verifiedName` + `profilePictureUrl`)
3. `GET /integrations/meta/whatsapp/phone-numbers/photo?id=`
4. Graph best-effort; número pendente grava a foto no card e avisa que a Meta só aplica depois do PIN

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html` / `dist/index.html`

## Como validar

- `npm run test:meta-portfolio`
- Laboratório: Editar no chip → nome + foto → o card do número deve mostrar os dois na hora

## Palavras-chave

phone-identity, verified_name, new_display_name, whatsapp_business_profile, card-laboratorio
