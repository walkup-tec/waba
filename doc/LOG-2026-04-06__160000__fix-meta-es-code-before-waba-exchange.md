# LOG: fix(meta-es) — troca de code sem esperar WABA ID

## Contexto

O fluxo Embedded Signup da Meta costuma devolver o `code` no callback do `FB.login` **antes** do `waba_id` chegar via `postMessage`. O frontend exigia `code` **e** `wabaId` para chamar `/meta-oficial/embedded-signup/exchange-code`, mas o backend só precisa do `code`. Com isso a UI ficava presa em “Finalizando integração…”.

## Solução

- Trocar o `code` por token assim que existir `code`.
- Guardar o token obtido em `metaEsExchangedAccessToken` até o `waba_id` chegar.
- Quando houver token + `wabaId`, preencher campos, `subscribe-webhooks` e marcar sucesso como antes.

## Arquivos

- `index.html`, `dist/index.html` (via build)

## Validação

1. `npm run build`
2. Fluxo: após receber code, deve aparecer “Token obtido. Aguardando WABA ID…” se o WABA ainda não veio; após o evento da Meta com `waba_id`, deve concluir com sucesso.

## Palavras-chave

`embedded-signup`, `exchange-code`, `waba_id`, `postMessage`, `tryFinalizeMetaEmbeddedSignup`
