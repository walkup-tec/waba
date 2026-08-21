# LOG — Limite da mensagem gerada pela IA

## Contexto

Reduzir o tamanho máximo da mensagem do Mensageiro (IA) de 400 para 280 caracteres.

## Solução

Instrução do prompt em `buildDisparosAiPrompt` (modos link e botão): máximo 280 caracteres.

## Arquivos

- `src/index.ts`
- `dist/index.js`
- `src/deploy-marker.ts`
- `dist/deploy-marker.js`

## Marker

`DEPLOY-2026-08-11-mensagem-ia-280`
