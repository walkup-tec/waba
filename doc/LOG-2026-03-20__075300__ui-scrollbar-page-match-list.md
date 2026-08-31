# LOG - Barra de rolagem da página igual à lista

## Contexto
Solicitação: deixar a barra de rolagem da página igual à barra de rolagem da lista de itens exibidos.

## Ações executadas
- Ajustei o CSS de scrollbar no `index.html` para unificar estilo entre:
  - `html`, `body`
  - `.list-wrapper`
  - demais áreas roláveis
- Centralizei cores/estados em variáveis CSS:
  - `--scrollbar-track`
  - `--scrollbar-thumb`
  - `--scrollbar-thumb-hover`
- Rodei `npm run build` para atualizar `dist/index.html`.

## Arquivos alterados
- `index.html`
- `dist/index.html` (via build)
- `doc/LOG-2026-03-20__075300__ui-scrollbar-page-match-list.md`

## Como validar
- Abrir `http://localhost:3000/`
- Comparar visual da scrollbar:
  - da página
  - da lista de itens exibidos
- Ambas devem estar com o mesmo estilo e paleta.

## Keywords
- scrollbar-page-list-match
- unified-scrollbar
- ui-consistency

