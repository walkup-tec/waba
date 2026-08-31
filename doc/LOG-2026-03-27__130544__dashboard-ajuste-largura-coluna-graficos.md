# Contexto do pedido

Usuário solicitou reduzir a largura da área de gráficos no Dashboard para melhorar a distribuição dos cards na coluna esquerda.

# Comandos e ações executadas

1. Ajuste de layout no `index.html` na grid desktop do `#tab-dashboard`.
2. Build:
   - `npm run build`
3. Validação:
   - `ReadLints` em `index.html` sem erros.

# Solução implementada (passo a passo)

1. No breakpoint desktop (`@media (min-width: 992px)`), alterada a proporção da grid:
   - de `1.75fr / 1fr`
   - para `2fr / 0.82fr`
2. Resultado: coluna direita (gráficos) mais estreita e coluna esquerda (cards/lista) mais ampla.

# Arquivos criados/alterados

- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__130544__dashboard-ajuste-largura-coluna-graficos.md` (novo)

# Como validar

1. Abrir Dashboard em desktop.
2. Confirmar que:
   - painéis de gráficos ocupam menos largura;
   - cards e conteúdo da esquerda ficaram mais distribuídos.
3. Validar em telas menores que o comportamento responsivo permanece correto.

# Observações de segurança

- Alteração apenas visual de CSS.
- Sem impacto em processamento de campanhas/aquecedor.

# Itens para evitar duplicação no futuro (palavras-chave)

- dashboard-grid-ratio
- largura-graficos
- cards-esquerda
- ajuste-colunas-desktop
