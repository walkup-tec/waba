# LOG - Refino de layout (sutil/elegante) com abas sublinhadas

## Contexto
Solicitação do usuário:
- Adotar linha visual sutil e elegante
- Navegação de páginas no estilo "aba ativa sublinhada" (sem botões pesados)
- Revisar e melhorar o layout geral nessa direção

## Ações executadas
- Refino visual no `index.html`:
  - fundo e superfícies mais sóbrias
  - painéis/cards menos carregados
  - navegação `Dashboard` / `Instâncias` com underline da aba ativa
  - seção de navegação com rótulo `Páginas`
  - drawer mobile também simplificado
- Build:
  - `npm run build` para atualizar `dist/index.html`

## Solução implementada
1. Navegação de páginas
   - Converti tabs para estilo texto + borda inferior:
     - estado ativo: sublinhado roxo (`#8b5cf6`)
     - sem bordas/pílulas pesadas
   - Incluí rótulo `Páginas` no desktop para hierarquia semelhante ao exemplo enviado.

2. Estética geral (sutileza)
   - Reduzi glow e contraste excessivo no fundo.
   - Painéis e cards com sombras mais leves e superfícies mais limpas.
   - Títulos de painel com tipografia menos agressiva (sem all-caps).

3. Mobile
   - Drawer de menu com bordas discretas e linhas divisórias simples.
   - Mantida responsividade existente.

## Arquivos alterados
- `index.html`
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-20__074810__ui-refine-subtle-elegant-underline-tabs.md`

## Como validar
- Abrir `http://localhost:3000/`
- Verificar:
  - guia ativa sublinhada
  - layout mais sóbrio e limpo
  - navegação mobile no drawer

## Keywords
- subtle-elegant-ui
- underline-tabs
- page-navigation
- mobile-drawer-refine

