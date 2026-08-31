# LOG — Push comunidade: Connection Closed (imagem)

**Data:** 2026-06-30

## Erro

```
Falha ao publicar imagem na comunidade (HTTP 500):
... Error: Connection Closed
```

Comunidade falhava com imagem; texto/e-mail ok. Instância UI: `drax-oficial`.

## Causas

1. **Base64 grande primeiro** — POST enorme para Evolution derrubava conexão HTTP.
2. **URL HTTPS pública** — Evolution (Docker) falhava TLS ao baixar `waba.draxsistemas.com.br`.
3. **Instância WhatsApp** — `Connection Closed` também indica sessão Baileys fechada na instância usada.
4. **Sem fallback** — uma instância só; sem texto se imagem falhasse.

## Correções

1. **URL HTTP interna automática** em produção: `http://172.17.0.1:30180/push/public-media/...` (`WABA_HOST_PUBLISHED_PORT`).
2. **Ordem de envio**: URL interna → URL pública → base64 só imagens ≤ ~300 KB.
3. **Até 3 instâncias** ranqueadas (conectadas primeiro) em erro recuperável.
4. **Retry** sendMedia (2x) + fallback **texto** na comunidade se imagem falhar.
5. **Marker:** `DEPLOY-2026-06-30-push-comunidade-connection-closed-fix`

## Validar após deploy

1. Push Comunidade + imagem PNG ~500 KB → **sent** (via URL interna).
2. Se imagem falhar, comunidade recebe pelo menos o **texto**.
3. Se persistir Connection Closed: reconectar instância `drax-oficial` / `5181077770` na Evolution.

## Palavras-chave

`Connection Closed`, `push`, `comunidade`, `172.17.0.1:30180`, `sendMedia`
