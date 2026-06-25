# LOG — Créditos Contratar: largura total da página

## Contexto

Pedido para a seção **Contratar créditos** ocupar toda a largura da página, mantendo tamanho da imagem hexagonal e demais configurações (fontes, cards, preços).

## Solução

1. `#disparos-purchase-home` — `width: 100%`, sem `max-width` de 1040px.
2. `.disparos-choice-wrap` — `align-items: stretch`, `width: 100%`, padding lateral removido do wrap.
3. `.disparos-choice-grid` e `.disparos-pricing-benefits` — `max-width: none` (antes 1280px).
4. Hex cluster mantém `max-width: 500px` / `593px` (desktop); coluna de lanes expande no espaço restante.
5. Histórico continua limitado a `1040px` via regra no painel `#disparos-credits-hub-panel-history`.

## Arquivos

- `index.html` / `dist/index.html`

## Validar

1. Créditos → Contratar: board ocupa largura total entre sidebar e borda direita.
2. Imagem hexagonal com mesmo tamanho visual.
3. Listas e botões Contratar inalterados; lanes mais largas em telas grandes.

## Palavras-chave

`disparos-choice-grid`, `disparos-purchase-home`, `disparos-pricing-board`, largura total Contratar
