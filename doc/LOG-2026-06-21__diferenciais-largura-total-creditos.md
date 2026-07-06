# LOG — Diferenciais largura total na tela de créditos

**Data:** 2026-06-21  
**Pedido:** Cards Seguro / Performance / Flexível devem ocupar toda a barra inferior em toda a extensão da tela (como no layout original).

## Causa

`.disparos-pricing-benefits` estava **dentro** de `.disparos-pricing-board` (grid 2 colunas: hex + lanes), então a barra ficava limitada à coluna direita.

## Correção

- HTML: fechar `disparos-pricing-board` após `disparos-pricing-lanes`; `disparos-pricing-benefits` como **irmão** do board dentro de `disparos-choice-grid`.
- CSS: `disparos-choice-grid` com `display: flex; flex-direction: column; align-items: stretch`.
- Mantida estrutura de `</div>` validada (painéis admin/disparos não aninhados em `tab-disparos-lancamento`).

## Arquivos

- `index.html`
- `dist/index.html` (`npm run build`)

## Validar

Créditos → Contratar: barra inferior com 3 cards em 3 colunas ocupando toda a largura do conteúdo (abaixo do hex + lanes).

## Palavras-chave

`disparos-pricing-benefits`, `disparos-choice-grid`, `disparos-pricing-board`, diferenciais largura total
