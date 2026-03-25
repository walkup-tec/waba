# LOG: PayloadTooLargeError — limite JSON no Express

## Contexto

`PayloadTooLargeError: request entity too large` ao enviar campanhas com muitos números no body JSON (limite padrão do `body-parser` ~100kb).

## Solução

- `express.json({ limit: JSON_BODY_LIMIT })` com padrão **32mb**.
- Override opcional: variável de ambiente `JSON_BODY_LIMIT` (ex.: `64mb`).

## Arquivo

- `src/index.ts` (`dist/index.js` via build)

## Como validar

- Reiniciar o servidor e repetir `POST /disparos/campanhas` com planilha grande.

## Palavras-chave

`PayloadTooLargeError`, `JSON_BODY_LIMIT`, `express.json limit`
