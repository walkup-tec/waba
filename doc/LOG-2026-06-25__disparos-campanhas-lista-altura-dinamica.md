# LOG: Disparos — altura máxima lista de campanhas = cards de saldo/resumo

## Pedido

Listagem de campanhas (API Oficial e Alternativa) com altura máxima igual aos cards de saldo total ao lado (bloco Enviados + Em fila + Saldos).

## Causa

- Implementação anterior usava altura da coluna `.disparos-side-resumo` inteira (título + nudge), deixando a lista mais alta que o bloco de cards.
- `minHeight` forçado alongava a lista mesmo com poucas campanhas.

## Solução

1. **CSS:** `#disparos-list` com scroll interno; sem `max-height` fixo global.
2. **JS:** `syncDisparosCampanhasListLayout()` usa `.disparos-resumo-grid` como referência; só `maxHeight` (sem `minHeight`).
3. **ResizeObserver** no grid, card Saldos, linha Total disponível e nudge de créditos.

Marker: `DEPLOY-2026-06-25-disparos-campanhas-list-height-resumo-grid`

## Validar

Desktop (>992px): API Oficial e Alternativa — lista com scroll, altura máxima alinhada ao bloco de cards de resumo/saldo.
Mobile: lista cresce naturalmente (sem altura forçada).
