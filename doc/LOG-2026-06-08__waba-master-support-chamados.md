# LOG — Master: seção Suporte · Chamados

**Data:** 2026-06-08

## Solicitação
No ambiente master, criar seção **Suporte** com menu **Chamados**, abas Pendentes/Atendidos, lista com datas, assinante, título, anexos e modal de detalhes com resposta e finalização.

## Alterações

### Menu
- `waba-menu-registry.ts`: seção `suporte`, menu `admin-chamados`

### Backend
- Ticket: `title`, `masterResponse`, `closedAt`, `closedByEmail`, suporte a anexo `image`
- `waba-admin-support.service.ts` + rotas em `waba-admin.routes.ts`:
  - `GET /admin/support/tickets?bucket=open|closed`
  - `GET /admin/support/tickets/:id`
  - `PATCH /admin/support/tickets/:id`
  - `GET /admin/support/tickets/:ticketId/attachments/:attachmentId`

### Frontend
- Sidebar **Suporte → Chamados** (somente master)
- Painel com abas e tabela
- Modal de detalhes com resposta e status Em aberto → Finalizado

## Validação
- `npm run build` OK

## Pendências
- Reiniciar `npm run dev:v02` e testar como master
- Deploy Easypanel se solicitado
