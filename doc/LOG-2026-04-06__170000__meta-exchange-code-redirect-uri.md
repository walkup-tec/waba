# LOG: Meta Embedded Signup — exchange-code com redirect_uri

## Problema

`POST /meta-oficial/embedded-signup/exchange-code` retornava **502** na produção: a Graph API da Meta frequentemente exige `redirect_uri` na troca do `code`, alinhado ao fluxo de login.

## Solução

- Backend tenta, em ordem: `redirectUri` enviado pelo cliente (URL atual sem `#`), `META_OAUTH_REDIRECT_URI` no ambiente, e chamada sem `redirect_uri` (fallback).
- Se a Meta responder erro relacionado a `redirect_uri`, faz nova tentativa sem o parâmetro.
- Frontend envia `redirectUri` = `location.href` sem hash.
- Banner de falha exibe o texto detalhado quando disponível.

## Arquivos

- `src/index.ts`, `index.html`, `dist/*`, `.env.example`

## Palavras-chave

`exchange-code`, `redirect_uri`, `META_OAUTH_REDIRECT_URI`, `oauth/access_token`
