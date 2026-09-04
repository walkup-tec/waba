# LOG — Template header-media: Graph código 4 (rate limit)

## Contexto
Após o fix que expõe o código Graph, o upload de imagem no cabeçalho do template falhava com:

> A Meta recusou o arquivo (código 4). O tamanho está ok — reconecte o WhatsApp Oficial…

Arquivo PNG ~482 KB / 1080×1080 — tamanho ok.

## Causa raiz
1. **Graph code 4** = *API Too Many Calls* (rate limit da aplicação), não tamanho nem token.
   Doc: https://developers.facebook.com/docs/graph-api/guides/error-handling/
2. O sanitizer de detalhe público tratava `/#\d+/` como genérico e **apagava** a mensagem `(#4) Application request limit reached`.
3. O client Graph fazia até **3 retries** em erro transitório — no code 4 isso só piora a cota.
4. O upload binário enviava `Content-Type: application/octet-stream`; a doc do Resumable Upload usa só `Authorization: OAuth` + `file_offset` + body binário.
   Doc: https://developers.facebook.com/docs/graph-api/guides/upload

## Solução
1. Sanitizer: só descarta `#N` sozinho, não prosa com `(#4) …`.
2. Mensagem específica para codes 4 / 17 / 341 (aguardar minutos; não pedir reconectar).
3. Sem retry imediato nos clients Graph para esses códigos.
4. Remover `Content-Type` no POST binário do resumable upload.

## Validação
- `npm run test:meta-template-ai` — rate limit + sanitizer `#4`.
- `npm run test:meta-phase6` — code 4 sem retry.
- Evidência funcional em produção: após Redeploy, repetir upload; se ainda code 4, a UI deve falar em limite temporário da API (aguardar), não reconectar.

## Marker
`DEPLOY-2026-09-04-131700-template-header-rate-limit-code4`

## Palavras-chave
header-media, código 4, rate limit, Application request limit, sanitizer, resumable upload, retry
