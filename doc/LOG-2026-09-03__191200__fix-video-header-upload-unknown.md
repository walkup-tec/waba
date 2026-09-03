# LOG — Fix upload de vídeo no cabeçalho (header-media unknown)

## Evidência

F12 → `POST .../templates/ai/header-media` **400**:

```json
{"ok":false,"error":"Não foi possível concluir a conexão. Tente novamente.","code":"unknown"}
```

O fallback `toPublicMetaError` engolia o erro real (timeout/abort/cópia de Buffer em vídeo grande).

## Correção

1. `toPublicMetaError`: duck-type de `MetaWhatsappError`; AbortError/timeout → mensagem de vídeo ≤ 16 MB.
2. Upload resumable: timeout 5 min para vídeo; body como view do Buffer (sem dobrar RAM).
3. Recusa clara se MP4 > 16 MB; log `header-media-error` na rota.
4. Texto da UI: vídeo MP4 até 16 MB.

Marker: `DEPLOY-2026-09-03-191200-video-header-upload`.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/

## Validar

```bash
npm run test:broadcast-header
curl -sS https://waba.draxsistemas.com.br/health | python3 -c 'import json,sys; print(json.load(sys.stdin).get("deployMarker"))'
```

Após Redeploy: reenviar o MP4 (≤ 16 MB, H.264). O modal deve mostrar o motivo real se falhar.

## Palavras-chave

header-media, unknown, vídeo, timeout, 16 MB, AbortError
