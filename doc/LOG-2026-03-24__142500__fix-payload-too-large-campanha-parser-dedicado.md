# LOG: PayloadTooLargeError — parser JSON dedicado para criar campanha

## Problema

`PayloadTooLargeError` persistia após aumentar `express.json` global: corpo do `POST /disparos/campanhas` (lista `numbers` + snapshot) pode passar de **32mb** ou o ambiente podia sobrescrever limite via `.env`.

## Solução

- Middleware que escolhe o parser por rota:
  - **POST** em `/disparos/campanhas` (sem barra final): `express.json({ limit: CAMPAIGN_CREATE_JSON_LIMIT })` com padrão **512mb**.
  - Demais requisições: `JSON_BODY_LIMIT` padrão **10mb** (config geral via env).
- Variáveis: `CAMPAIGN_CREATE_JSON_LIMIT` (opcional), `JSON_BODY_LIMIT` (opcional).
- Ao subir o servidor, log: `[body-parser] JSON: geral=… | POST /disparos/campanhas=…`.

## Validação

- `npm run build` e **reiniciar** o processo Node (obrigatório).
- Na subida, conferir a linha `[body-parser]` no terminal.

## Palavras-chave

`PayloadTooLargeError`, `CAMPAIGN_CREATE_JSON_LIMIT`, `parseJsonCampaignCreate`
