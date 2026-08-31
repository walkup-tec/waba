# LOG — Push comunidade imagem: TLS / socket disconnected

**Data:** 2026-06-30

## Erro

```
Falha ao publicar imagem na comunidade (HTTP 500):
... Client network socket disconnected before secure TLS connection was established
```

Instância: `drax-oficial`. E-mail e alertas OK; só imagem na comunidade falhou.

## Causa

1. Evolution tenta baixar imagem pela **URL pública HTTPS** do WABA (`/push/public-media/:id`).
2. Do container Evolution → URL externa falha TLS (rede Docker / certificado / hairpin).
3. Limite anterior de base64 (**900 KB**) fazia imagens PNG maiores (ex. logo ChatGPT) caírem só no fluxo URL → erro TLS.

## Correções

1. **Base64 até 5 MB** — envio inline sem URL para imagens dentro do limite do upload.
2. **Variantes** — base64 puro + `data:image/...;base64,...` (compatibilidade Evolution).
3. **URL interna opcional** — `WABA_PUSH_MEDIA_INTERNAL_BASE_URL` (HTTP na rede Docker, ex. `http://172.17.0.1:30180`).
4. **Detecção TLS/rede/401** — não reportar erro de URL se base64 ainda for opção; retry base64.
5. **Timeout sendMedia** — 60s para imagens grandes.

**Marker:** `DEPLOY-2026-06-30-push-comunidade-imagem-tls-base64`

## Easypanel (opcional)

```env
WABA_PUSH_MEDIA_INTERNAL_BASE_URL=http://172.17.0.1:30180
```

(Ajustar IP/porta do serviço `waba_disparador` no host.)

## Validar

1. Redeploy → marker novo em `/health`.
2. Push com imagem PNG ~1–3 MB + Comunidade → **sent** (não partial).

## Palavras-chave

`push`, `comunidade`, `imagem`, `TLS`, `base64`, `sendMedia`, `WABA_PUSH_MEDIA_INTERNAL_BASE_URL`
