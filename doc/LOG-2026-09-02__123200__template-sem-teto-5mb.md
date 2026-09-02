# LOG — Sem teto local de 5 MB no cabeçalho de template

## Contexto

O Enviar para META recusava JPEG/PNG acima de 5 MB antes de chamar a Graph.

## Solução

Removido o `IMAGE_MAX_BYTES` no upload de cabeçalho. O multer do endpoint continua em 16 MB (vídeo/documento). Foto de perfil do chip permanece 5 MB.

Doc de mídia da Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/ — JPEG/PNG listados com 5 MB. A Graph ainda pode recusar arquivo grande.

## Como validar

```bash
npm run test:meta-template-ai
```

Após Redeploy: PNG > 5 MB e ≤ 16 MB deve chegar à Meta. Marker: `DEPLOY-2026-09-02-123200-template-sem-teto-5mb`

## Palavras-chave

template, cabeçalho, 5 MB, IMAGE_MAX_BYTES, header-media
