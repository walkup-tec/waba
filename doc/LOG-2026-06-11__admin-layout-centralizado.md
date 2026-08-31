# LOG — centralizar card Admin na área útil

**Data:** 2026-06-11

## Solicitação
Card **Admin · Usuários** aparecia no canto superior direito; centralizar na tela disponível (à direita da sidebar).

## Alterações
- `index.html`: CSS `body.admin-section-active` — `#waba-main` com flex + `align-items: center`; tab-panel admin com `max-width` e `margin-inline: auto`; ajuste de largura com sidebar colapsada/expandida.
- `src/deploy-marker.ts`: `DEPLOY-2026-06-11-admin-layout-centralizado-v1`

## Validação
- Recarregar `http://localhost:3012/version-02/` (Ctrl+F5) → Admin → Usuários
- Conferir card centralizado com sidebar colapsada e expandida

## Pendências
- Commit/deploy se aprovado pelo usuário
