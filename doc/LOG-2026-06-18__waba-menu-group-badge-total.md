# LOG — badge total no título da seção (menu recolhido)

**Data:** 2026-06-18

## Pedido
Quando itens do menu têm contador de ativos novos, o **total da seção** deve aparecer no título do grupo (Admin, Suporte) para que, com a seção recolhida, o master ainda veja que há novidades.

## Implementação
- `MASTER_MENU_BADGE_GROUP_MAP` soma badges por grupo
- Badge branco no `.menu-group-toggle` (`data-master-menu-group-badge`)
- Visível só quando grupo **fechado** e total > 0
- Ao expandir a seção, some do título (badges individuais nos itens)
- Mobile: mesmo total nos rótulos Admin / Suporte
- `setDesktopMenuGroupOpen` re-sincroniza totais

## Arquivos
- `index.html` — CSS, HTML toggles, JS

## Validar
- Master com seção Admin recolhida + 1 assinante novo → título **Admin** mostra **1**
- Expandir Admin → total no título some; badge permanece em Assinantes
