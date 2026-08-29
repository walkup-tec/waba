# Embedded Signup: FB.init Graph v26 (dialog versionado)

## Contexto do pedido

A correção `extras={"setup":{}}` (sem `sessionInfoVersion`) está no ar (`DEPLOY-2026-08-29-114200-es-v4-extras`) e a segunda tela do Login para Empresas continua branca. URL ao vivo com `extras=%7B%22setup%22%3A%7B%7D%7D` e `facebook.com/v22.0/dialog/oauth`.

## Comandos / ações

- `GET https://waba.draxsistemas.com.br/health` → `deployMarker=DEPLOY-2026-08-29-114200-es-v4-extras`
- `GET /integrations/meta/whatsapp/config` → `graphVersion=v22.0`, `configId=1590195526041278`
- HTML de produção sem `Cross-Origin-Opener-Policy`
- Leitura das docs oficiais Meta (versioning, Embedded Signup implementation, Login for Business)

## Solução implementada

1. Hipótese `sessionInfoVersion` **refutada** pela URL ao vivo (`extras` só com `setup`).
2. Próxima causa com evidência: o dialog OAuth é versionado pelo `FB.init`. Graph latest = `v26.0`. A implementação oficial do Embedded Signup pede Graph latest (`v25.0`/`v26.0`). Produção abria `/v22.0/dialog/oauth`.
3. `graphVersion` público do FB.init passou a ser `readMetaJsSdkGraphVersion()` (`v26.0`), **sem** herdar `META_GRAPH_VERSION` do token exchange.
4. `FB.init` no `index.html` usa fallback `v26.0` e `autoLogAppEvents: true` (amostra oficial ES).

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-config.ts`
- `src/integrations/meta-whatsapp/meta-es-fb-login.ts`
- `src/integrations/meta-whatsapp/meta-es-fb-login.test.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/index.ts`
- `index.html`
- `src/deploy-marker.ts`
- este LOG + `doc/memoria.md` + `.cursor/project-memory/`

## Como validar

1. `GET /health` = `DEPLOY-2026-08-29-125800-es-fbinit-v26`
2. `GET /integrations/meta/whatsapp/config` → `graphVersion=v26.0`
3. No popup, a URL deve ser `facebook.com/v26.0/dialog/oauth` (não `v22.0`)
4. Depois de «Continuar», o assistente empresa/WABA/número deve abrir (validação humana)

## Observações de segurança

Sem secrets no config público. Token exchange no servidor continua em `META_GRAPH_VERSION`.

## Palavras-chave

`FB.init`, `v26.0`, `dialog/oauth`, `graphVersion`, `META_ES_JS_SDK_GRAPH_VERSION`, `Embedded Signup`, `Login for Business`, `tela branca`
