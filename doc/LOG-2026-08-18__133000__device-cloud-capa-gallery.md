# Device Cloud: capa não aparecia na galeria

## Contexto

Upload da capa (banner ecossistema) pelo botão Capa; a imagem não aparecia na galeria do WhatsApp no celular 6034.

## Causa

1. A API Device Cloud (Nest) usava o limite JSON padrão de ~100 KB. A capa em base64 passava disso e não era gravada. No Android só existia `waba-perfil-*.png` de 11 KB.
2. O arquivo enviado no chat era JPEG com extensão .png.
3. A galeria do WhatsApp lista sobretudo Pictures/DCIM; o push ia só para Download.

## Solução

- Device Cloud: JSON/urlencoded 10 MB; após push, copia para `/sdcard/Pictures/` e dispara media scan.
- WABA: extensão pelo conteúdo (JPEG/PNG/WebP), não pelo nome.
- Capa `waba-capa-ecossistema.jpg` já está em Download e Pictures e no MediaStore (jpeg 71 KB, 1024×574).

## Arquivos

- AWS `/opt/device-cloud/apps/api` `main.ts`/`main.js`
- AWS `adb.client` + `redroid.provider` (`copyToPictures`)
- `src/device-cloud/waba-device-cloud.routes.ts` + dist
- Marker `DEPLOY-2026-08-18-133000-device-cloud-capa-gallery`

## Validação

MediaStore rows 193/194 apontam para `waba-capa-ecossistema.jpg`. Abrir a galeria do WhatsApp e escolher esse arquivo. Uploads novos pelo botão Capa passam a gravar em Pictures depois do marker no WABA.

## Palavras-chave

device-cloud, capa, gallery, MediaStore, Pictures, JSON 100kb, jpeg png
