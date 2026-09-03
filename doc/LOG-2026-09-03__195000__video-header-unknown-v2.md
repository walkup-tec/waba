# LOG — Vídeo header-media ainda unknown (v2)

## Sintoma

F12 `POST .../templates/ai/header-media` continua:

```json
{"ok":false,"error":"Não foi possível concluir a conexão. Tente novamente.","code":"unknown"}
```

Produção no marker `193200` (já incluía o fix `191200`), mas o fallback ainda engolia falhas opacas (`fetch failed` + `cause`, Buffer pooled, AbortError sem texto útil).

## Correção v2

1. `toPublicMetaError`: lê `cause`; trata ECONNRESET/UND_ERR/AbortError por nome; **não** devolve mais `code: unknown` no upload.
2. Upload resumable: body = `new Uint8Array(bytes)` (ArrayBuffer próprio).
3. Multer: limite 20 MB + mensagem clara `LIMIT_FILE_SIZE`.

Marker: `DEPLOY-2026-09-03-195000-video-header-unknown-v2`

## Validar

```bash
npm run test:broadcast-header
curl -sS https://waba.draxsistemas.com.br/health | python3 -c 'import json,sys; print(json.load(sys.stdin).get("deployMarker"))'
```

Após Redeploy: Response JSON deve trazer causa real (`template_upload_failed`), não `unknown`.

## Palavras-chave

header-media, unknown, vídeo, ECONNRESET, cause, Uint8Array, multer
