# Validação CONFIRMAR — pull-only sem webhook

**Data:** 2026-07-01  
**Marker:** `DEPLOY-2026-07-01-validacao-confirmar-pull-only-sem-webhook`

## Problema

Webhook + polling automático na recepção CONFIRMAR geravam demoras de **3–5 minutos** (ex.: `5181082477`), com comportamento imprevisível. O desenho desejado é: **usuário avisa que enviou → sistema consulta Evolution (pull) → detecta CONFIRMAR → continua**.

## Causa

Três caminhos competindo na recepção:

1. Webhook `MESSAGES_UPSERT` (push)
2. Loop backend a cada 280ms (`findMessages` + `findChats`)
3. Pull sob demanda (`POST confirmar-envio` após «Sim»)

O webhook **não era necessário** no wizard e, quando falhava ou competia com poll lento (@lid), o usuário ficava minutos em «Processando».

## Solução

### Backend (`instance-inbound-validation.service.ts`)

- `receivePullOnly: true` em toda validação do wizard.
- **Removido** `ensureInstanceWebhook` no `startInboundValidation`.
- `handleInboundValidationWebhook` → **no-op** para validação CONFIRMAR (probe/aquecedor continuam em `handleEvolutionWebhookPayload`).
- **Sem polling de recepção** no loop — só timer de expiração + checagem de conexão.
- Após recepção (pull): `runValidationSendFollowUpLoop` para resposta automática.
- `confirmUserSentInbound`: **8 tentativas** deep+agressivas (antes 4).

### API (`index.ts`)

- `GET /validacao-inbound/:id` — **só lê status** (sem `?nudge` em background).

### Frontend (`index.html`)

- Poll sem `?nudge=1|2`.
- Após «Sim»: `POST confirmar-envio` a cada ~3s (`pollTick % 10` × 300ms).

## Fluxo novo

```
Passo 3 inicia → aguarda usuário enviar CONFIRMAR
Usuário clica «Sim, já enviei» → POST confirmar-envio → findChats.lastMessage + findMessages (pull)
CONFIRMAR encontrado → resposta automática → passo 4
```

## Arquivos

- `src/instance-inbound-validation.service.ts`
- `src/index.ts`
- `index.html`, `dist/`
- `src/deploy-marker.ts`

## Validar

1. `npm run build`
2. Integrar instância → passo 3 → enviar CONFIRMAR → **Sim** → recepção OK em poucos segundos (sem depender de webhook).
3. `/health` → `deployMarker` = `DEPLOY-2026-07-01-validacao-confirmar-pull-only-sem-webhook`
4. Redeploy Easypanel (Node), não só FTP.

## Palavras-chave

`validacao-inbound`, `CONFIRMAR`, `pull-only`, `sem-webhook`, `confirmar-envio`, `5181082477`
