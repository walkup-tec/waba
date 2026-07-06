# LOG — Validação CONFIRMAR receive-ok + walkup mozart 5197462102

**Data:** 2026-07-01

## Problema

Passo 3 travava em timeout sem detectar CONFIRMAR; produção ainda em marker antigo (`DEPLOY-2026-06-21-*`) porque **Docker usa `dist/` do Git** e o commit anterior não incluiu `dist/`.

## Correções

1. Detecção `messages.records` (Evolution v2) + `findChats` com janela 120s
2. Recepção OK libera integração mesmo se `sendText` falhar (timeout/Bad Request)
3. Botão **「Já enviei CONFIRMAR」** → `GET validacao-inbound/:id?nudge=2`
4. `startInboundValidation` não bloqueia POST; espera `open` no loop
5. Webhook `MESSAGES_UPSERT` configurado em `walkup` → `https://waba.draxsistemas.com.br/webhooks/evolution`

## Instância mozart

- EVO: `walkup` — `555197462102@s.whatsapp.net` (5197462102)
- Estado no teste: `connecting` (precisa escanear QR após `/instance/connect/walkup`)
- Webhook walkup: HTTP 201 OK

## Teste local (simulação webhook)

`drax-oficial`: receive + send → **phase completed** em &lt;1s (send liberado por fallback técnico).

## Deploy

Marker: `DEPLOY-2026-07-01-validacao-confirmar-receive-ok`

**Obrigatório:** `npm run build` + commit **`dist/`** + redeploy **Easypanel** `waba_disparador` (FTP sozinho não atualiza Node).

## Palavras-chave

`validacao-confirmar`, `walkup`, `5197462102`, `mozart`, `dist-commit`, `easypanel-redeploy`
