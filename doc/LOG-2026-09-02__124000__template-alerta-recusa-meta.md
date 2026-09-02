# LOG — Alerta da Meta no upload de cabeçalho

## Contexto

O Arquivo da mídia do template não deve ter teto nosso. Se a Graph recusar (tamanho, MIME, etc.), o alerta deve mostrar a recusa da Meta.

Limite oficial de imagem JPEG/PNG: 5 MB.
https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/

## Solução

- Multer do `header-media` sem `fileSize`.
- Texto público a partir de `error_user_msg` / `message` da Graph.

## Como validar

```bash
npm run test:meta-template-ai
```

Marker: `DEPLOY-2026-09-02-124000-template-alerta-meta`

## Palavras-chave

template, header-media, 5 MB, alerta Meta, error_user_msg
