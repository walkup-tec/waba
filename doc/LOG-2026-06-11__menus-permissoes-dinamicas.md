# LOG — permissões dinâmicas de menus por usuário

**Data:** 2026-06-11

## Pedido
Ao criar usuário, definir quais menus acessa. Lista dinâmica: novo menu no registry aparece na UI; usuários antigos ficam sem o novo menu até o master habilitar.

## Implementação
- `src/menus/waba-menu-registry.ts` — fonte única de menus (id estável + `data-menu-key` no HTML)
- `src/menus/waba-menu-permissions.service.ts` — resolve permissões; chave ausente = desabilitado
- Usuários: campo `menuPermissions`; legado `null` migra com todos os menus atuais (uma vez)
- APIs: `GET /admin/menus`, `PATCH /admin/users/:id/menus`, `POST /admin/users` com `menuPermissions`
- Sessão/login: `allowedMenuIds` + `menuPermissions` para staff
- UI: checkboxes dinâmicos no criar usuário; botão **Menus** na lista para editar

## Regra novo menu
1. Adicionar entrada em `WABA_MENU_REGISTRY`
2. Adicionar `data-menu-key="..."` no botão do menu no `index.html`
3. Usuários existentes: novo id não está em `menuPermissions` → **bloqueado** até master marcar

## Deploy marker
`DEPLOY-2026-06-11-menus-permissoes-dinamicas-v1`
