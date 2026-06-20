# LOG — fix UI Admin Usuários (card + checkboxes)

**Data:** 2026-06-11

## Problema
Card desalinhado; checkboxes de menus como blocos brancos grandes (CSS `.aquecedor-field input` aplicado a `type=checkbox`).

## Correção
- `index.html`: form em grid 4 colunas + bloco menus separado; padding painel admin
- Checkboxes com tamanho 16px e hover na opção
- `.aquecedor-field input` exclui checkbox/radio
