# LOG — Tela de Saldos não reconcilia PIX pago

## Contexto
Produção já no marker `DEPLOY-2026-09-07-124800-asaas-webhook-pix-paid`. Tela do Cleison (`cleison.fel@gmail.com`) continuava **1.849 disponíveis / 0 bonificados**. `waba-billing-orders.json` sem escrita desde **2026-09-05T19:26:22Z**.

## Causa
A tela Saldos chama `GET /billing/disparos/credits`. Esse endpoint **não** consultava o Asaas. Só o poll do QR (`GET /billing/disparos/orders/:id`) fazia `reconcileOrderPayment`. O webhook deste PIX já tinha sido aceito como HTTP 200 (ignorado), então o Asaas não reenviou.

`pendingBonus` zerava se um grant admin expirado tivesse `bonusShipmentsApplied: 829`.

## Correção
- `GET /billing/disparos/credits` e `/purchases` chamam o reconcile existente dos pedidos `pending_payment` daquele e-mail.
- `getPendingShipments` não conta bônus aplicado em pedido inativo/expirado.

Marker: `DEPLOY-2026-09-07-131800-credits-pix-reconcile`.

## Teste
`npm run test:asaas-pix-paid` (4 casos).

## Deploy
Push GitHub `master` + Redeploy EasyPanel `waba_disparador`. Depois o assinante atualiza a tela Saldos (F5). Esperado: 1.849 + 5.000 + 829 = **7.678** se o PIX 5.000 confirmar no Asaas.
