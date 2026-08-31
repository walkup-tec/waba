# LOG — Gerar PIX sem resposta no checkout de créditos

## Contexto
Na tela Contratar créditos (API Alternativa), clicar em Gerar PIX não gerava o QR e não mudava o botão.

## Causa
- Overlay de billing em z-index 2600, abaixo do FAB de suporte (4999) — o clique podia não chegar no botão.
- `Gerar PIX` era `disabled` quando o pacote ficava vazio num sync, mas o texto continuava «Gerar PIX» e o valor R$ 200 permanecia na tela.
- `syncDisparosBillingModalState` recebia uma Promise ao desmarcar cupom (`configured` virava false).

## Solução
- Billing/PIX em z-index 5320; FAB some enquanto o modal está aberto.
- Com o modal aberto, o botão só desabilita durante «Gerando PIX…».
- Erro visível no próprio modal.
- Sync de cupom aguarda o config de verdade.

## Marker
`DEPLOY-2026-08-14-gerar-pix-click`

## Como validar
Créditos → API Alternativa → 1.000 envios → preencher dados → Gerar PIX. O botão deve ir para «Gerando PIX…» e abrir o QR. Se falhar, a mensagem aparece no modal.
