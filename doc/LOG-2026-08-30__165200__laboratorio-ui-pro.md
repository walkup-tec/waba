# Laboratório: UI profissional do portfólio

## Contexto do pedido

A tela de portfólios (layout do desenho: cards à esquerda, números do selecionado à direita) estava visualmente amadora — blocos pretos, logo da Meta como placeholder, pills verdes repetidas e estado selecionado fraco.

## Ações executadas

- Skill `frontend-ux-ui-saas-designer` aplicada no `index.html` do Laboratório.
- `node scripts/copy-index-html.mjs`
- `npx tsc` só em `src/deploy-marker.ts`

## Solução implementada

1. Um painel único (rail + números), em vez de dois blocos soltos.
2. Card selecionado com barra verde, fundo suave e nome em destaque; os demais ficam neutros.
3. Painel direito com cabeçalho (nome do portfólio + contagem) e lista com divisores.
4. Status: **Ativo** preenchido; **Disponível** em outline (não dois blobs verdes iguais).
5. Inbox com label e switch separado por um divisor.
6. Sem foto: iniciais no avatar — não usa mais o infinito da Meta.
7. Empty state com orientação para o `+`. Teclado Enter/Espaço seleciona o card.
8. Empilha em telas &lt; 900px.

## Arquivos criados/alterados

- `index.html` / `dist/index.html`
- `src/deploy-marker.ts` / `dist/deploy-marker.js`
- `doc/memoria.md`

## Como validar

- Redeploy EasyPanel (após push). Marker: `DEPLOY-2026-08-30-170000-master-laboratorio-ui-pro`
- Laboratório → Portfólios: um painel, seleção visível, números só do card ativo, `+` no card.
- Sem foto: iniciais, não logo Meta.
- Mobile: colunas empilhadas.

## Observações de segurança

Sem alteração de tokens, Graph ou RLS. Só CSS/markup/acessibilidade.

## Palavras-chave

laboratorio, portfolio-ui, saas-designer, meta-portfolio-shell, empty-state
