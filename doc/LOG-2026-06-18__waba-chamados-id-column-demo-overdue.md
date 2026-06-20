# LOG — coluna ID chamados + demo atraso

**Data:** 2026-06-18

## Pedido
1. Backdate chamado `assinante.teste@walkup.com` para >24h e ver relógio.
2. Coluna ID na listagem master de chamados.

## Alterações
- `data/v02/waba-support-tickets.json`: `CHM-260618-975A9E` aberto em `2026-06-16T17:28:56.846Z` (~48h antes).
- `index.html`: coluna **ID** (`displayId`) após ícone de atraso; colspan 8.
- Marker: `DEPLOY-2026-06-18-waba-chamados-id-column`

## Validar
Master → Suporte → Chamados Pendentes → relógio + `CHM-260618-975A9E` na coluna ID.
