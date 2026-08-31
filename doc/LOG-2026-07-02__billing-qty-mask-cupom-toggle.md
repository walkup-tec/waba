# LOG — Checkout: máscara qty milheiro + cupom sob demanda

**Data:** 2026-07-02  
**Marker:** `DEPLOY-2026-07-02-billing-qty-mask-cupom-toggle`

## Contexto

Ajustes de UX no tarifador/checkout PIX:

1. Quantidade custom ("Nenhum desses") com máscara de milhar pt-BR (`50.000`).
2. Cupom oculto por padrão; toggle **"Eu tenho cupom de desconto"** revela input + Aplicar.

## Alterações

- `index.html` — `parseDisparosQtyInputValue`, `formatDisparosQtyInputValue`, input text com máscara; `#disparos-billing-coupon-toggle` + panel hidden.
- `src/deploy-marker.ts`

## Validar

1. Tarifador → Nenhum desses → digitar `50000` → exibe `50.000` e total correto.
2. Continuar → checkout sem cupom visível.
3. Marcar "Eu tenho cupom de desconto" → campo cupom aparece.
4. Desmarcar → limpa cupom e valor volta ao list price.

## Palavras-chave

`disparos-pricing-custom-qty`, `disparos-billing-coupon-toggle`, `parseDisparosQtyInputValue`
