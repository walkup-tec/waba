# LOG — Badges master (ativos novos no menu)

**Data:** 2026-06-08

## Pedido
No ambiente master, tag branca com total de ativos novos nos menus:
- **Admin:** Assinantes, Campanhas, Usuários, Financeiro
- **Suporte:** Chamados abertos novos

## Implementação

### Backend
- `waba-admin-master-menu-badges.repository.ts` — `waba-master-menu-seen.json` por e-mail master
- `waba-admin-master-menu-badges.service.ts` — contagem desde última visita à aba
- Rotas master:
  - `GET /admin/master-menu-badges`
  - `POST /admin/master-menu-badges/seen` `{ menuKey }`
- Bootstrap na 1ª consulta: marca baseline para não inundar histórico

### Critérios de "novo"
| Menu | Conta |
|------|-------|
| admin-assinantes | assinantes com `createdAt` > visto |
| admin-campanhas | campanhas com `createdAt` > visto |
| admin-usuarios | usuários com `createdAt` > visto |
| admin-financeiro | pedidos `pending_payment` com `createdAt` > visto |
| admin-chamados | chamados `open` com `submittedAt` > visto |

### Frontend (`index.html`)
- `.master-menu-new-badge` — pill branca, número escuro
- Badges desktop + mobile drawer
- `refreshMasterMenuBadges()` no login + poll 60s
- `markMasterMenuBadgeSeen()` ao abrir a aba

### Deploy marker
`DEPLOY-2026-06-08-waba-master-menu-badges`

## Validação
- `npm run build` OK
