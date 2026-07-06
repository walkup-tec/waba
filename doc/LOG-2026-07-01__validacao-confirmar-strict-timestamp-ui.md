# Validação CONFIRMAR — timestamp estrito + UI passo 3

## Contexto

No passo 3 do wizard (Validar envio/recepção), o usuário reportou:

1. **Falso positivo:** "Recepção da mensagem OK" aparecia sem ter enviado CONFIRMAR.
2. **UI redundante:** banner "Aguardando resposta automática…" + linha "Resposta automática — Processando" repetiam a mesma informação.

## Causa raiz

- `findInboundViaApi` e `findInboundViaRecentChats` aceitavam hits com `requireTimestamp: false` e fallback sem `minTimestamp`, pegando CONFIRMAR antigo no histórico (`findMessages` / `messages.records`).
- Webhook usava `requireTimestamp: false` com janela de 20s solta.
- UI exibia `#register-inbound-waiting` (STEP2) ao mesmo tempo que a linha de checklist "Resposta automática".

## Solução

### Backend (`src/instance-inbound-validation.service.ts`)

- `inboundKeywordSearchOptions()` centraliza filtro: `minTimestampMs = validationStartedAt - grace` (15s normal, 60s agressivo) + **`requireTimestamp: true`**.
- `isInboundHitFresh` rejeita hits sem timestamp quando há `minTimestampMs`.
- `findInboundViaApi` / `findInboundViaRecentChats` usam só `searchOpts` estrito — removidos fallbacks loose/fallback sem timestamp.
- Polling normal usa `aggressive: false`; nudge/expire mantêm `aggressive: true`.
- Webhook usa `inboundKeywordSearchOptions(record.validationStartedAtMs)`.

### Frontend (`index.html`)

- Quando `receiveOk && !sendDone`, **oculta** `#register-inbound-waiting` e mantém só a linha "Resposta automática — Processando".

### Deploy marker

- `DEPLOY-2026-07-01-validacao-confirmar-strict-timestamp`

## Arquivos alterados

- `src/instance-inbound-validation.service.ts`
- `index.html` → `dist/index.html` (via build)
- `src/deploy-marker.ts`
- `dist/index.js` (tsc)

## Como validar

1. `npm run build`
2. Iniciar validação no wizard passo 3 **sem** enviar CONFIRMAR → recepção deve permanecer "Processando", não "OK".
3. Enviar CONFIRMAR de outro WhatsApp → recepção OK → só a linha "Resposta automática" com Processando (sem banner duplicado).
4. Produção: `/health` → `deployMarker` após redeploy Easypanel.

## Palavras-chave

`validacao-inbound`, `CONFIRMAR`, `false-positive`, `requireTimestamp`, `inboundKeywordSearchOptions`, `register-inbound-waiting`, `strict-timestamp`
