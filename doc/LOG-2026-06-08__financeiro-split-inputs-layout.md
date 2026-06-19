# LOG — Split: layout dos inputs PIX / rateio

**Data:** 2026-06-08

## Problema
Inputs brancos, labels duplicados (header + linha), alinhamento inconsistente entre Chave PIX e % rateio.

## Solução
- Cabeçalho único com colunas (Usuário master, Chave PIX, % rateio, Ativo).
- Linhas em cards escuros; inputs no padrão `aquecedor-field` (fundo escuro, borda, focus accent).
- Sem labels repetidos no desktop; `aria-label` nos campos.
- `display: contents` nos wrappers para grid 5 colunas no desktop.
- Mobile: labels visíveis, PIX + rateio lado a lado, ações em linha.

## Arquivos
- `index.html` (CSS + `renderAdminFinanceiroSplitParticipants`)
- `dist/index.html` (copy)

## Validar
Ctrl+F5 → Admin → Financeiro → Split de receita.
