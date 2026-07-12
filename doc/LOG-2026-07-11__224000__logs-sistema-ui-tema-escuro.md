# LOG — UI Logs Sistema alinhada ao tema escuro

**Data:** 2026-07-11 22:40  
**Pedido:** Style péssimo; alinhar com o sistema (agente frontend-ux-ui-saas-designer).

## Problemas
- Cards/inputs brancos no painel escuro (texto ilegível)
- Tabela sem CSS (`admin-table` sem estilos) → colunas coladas
- Pills e muted com contraste invertido

## Solução
CSS scoped em `#admin-logs-sistema-page` no padrão Monitor CPU / Assinantes:
- filtros em painel slate, inputs `color-scheme: dark`
- KPIs em faixa única com borda (como host-cards)
- charts dark + títulos muted
- tabela com thead/td/padding/hover
- pills conexão/desconexão translúcidos

Marker: `DEPLOY-2026-07-11-logs-sistema-ui-dark`

## Validar
Monitor CPU → Logs Sistema: contraste ok, tabela legível, filtros alinhados.

## Keywords
`logs-sistema`, `ui`, `tema-escuro`, `contraste`, `admin-table`
