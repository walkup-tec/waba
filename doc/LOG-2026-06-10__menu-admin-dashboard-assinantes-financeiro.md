# Menu ADMIN — Dashboard, Assinantes, Financeiro

**Data:** 2026-06-10

## Pedido
Nova seção **Admin** no menu lateral, com:
- Dashboard
- Assinantes
- Financeiro

## Implementação (`index.html`)
- Grupo `data-menu-group="admin"` no desktop (após API Meta)
- Itens mobile com rótulo **Admin**
- Painéis: `tab-admin-dashboard`, `tab-admin-assinantes`, `tab-admin-financeiro` (placeholder)
- `setActiveTab` + `isAdminTab` (não altera ambiente API não oficial/Meta ao navegar)
- Destaque visual âmbar nos itens ativos da seção Admin

## Pendências
- Conteúdo real das três telas
- Permissão / auth de acesso admin
