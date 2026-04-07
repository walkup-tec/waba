# LOG: Meta Embedded Signup - consistencia de redirect_uri

## Contexto

Ao testar o fluxo real, a Meta retornou:
`Error validating verification code. Please make sure your redirect_uri is identical to the one you used in the OAuth dialog request`.

## Causa raiz

O frontend enviava `redirectUri` derivado da URL atual da pagina, que pode variar (barra final, caminho, query), enquanto o backend tambem tenta valor de ambiente. Essa variacao pode invalidar o code na troca.

## Solucao implementada

1. `GET /meta-oficial/embedded-signup/config` agora retorna `redirectUri` quando `META_OAUTH_REDIRECT_URI` estiver definido.
2. No frontend, a troca de code usa primeiro `cfg.redirectUri` (vindo do backend), com fallback para `window.location.origin`.
3. No backend (`exchange-code`), a ordem de tentativa foi alterada para priorizar o `redirect_uri` do ambiente antes do valor recebido no body.
4. Build executado para atualizar `dist`.

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `dist/index.html`
- `dist/index.js`

## Como validar

1. Conferir no ambiente de producao que `META_OAUTH_REDIRECT_URI` esta definido com a URL exata usada no OAuth.
2. Rodar o fluxo Embedded Signup.
3. Validar no Network que o POST de `exchange-code` retorna JSON de sucesso (ou erro funcional diferente de redirect_uri mismatch).

## Seguranca

Nenhum segredo foi exposto. Ajuste limitado a consistencia de parametro OAuth.

## Palavras-chave

`embedded-signup`, `exchange-code`, `redirect_uri`, `META_OAUTH_REDIRECT_URI`, `oauth`
