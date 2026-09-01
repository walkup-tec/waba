# Cabeçalho fixo sem campo no front

## Contexto

O campo Cabeçalho não deve aparecer. Todas as três opções enviam o mesmo HEADER de texto.

## Solução

- UI: removido `#meta-tpl-ai-header`.
- Backend: `META_TEMPLATE_AI_FIXED_HEADER_TEXT` = «Informação de utilidade» (grafia correta de «utildade»).
- O valor enviado pelo cliente é ignorado.
- Se a mídia for imagem/vídeo/documento, a Meta aceita um HEADER só — vai a mídia.

Doc: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components

## Palavras-chave

cabeçalho, header, utilidade, fixo
