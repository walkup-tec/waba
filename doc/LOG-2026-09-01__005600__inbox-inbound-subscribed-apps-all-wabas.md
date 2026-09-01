# LOG — Inbox inbound: subscribed_apps em todas as WABAs

## Contexto

Mensagens do celular pessoal para os 2 números oficiais com Inbox ligado não apareciam no Atendimento.

## Causa

`subscribeWebhooksFromAuth` usava só `findOpenByTenant` (1 conexão). Com 2 portfólios/WABAs, a Meta não encaminhava webhooks da WABA não inscrita.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/  
https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/subscribed_apps/

## Solução

- `pickConnectionsForWebhookSubscribe` — uma conexão por WABA, prioriza `connectionId` / `phoneNumberId`.
- Ao ligar Inbox e em `subscribe-webhooks`: inscreve **todas** as WABAs abertas.
- Abrir Atendimento dispara ensure (throttle 60s).
- Toggle envia `connectionId` do portfólio.

## Marker

`DEPLOY-2026-09-01-005600-meta-inbox-webhook-all-wabas`

## Validação

1. Redeploy EasyPanel `waba_disparador`.
2. Abrir Atendimento (ou religar Inbox nos 2 chips).
3. Mandar 1 mensagem do celular pessoal para cada número oficial.
4. Conversas devem aparecer no Atendimento.

## Palavras-chave

inbox inbound, subscribed_apps, multi-WABA, atendimento
