# Fix — espaço entre contratação e diferenciais (max 20px)

## Problema

Grande vão entre o card de contratação (API Oficial) e a barra Seguro/Performance/Flexível.

## Causa

- `.disparos-pricing-board` com `align-items: center` — coluna de lanes centralizada na altura do hexágono alto.
- `.disparos-pricing-benefits` com `margin-top: 28px`.
- `.disparos-pricing-lanes` com `gap: 40px` e `justify-content: center`.

## Correção (2ª iteração)

- `disparos-pricing-benefits` movido **para dentro** de `disparos-pricing-board` (grid row 2, `row-gap: 0`).
- Barra de diferenciais encosta na **margem inferior da imagem** (fim da linha do hex), não abaixo de um vão extra.
- `column-gap: 12px` entre imagem e coluna de contratação.

## Validar

Créditos → Comprar: no máximo ~20px entre fim do card Contratar e barra de diferenciais.
