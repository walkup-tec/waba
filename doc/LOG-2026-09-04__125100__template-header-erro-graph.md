# LOG — Template header-media: código Graph sem culpar tamanho

## Contexto
Upload de PNG 482 KB / 1080×1080 falhava com `template_upload_failed` e texto genérico pedindo para reduzir a imagem.

## Causa
Fallback de `publicMetaGraphMediaUploadMessage` quando a Graph não devolve `error_user_msg` útil.

## Solução
1. Incluir `código` / `subcódigo` Graph na mensagem pública.
2. Se `fileBytes < 5 MB`, não sugerir “reduza a imagem”; orientar reconectar / tentar de novo.
3. Log `header-media-error` com `graphCode` / `graphSubcode` / bytes.

## Validação
- Testes do assistente de templates (incl. casos novo).
- Após Redeploy: repetir upload do PNG e ler a mensagem no Network (deve trazer código Graph se a Meta recusar de novo).

## Marker
`DEPLOY-2026-09-04-125100-template-header-graph-error-codes`

## Palavras-chave
header-media, template_upload_failed, graph code, 5 MB, fallback, PNG
