# LOG — Fix Salvar alterações (editar usuário)

**Data:** 2026-06-11  
**Contexto:** Ao clicar em "Salvar alterações" no modal de edição de usuário, o modal permanecia aberto.

## Causa raiz

1. **API:** O processo `dev:v02` estava rodando desde antes da rota `PATCH /admin/users/:id` ser adicionada. Requisições retornavam `404 Cannot PATCH /version-02/admin/users/:id`.
2. **Frontend:** Modal alto (checklist de menus) sem scroll; botões podiam ficar fora da área clicável em telas menores.
3. **Build:** `dist/admin/waba-admin.routes.js` não tinha `PATCH /admin/users/:id` (só `/menus`).

## Alterações

- `index.html`: overlay com scroll, footer sticky, form `novalidate`, botão Salvar como `type="submit"` dentro do form.
- `src/deploy-marker.ts`: `DEPLOY-2026-06-11-admin-editar-usuario-save-fix-v1`
- `npm run build` — dist atualizado.

## Validação

- Reinício `npm run dev:v02`
- `PATCH /version-02/admin/users/:id` → **200** com sessão master

## Pendências

- Usuário: hard refresh (Ctrl+F5) em `http://localhost:3012/version-02/` e testar editar usuário.
- Deploy Easypanel quando solicitar commit.
