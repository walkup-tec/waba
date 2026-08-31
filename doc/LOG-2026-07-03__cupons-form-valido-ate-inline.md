# Cupons — «Válido até» inline no formulário

## Problema

Com validade «Personalizada», o campo «Válido até» aparecia abaixo do select «Validade», quebrando linha.

## Solução

- «Válido até» virou 4ª coluna do grid (`admin-coupon-until-field`), irmão dos demais campos.
- Grid dedicado em `#admin-coupons-create-form` com 4 colunas e `align-items: end`.
- Oculto com `[hidden]` quando validade não é personalizada.

## Arquivo

- `index.html`

## Palavras-chave

`admin-coupon-valid-until`, `admin-coupons-create-form`, validade personalizada
