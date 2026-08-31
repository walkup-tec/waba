# LOG — Ícone atraso = cor ID assinante

**Data:** 2026-06-12  
**Projeto:** Waba (`D:\Waba`)

## Solicitação
Ícone de SLA 6h expirado na tabela Campanhas (master) deve usar a mesma cor rosa/vermelha do texto do ID do assinante (`<code>`), não cinza nem vermelho genérico.

## Alterações
- `index.html`: variável `--admin-subscriber-id-color: var(--bs-code-color, var(--danger))` em `.admin-subscribers-table`
- `code` do ID e `.admin-campanhas-overdue-icon` compartilham essa cor
- Removido `color: #e2e8f0` do ícone

## Comandos
- `node scripts/copy-index-html.mjs` → `dist/index.html`

## Validação
- F5 em `http://localhost:3012/version-02/` como master → Campanhas → campanha com `isStartOverdue` (ex. Campanha Final)

## Pendências
- Commit/deploy só se usuário pedir
