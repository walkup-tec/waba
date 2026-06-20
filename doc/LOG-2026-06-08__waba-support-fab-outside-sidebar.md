# LOG — FAB Suporte fora da sidebar

**Data:** 2026-06-08  
**Contexto:** Usuário reportou que o botão `?` continuava visualmente dentro do menu lateral.

## Causa
O FAB usava `left: 20px` fixo no viewport — mesma faixa horizontal da sidebar (`left: 14px`, largura 70–220px).

## Correção
- CSS desktop: `left` calculado à direita da sidebar (`14px + largura + 14px`).
- JS `syncWabaSupportFabPosition()`: mede `getBoundingClientRect().right` da `.waba-sidebar-stack`.
- Chamado em: mount, toggle sidebar, resize, visibilidade.
- Marker: `DEPLOY-2026-06-08-waba-support-fab-outside-sidebar`.

## Arquivos
- `index.html` — CSS + JS
- `src/deploy-marker.ts`

## Validação
- `npm run build` OK
- Dev: http://localhost:3012/version-02/ + Ctrl+F5

## Pendências
- Deploy produção (commit/push) se ainda não feito.
