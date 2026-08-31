# LOG — Modais com conteúdo centralizado

**Data:** 2026-06-21  
**Tipo:** ux  
**Palavras-chave:** modais, confirm-overlay, text-align, centralização

## Pedido

Todos os modais do sistema devem ter conteúdo alinhado de forma centralizada.

## Solução

Regras globais em `index.html`:

- `.confirm-overlay`: padding safe-area, `overflow-y: auto`, modal sempre centrado na viewport.
- `.confirm-modal`, `.confirm-title`, `.confirm-text`: `text-align: center`.
- `.confirm-actions`, `.register-actions`, `.waba-support-actions`, `.dis-warmth-warning-actions`, `.waba-forgot-actions`: botões centralizados.
- Exceção: formulários, tabelas e dashboards dentro de modais mantêm `text-align: left` e largura 100% (legibilidade).
- Correções pontuais: `#admin-user-edit-overlay` (removido `flex-start`), relatório campanha mobile (removido bottom sheet `flex-end`), cabeçalho suporte centralizado.

## Arquivos

- `index.html`
- `dist/index.html`

## Validar

Abrir modais: exclusão instância, aquecimento incompleto, suporte, billing, wizard registro, editar usuário — título/texto/ações centralizados; campos de formulário legíveis à esquerda.
