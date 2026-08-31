# LOG — Validação inbound-first no modal de instância

**Data:** 2026-06-08  
**Pedido:** Substituir teste automático perigoso por validação segura (receber CONFIRMAR → responder na mesma conversa).

## Implementado

### Backend (`src/instance-inbound-validation.service.ts`)

- `POST /instancias/:name/validacao-inbound` — inicia validação na instância conectada.
- `GET /instancias/validacao-inbound/:validationId` — polling de status.
- Webhook `MESSAGES_UPSERT` em `/webhooks/evolution` também alimenta validação.
- Fluxo:
  1. Aguarda mensagem **CONFIRMAR** de celular de referência (webhook + findMessages).
  2. Espera 4s (`INBOUND_VALIDATION_REPLY_DELAY_MS`).
  3. Responde **somente** para quem enviou CONFIRMAR (mesma conversa).
- `restrictionSuspected` só se Evolution recusar a **resposta** com sinais de ban.
- Timeout padrão 5 min.

### Front (`index.html`)

- Após QR `open` → inicia validação automaticamente (sem envio frio).
- Painel com 2 etapas: Recepção / Resposta.
- Instrução: enviar CONFIRMAR para o número da instância.
- Botão **Pular validação (não recomendado)** com confirmação.
- Marker UI: `DEPLOY-2026-06-08-validacao-inbound-v1`.

### Env

- `WABA_PUBLIC_BASE_URL` — webhook (produção); sem ela usa polling findMessages.
- `INBOUND_VALIDATION_KEYWORD`, `INBOUND_VALIDATION_TIMEOUT_MS`, `INBOUND_VALIDATION_REPLY_DELAY_MS`.

## Validação

- `npm run build` OK.
- Testar local: `npm run dev:v02` + número de teste + celular referência envia CONFIRMAR.

## Pendências

- Deploy produção quando aprovado.
- Em dev local, configurar `WABA_PUBLIC_BASE_URL` apontando para URL pública (ou confiar no polling).
