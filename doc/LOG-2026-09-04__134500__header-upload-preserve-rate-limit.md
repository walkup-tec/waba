# LOG — Header upload: preservar rate limit (#4) no JSON público

## Sintoma (Network)
```json
{ "ok": false, "error": "A Meta recusou o arquivo. Se for por tamanho, reduza a imagem e tente novamente.", "code": "template_upload_failed" }
```
após Redeploy do fix de messaging code 4.

## Causa raiz (comprovada)
1. Graph ainda responde **código 4** (rate limit da app).
2. `publicMetaGraphMediaUploadMessage` gerava corretamente: `A Meta limitou temporariamente…`.
3. `uploadHeaderMediaFromAuth` só preservava mensagens com prefixo `A Meta recusou` — **descartava** `A Meta limitou…` e caía no fallback genérico de `template_upload_failed` (texto antigo culpando tamanho).

Reprodução local: wrap antigo → JSON idêntico ao Network do usuário.

## Correção
- `wrapMetaHeaderUploadError`: preserva qualquer mensagem `^A Meta\b`.
- Fallback de `template_upload_failed` não culpa tamanho.
- Testes: header-upload-errors + template-ai e2e (`uploadHeaderMediaFromAuth` → `toPublicMetaError`).

## O que NÃO resolve sozinho
A Meta continuar em rate limit (#4) — é preciso aguardar a cota. O fix garante a mensagem correta; não aumenta a cota da Graph.

## Marker
`DEPLOY-2026-09-04-134500-header-upload-preserve-rate-limit`

## Palavras-chave
header-media, template_upload_failed, código 4, rate limit, wrapMetaHeaderUploadError, Se for por tamanho
