# LOG — Meta ES: artefato mínimo sem recopy de media

## Contexto do pedido

Validar o artefato da correção Embedded Signup (`config_id` após reauth) sem executar `copy-index-html.mjs` (trava em `dist/media/` no Windows).

## Comandos / ações

- SHA-256 de `index.html` antes/depois: `b9606400df868cc9d26aa9cc723408d571c80a9049ad8fa82e5fce800c64bbf2`
- Snapshot SHA de `dist/media/` (15 arquivos, 31032861 bytes) — inalterado
- Remoção seletiva: 140 `dist/**/*.js` fora de `dist/media/`; preservado `dist/sw-deploy-resilience.js`
- `npx tsc` exit 0; `dist/index.js` 494082 bytes
- Cópia só `index.html` → `dist/index.html` (hash idêntico)
- `npm run test:meta-es-login` 7/7; scripts phase/lab-tokens ausentes neste branch

## Solução implementada

Nenhuma alteração de código nesta etapa. `copy-index-html.mjs` não foi editado.

## Como validar

`META_MINIMAL_BUILD = PASS`. `npm run build` oficial continua `BLOCKED_BY_WINDOWS_MEDIA_COPY`.

## Palavras-chave

`config_id`, `FB.login`, `tsc`, `dist/media`, `META_MINIMAL_BUILD`
