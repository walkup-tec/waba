# Frontend UX/UI - Referência Rápida

## Checklist UX para telas financeiras
- O usuário entende exatamente "o que vai acontecer" após clicar em CTAs críticos.
- Números monetários têm formatação e alinhamento consistentes.
- O usuário vê feedback imediato:
  - loading (skeleton/spinner)
  - sucesso (toast/alert + ação sugerida)
  - erro (mensagem clara + como corrigir).
- Se houver tabela/lista:
  - paginação quando necessário
  - estados vazio e "sem resultados" úteis.

## Acessibilidade (baseline prático)
- `label` associado a campos (`htmlFor` / `id`).
- Foco visível em botões/inputs e navegação por teclado funcional.
- Mensagens de erro vinculadas ao campo e legíveis.
- Contraste suficiente (evitar cinzas claros demais para texto).

## Padrões de componentes (sugestões)
- `EmptyState`: quando não há dados e explicar próximo passo.
- `LoadingState`: skeletons ou placeholders do layout real.
- `AlertBanner`: mensagens de erro/atenção acima do conteúdo.
- `ConfirmDialog`: apenas para ações irreversíveis/sensíveis.
- `FormField` + validação: padronizar exibição de erro.

