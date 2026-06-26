# LOG — Encurtador URL pública em produção (sem localhost)

## Problema

Em produção, **Testar encurtador** gerava `http://localhost:80/s/...` — URL inválida para disparo de mensagens.

## Causa

`resolveWabaShortPublicBase()` em `waba-shortener.service.ts` caía em `http://localhost:${PORT}` quando `WABA_SHORT_PUBLIC_BASE` não estava definido, ignorando `WABA_PUBLIC_BASE_URL` e headers do proxy.

## Solução

1. Novo módulo `src/lib/waba-public-base-url.ts` com cadeia de fallback:
   - `WABA_SHORT_PUBLIC_BASE` / `BASE_SHORT_DOMAIN` / `WABA_SHORTENER_PUBLIC_BASE`
   - `WABA_PUBLIC_BASE_URL` / `WABA_WEBHOOK_BASE_URL` / `WABA_APP_LOGIN_URL`
   - Host de `X-Forwarded-Host` / `Host` (requisições via Traefik)
   - Cache em memória da base inferida por requisição
   - `localhost` **somente** em `v01`/`v02`/development
2. `POST /disparos/shorten` passa hints da requisição ao encurtador WABA.
3. `/health` expõe `shortPublicBase: { configured, base, source }`.
4. `.env.example` documenta `WABA_SHORT_PUBLIC_BASE=https://waba.draxsistemas.com.br`.

## Easypanel (recomendado)

Definir pelo menos uma:
- `WABA_SHORT_PUBLIC_BASE=https://waba.draxsistemas.com.br`
- ou `WABA_PUBLIC_BASE_URL=https://waba.draxsistemas.com.br`

## Validar

1. Deploy marker `DEPLOY-2026-06-26-shortener-url-publica-producao`.
2. `GET /health` → `shortPublicBase.configured: true`, base sem localhost.
3. Disparador → Testar encurtador → URL `https://waba.draxsistemas.com.br/s/...`.

## Palavras-chave

`shortener`, `localhost`, `WABA_SHORT_PUBLIC_BASE`, `WABA_PUBLIC_BASE_URL`, `/s/`, `encurtador`
