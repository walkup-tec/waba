# LOG — Admin Usuários: Editar e Remover

**Data:** 2026-06-11

## Pedido
Na tabela de usuários, coluna Ações com **Editar** (mesma função do botão Menus) e **Remover** (excluir usuário).

## Alterações
- API `DELETE /admin/users/:id` (só master)
- Regras: não remove master; não remove o próprio usuário logado
- UI: botões Editar + Remover; modal de confirmação para exclusão
- Modal de edição: título "Editar — {nome}"

## Arquivos
- `src/users/waba-system-user.repository.ts` — `deleteById`
- `src/users/waba-system-user.service.ts` — `delete`
- `src/admin/waba-admin.routes.ts`, `waba-admin-users.service.ts`
- `index.html`

## Validação
Reiniciar `npm run dev:v02` → Admin → Usuários → Editar / Remover em usuário operacional.
