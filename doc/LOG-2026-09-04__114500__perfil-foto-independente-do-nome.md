# Editar perfil — foto abortada quando a Meta recusa o nome

## Contexto

No card do número (`+55 27 92836-1174`, nome **Nesio**), ao enviar foto PNG 500×500 o modal mostrou:

> Não foi possível atualizar o nome ou a foto deste número na Meta.

## Sintoma

- Foto selecionada + nome preenchido → erro genérico.
- Nenhuma distinção entre falha de nome e falha de foto.

## Hipótese (confiança: Alta)

1. O fluxo fazia `POST ?new_display_name=` **antes** do upload da foto.
2. Se a Meta recusasse o nome (regras de display name), o código lançava `profile_update_failed` e **nunca** enviava a foto.
3. A UI enviava categoria/vertical mesmo sem mudança, inflando o payload.

Doc: [Business Profiles](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/) (`profile_picture_handle`) e regras de display name da Meta.

## Solução

1. Nome e foto/dados da empresa passam a ser **independentes**.
2. Nome recusado + foto ok → sucesso parcial (`nameRejected`) com aviso claro.
3. Erros específicos: `display_name_update_failed`, `profile_photo_update_failed`.
4. Front só manda vertical/descrição/endereço/e-mail quando mudaram.
5. Marker `DEPLOY-2026-09-04-114500-profile-photo-independent-name`.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-errors.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html` / `dist/`
- `src/deploy-marker.ts`

## Validar

1. Redeploy EasyPanel do `waba_disparador`.
2. `GET /health` → marker `…114500-profile-photo-independent-name`.
3. Editar perfil: só foto → deve aplicar.
4. Nome inválido + foto → foto aplica; aviso de nome recusado.
5. `npm run test:meta-portfolio` (52 pass).

## Palavras-chave

Editar perfil, Nesio, profile_picture_handle, new_display_name, nameRejected, foto WhatsApp
