# LOG — Fase 5 webhook Meta WhatsApp Cloud API

## Contexto

Webhook oficial da Meta para Tech Provider: GET verify, POST com `X-Hub-Signature-256`, tenant por `phone_number_id`/`waba_id`, idempotência e auditoria mínima. Sem envio, templates completos, inbox, commit, push ou deploy.

## Raw body

O parser JSON global do Express **não** é usado no `POST /webhooks/meta/whatsapp`.

Há um parser dedicado (`parseJsonMetaWhatsappWebhook`, limite 1mb) com `verify` que copia o `Buffer` original para `req.rawBody` **antes** do JSON.parse. O HMAC SHA-256 usa esse buffer.

`urlencoded` é ignorado nesse path. Multipart/campanhas/Asaas/Evolution continuam nos parsers anteriores.

## Assinatura

Header `X-Hub-Signature-256` no formato `sha256=<hex>`. HMAC-SHA256(`META_APP_SECRET`, raw body). Comparação timing-safe. Sem header ou mismatch → 403, sem persistir.

## Tenant

Nunca lido do payload. `phone_number_id` (metadata) → conexão `connected`; fallback `waba_id` (entry.id).

## Idempotência

Tabela `meta_whatsapp_webhook_events` com unique em `event_key` (wamid/status/hash). Violação 23505 = duplicado. Resposta HTTP 200.

## Inscrição WABA

`GET/POST /{WABA_ID}/subscribed_apps` com token cifrado da conexão (nunca token do browser). Rota autenticada `POST /integrations/meta/whatsapp/subscribe-webhooks`.

## Arquivos

Ver o relatório da Fase 5 na resposta ao usuário.

## Como validar

```bash
npm run test:meta-phase5
```

SQL: `doc/SQL-2026-08-25__create-meta-whatsapp-webhook-events.sql`

## Segurança

Não loga APP_SECRET, verify token, access token nem texto de mensagem.

## Palavras-chave

meta-webhook, x-hub-signature-256, raw-body, phone_number_id, idempotencia, subscribed_apps, META_WEBHOOK_VERIFY_TOKEN
