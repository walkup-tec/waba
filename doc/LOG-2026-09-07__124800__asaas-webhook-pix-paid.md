# LOG — Webhook Asaas descartava PIX pago

## Contexto
Assinante `cleison.fel@gmail.com`: PIX dos 5.000 Oficiais pago no Asaas, saldo local em 1.849 e 829 bonificados pendentes. O fluxo que reconhece PIX (`POST /webhooks/asaas` + poll `GET /billing/disparos/orders/:id`) já existia e não foi substituído.

## Causa
`handleAsaasWebhook` rejeitava o evento **antes** de procurar o pedido pelo `payment.id` quando `externalReference` vinha preenchido sem prefixo `waba:`. O Asaas recebe HTTP 200 mesmo assim (processamento async), então a fila não retenta e o pedido fica `pending_payment`.

Na liquidação, `settlePaidOrder` podia carimbar `bonusSettlementAt` com `bonusShipmentsApplied: 0` e nunca mais aplicar os 829 na compra paga depois da campanha.

## Correção (fluxo existente)
- Webhook: localiza primeiro por `asaasPaymentId`; só ignora `externalReference` não-WABA quando não há `payment.id`.
- `parseWabaOrderIdFromExternalReference` aceita UUID com sufixo e não trata split (`waba:sp:`) como pedido.
- Evento `PAYMENT_RECEIVED_IN_CASH` e `body.type` no parser do webhook.
- Settlement: não usa grant admin como alvo FIFO; não carimba 0 se ainda há bônus pendente.

Marker: `DEPLOY-2026-09-07-124800-asaas-webhook-pix-paid`.

## Teste
`npm run test:asaas-pix-paid` — webhook com `externalReference` estranho credita 5.000 + 829; GET de créditos reliquida pedido já `paid` carimbado em 0.

## Deploy
Push `walkup-tec/waba` `master` → Redeploy EasyPanel `waba_disparador`. Sem Redeploy automático daqui.

Se o PIX deste pedido já foi entregue como 200/ignorado, o Asaas não reenvia. Depois do deploy: abrir o QR/pedido (poll existente) ou reenviar o webhook no painel Asaas. GET de créditos aplica os 829 se o pedido já estiver `paid`.

## Keywords
asaas, webhook, PIX, PAYMENT_RECEIVED, externalReference, bonus settlement, cleison
