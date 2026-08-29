# Embedded Signup: segunda tela em branco (Login para Empresas)

## Contexto

Depois do «Continuar» no login Facebook, o popup `Login do Facebook para Empresas` ficava branco em `facebook.com/v22.0/dialog/oauth`. A primeira tela de confirmação de login funcionava. URL com `app_id=1279182514183979` e `config_id=1590195526041278`.

## Causa

O Config ID de produção é Facebook Login for Business (Embedded Signup **v4**). A doc oficial manda `extras` só com `setup` (vazio ou prefill):

- https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions (`extras: {}` no v4; `sessionInfoVersion` só no v2)

O WABA ainda enviava `sessionInfoVersion: "3"` (legado v2). O OAuth abre; o assistente de empresa/WABA/número não renderiza.

## Solução

`FB.login` passa `extras: { setup }` sem `sessionInfoVersion`. Prefill de «Adicionar número» permanece.

## Arquivos

- `src/integrations/meta-whatsapp/meta-es-fb-login.ts`
- `src/integrations/meta-whatsapp/meta-es-fb-login.test.ts`
- `index.html`

## Validação

- `npm run test:meta-es-login`
- Marker: `DEPLOY-2026-08-29-114200-es-v4-extras`
- Em produção, depois de Redeploy `waba_disparador`: clicar Conectar Portfólio e ver o assistente após o login (não a tela branca).

## Palavras-chave

embedded-signup, v4, extras, sessionInfoVersion, dialog/oauth, tela branca, Login para Empresas
