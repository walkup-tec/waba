# Master menu — destaque discreto de registros novos

## Contexto
Badge branca no menu indica N novos itens, mas ao abrir a tela não era óbvio qual registro era novo.

## Solução
- API `GET/POST /admin/master-menu-badges` passa `seenAt` por menu.
- Ao abrir aba com badge > 0, captura baseline `seenAt` antes de marcar como visto.
- Linhas novas recebem faixa lateral âmbar + tag **Novo** (mesmos critérios do contador).

## Menus
| Menu | Destaca |
|------|---------|
| Assinantes | `createdAt` > visto |
| Campanhas | `createdAt` > visto |
| Usuários | `createdAt` > visto |
| Financeiro | pedidos `pending_payment` com `createdAt` > visto |
| Chamados | abertos com `openedAt` > visto |

## Arquivos
- `src/admin/waba-admin-master-menu-badges.service.ts`
- `src/admin/waba-admin.routes.ts`
- `index.html`

## Validar
Badge 1 em Assinantes → abrir tela → linha nova com faixa âmbar e «Novo».
