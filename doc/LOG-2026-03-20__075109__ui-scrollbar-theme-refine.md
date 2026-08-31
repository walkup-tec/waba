# LOG - Scrollbars elegantes com paleta do projeto

## Contexto
Solicitação: tornar todas as barras de scroll mais elegantes e alinhadas com a paleta visual atual.

## Ações executadas
- Atualizei CSS global em `index.html` para estilizar scrollbars:
  - suporte Firefox (`scrollbar-width`, `scrollbar-color`)
  - suporte WebKit (`::-webkit-scrollbar*`)
- Aplicado tema com base em:
  - fundo escuro (`rgba(15, 23, 42, ...)`)
  - thumb em gradiente `accent` + `cyan`
  - hover mais vivo
- Executei `npm run build` para propagar para `dist/index.html`.

## Arquivos alterados
- `index.html`
- `dist/index.html` (via build)
- `doc/LOG-2026-03-20__075109__ui-scrollbar-theme-refine.md`

## Como validar
- Abrir `http://localhost:3000/`
- Verificar barras de rolagem em:
  - lista de eventos
  - lista de instâncias
  - qualquer área rolável

## Keywords
- scrollbar-theme
- webkit-scrollbar
- firefox-scrollbar
- ui-palette

