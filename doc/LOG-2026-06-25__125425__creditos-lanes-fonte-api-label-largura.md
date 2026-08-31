# LOG — Créditos Contratar: fontes, label API no card e largura das lanes

## Contexto

Pedido para aumentar fontes das listas de features, incluir **API Oficial / API Alternativa** com ícone no card de compra (botão Contratar) e ampliar a coluna direita para ficar mais próxima dos hexágonos.

## Solução

1. **Fontes:** features `0.7rem → 0.82rem`; preço `1.1rem → 1.25rem`; mínimo `0.68rem → 0.8rem`.
2. **Card de compra:** bloco `disparos-pricing-lane-action-head` com `waba-api-label` + ícone WhatsApp (oficial) ou foguete (alternativa).
3. **Largura:** grid `1280px` max; hex ~420–480px; lanes com `minmax(420px, 1fr)` e gap reduzido (`18–22px`) para aproximar do desenho hexagonal.

## Arquivos

- `index.html` / `dist/index.html`

## Validar

1. Abrir **Créditos → Contratar créditos**.
2. Conferir labels com ícone nos dois cards de preço.
3. Conferir listas e preços com fonte maior e coluna direita mais larga.

## Palavras-chave

`disparos-pricing-lane-action-head`, `waba-api-label`, `disparos-api-feature-list`, `disparos-pricing-board`
