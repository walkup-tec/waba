# LOG — editar usuário: nome, e-mail, senha e menus

**Data:** 2026-06-11

## Pedido
No **Editar**, alterar também Nome, e-mail e senha — não só menus.

## Implementação
- `PATCH /admin/users/:id` — `fullName`, `email`, `password` (opcional), `menuPermissions`
- Modal renomeado: `#admin-user-edit-overlay` com formulário completo
- Master: edita dados; menus ocultos (acesso total)
- Staff: dados + checklist de menus

## Arquivos
- `waba-system-user.service.ts`, `repository.ts`
- `waba-admin.routes.ts`, `waba-admin-users.service.ts`
- `index.html`

## Validação
Reiniciar `npm run dev:v02` → Admin → Usuários → Editar.
