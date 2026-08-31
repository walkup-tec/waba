# LOG — Push comunidade: imagem HTTP 500 / Axios 401

**Data:** 2026-06-30

## Problema

Push parcial na comunidade com imagem:

```
Falha ao publicar imagem na comunidade (HTTP 500):
{"status":500,"error":"Internal Server Error","response":{"message":["AxiosError: Request failed with status code 401"]}}
```

Texto/e-mail ok; só a imagem na comunidade falhava.

## Causa raiz

1. **`GET /push/public-media/:id`** é usado pela Evolution para baixar a imagem via URL pública.
2. A rota estava **atrás** de `wabaRequireAuthMiddleware` e **não** estava em `isAuthBypassPath`.
3. Evolution busca sem cookie de sessão → WABA responde **401** → Evolution devolve **500** com Axios 401.

## Correções

1. **`src/auth/waba-auth.routes.ts`**
   - Bypass de auth para `GET /push/public-media/:id` (rota pública para Evolution).

2. **`src/push/waba-push-community.service.ts`**
   - `resolvePublicMediaUrl` inclui `BASE_PATH` quando aplicável (V01/V02).
   - Envio de mídia: **base64 primeiro** (até ~900 KB); URL pública como fallback.
   - Detecção de erro 401/unauthorized na resposta da Evolution.

3. **Deploy marker:** `DEPLOY-2026-06-30-push-comunidade-imagem-401-fix`

## Validar

1. Redeploy Easypanel → `/health` com marker novo.
2. `curl -I https://waba.draxsistemas.com.br/push/public-media/<uuid>` → **200** (sem cookie).
3. Admin → Push com imagem + Comunidade → status **sent** (não partial).

## Palavras-chave

`push`, `comunidade`, `imagem`, `401`, `public-media`, `sendMedia`, `Evolution`
