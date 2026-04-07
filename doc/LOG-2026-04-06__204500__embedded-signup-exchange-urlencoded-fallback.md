# LOG: Embedded Signup — `exchange-code` via `urlencoded` + fallback JSON

## Contexto

POST para `/api/meta/embedded-signup/exchange-code` e `/meta-oficial/embedded-signup/exchange-code` devolvia **502** com corpo **HTML** no domínio publicado (proxy/EasyPanel), sugerindo que alguns proxies tratam POST JSON de forma diferente de POST `application/x-www-form-urlencoded`.

## Ações executadas

1. Estender `metaPost` em `index.html` com opção `asForm: true` (corpo `URLSearchParams`, `Content-Type: application/x-www-form-urlencoded;charset=UTF-8`).
2. `metaPostEmbeddedExchangeCode`: tentar primeiro **form** em `/api/meta/...`; se o erro parecer resposta HTML/proxy (`htmlishMsg`), tentar **form** no path legado; se ainda “HTML”, último recurso: **JSON** nos dois paths (comportamento anterior).
3. `npm run build` para copiar `index.html` → `dist/index.html`.

## Arquivos alterados

- `index.html` — `metaPost`, `metaPostEmbeddedExchangeCode`
- `dist/index.html` — gerado pelo build

## Pré-requisito no backend

O servidor já usa `express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT })` antes das rotas, para que `req.body.code` e `req.body.redirectUri` funcionem com form POST.

## Como validar

1. Fluxo Embedded Signup no browser; na aba Rede, o POST `exchange-code` deve mostrar **Content-Type** `application/x-www-form-urlencoded`.
2. Resposta esperada da API: **JSON** (sucesso ou 4xx com `detail`), não HTML.
3. Se continuar 502 HTML: investigar proxy/container (logs EasyPanel); testar `curl` no host contra `127.0.0.1:<porta>` com `-d 'code=...&redirectUri=...'`.

## Segurança

Não logar `code` nem tokens; não commitar `.env`.

## Palavras-chave para busca futura

`exchange-code`, `urlencoded`, `502`, `metaPostEmbeddedExchangeCode`, `proxy`, `embedded-signup`
