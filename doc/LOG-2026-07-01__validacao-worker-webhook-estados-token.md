# Validação CONFIRMAR — worker + webhook + estados + token único

## Contexto

Rearquitetura da validação inbound (passo 3 do wizard) conforme análise: webhook não é síncrono; detecção deve ser redundante (webhook OU worker); botão «Sim, já enviei» só muda estado; nunca sucesso sem `markInboundReceived` real; remover bypass `completeValidationForNewEmptyInbox`.

## Solução implementada

### Backend (`src/instance-inbound-validation.service.ts`)

1. **Estados explícitos:** `waiting_confirm` → `user_confirmed_sent` → `confirm_received` → `reply_sent` → `validated` | `failed` | `expired`.
2. **Worker global** a cada 2s (`INBOUND_VALIDATION_WORKER_MS`) processa todas as validações ativas:
   - Alterna `findMessages` / `findChats` por tick.
   - Cache de consulta 2s (`INBOUND_VALIDATION_POLL_CACHE_MS`); invalidado no webhook.
   - Após `confirm_received`, envia resposta (`sendContextualReply`) e confirma no histórico.
3. **Webhook** apenas notifica: parse evento, match keyword, `markInboundReceived(..., "webhook")` — sem polling na rota HTTP.
4. **`ensureInstanceWebhook`** restaurado no `startInboundValidation` (eventos `MESSAGES_UPSERT`).
5. **`POST confirmar-envio`** só define `user_confirmed_sent` + invalida cache — sem loops de pull.
6. **Token único por validação:** `CONFIRMAR WABA-{6 dígitos}` — sem grace/timestamp quando há token.
7. **Removido** `completeValidationForNewEmptyInbox`, `receivePullOnly`, loops por request HTTP.

### Frontend (`index.html`)

1. QR conectado → `startRegisterInboundValidation` (validação obrigatória).
2. Removidos bypasses «concluir sem validar» em timeout/erro/falha.
3. Botão «Sim, já enviei» registra envio; detecção fica no worker + poll GET status.
4. Skip oculto (`skip: false` em todo o fluxo passo 3).

### Deploy marker

`DEPLOY-2026-07-01-validacao-worker-webhook-estados`

## Arquivos alterados

- `src/instance-inbound-validation.service.ts`
- `src/deploy-marker.ts`
- `index.html`

## Como validar

1. `npm run build`
2. Redeploy Easypanel + conferir `GET /health` → marker acima.
3. Integrar instância teste (7943, 2477, 1321):
   - Após QR, passo 3 mostra keyword `CONFIRMAR WABA-XXXXXX`.
   - Enviar mensagem exata do outro WhatsApp.
   - «Sim, já enviei» não deve bloquear UI com 8 pulls.
   - Sucesso só com `receiveTest.detail` contendo `(webhook)` ou `(findMessages)` ou `(findChats)`.
   - Inbox vazio **não** deve liberar integração.

## Palavras-chave

validação inbound, worker 2s, webhook notificação, CONFIRMAR WABA token, user_confirmed_sent, completeValidationForNewEmptyInbox removido
