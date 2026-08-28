# Nome e foto do chip — Graph oficial (display name + register)

## Contexto do pedido

No Laboratório o card do `+55 51 8200-1279` mostrava foto antiga (logo DRAX) e nome **Processando** / `solicitado: Drax Sistema`. No WhatsApp Manager a coluna Name ainda era `Mms Marketing E Sistemas Digitais Ltda` e o avatar quebrava; o usuário via o nome novo na aba Profile e entendia que a Meta já tinha aplicado.

## Documentação oficial usada

- Display names: https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names
- Phone Number API (`name_status`): https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/whatsapp-business-account-phone-number-api
- Business profiles (foto): https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/

Conceito da doc: `POST /{PHONE_NUMBER_ID}?new_display_name=` com `{ success: true }` **só inicia** a verificação. O nome ao vivo é `verified_name`. O pedido novo vive em `new_display_name` / `new_name_status`. Depois de `APPROVED` ou `AVAILABLE_WITHOUT_REVIEW` é obrigatório `POST /{PHONE_NUMBER_ID}/register` com PIN. Re-registrar antes da aprovação não tem efeito. A URL `profile_picture_url` é HTTPS assinada (`pps.whatsapp.net`) e expira no browser.

## Causa raiz

1. A Drax não lia `name_status`, `new_display_name` nem `new_name_status`. Depois do POST forçava `namePending` e comparava só o nome local com `verified_name` — que só muda após aprovação **e** register. O card ficava em Processando para sempre.
2. Número já **Ativo** não recebia o PIN de re-registro exigido pela doc.
3. O card preferia arquivo local antigo ou colocava a URL assinada da Graph no `<img>` (quebra igual ao Manager).

## Solução

- Listagem e GET do phone id pedem `verified_name,name_status,new_display_name,new_name_status`.
- Status do nome: Em análise / Aprovado / Recusado / Atualizado. Aprovado (`nameNeedsRegister`) mostra PIN **Aplicar nome na Meta** mesmo com o chip Ativo.
- Foto: download server-side da URL Graph para cache local; o card só usa `/phone-numbers/photo` (não a CDN que expira).

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phone-profile.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html`

## Como validar

- `npx tsx --test src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- No Laboratório, recarregar o card do 1279: se a Graph já aprovou o nome, deve aparecer **Aprovado** + PIN; senão **Em análise** com o `new_display_name`. Foto deve vir do cache (sem ícone quebrado da CDN).
- Aplicar o PIN de 6 dígitos da verificação em duas etapas da Meta. Sem o PIN o WhatsApp não troca o `verified_name` (coluna Name).

## Segurança

Sem tokens nos logs. Download da foto só `https`.

## Palavras-chave

display-name, new_display_name, new_name_status, register PIN, profile_picture_url, pps.whatsapp.net, Laboratório, chip 1279
