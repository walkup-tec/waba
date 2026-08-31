# LOG — Validação CONFIRMAR: detecção + retry + número wa.me

**Data:** 2026-06-30  
**Marker:** `DEPLOY-2026-06-30-validacao-inbound-confirmar-detect-fix`

## Sintoma

Passo 3 expirava com:
- «Tempo esgotado sem receber CONFIRMAR no número da instância»
- «Resposta não testada — recepção não confirmada»

## Causas

1. `findMessages` com poucos fallbacks e `requireTimestamp` rígido demais.
2. Webhook usava só `WABA_PUBLIC_BASE_URL` env (não `resolveWabaPublicBaseUrl`).
3. Sem reinício da validação após falha no modal.
4. Timeout backend 5 min; poll 800ms.

## Solução

### Backend (`instance-inbound-validation.service.ts`)

- `findInboundViaApi`: URLs `/chat/` e `/message/`, mais corpos, relaxamento progressivo de timestamp.
- Webhook: `resolveWabaPublicBaseUrl`, múltiplos endpoints `webhook/set`.
- `handleInboundValidationWebhook`: extrai instância de mais campos; evento `messages.upsert`.
- Timeout default **10 min**; poll **600ms**.
- Mensagens de erro com número formatado.
- `forceRestart` no POST validacao-inbound.

### Frontend

- Número com link `wa.me`.
- Botão «Tentar validação novamente» (`forceRestart`).
- Poll 600ms; envia `registerConnectedInstanceNumber` no POST.

## Validar

1. Redeploy Easypanel → marker novo.
2. Passo 3: número clicável (abre WhatsApp).
3. De **outro celular**, enviar só `CONFIRMAR` para esse número.
4. Em ~1–5s deve marcar recepção OK e resposta automática.

## Palavras-chave

CONFIRMAR, findMessages, validacao-inbound, forceRestart, wa.me
