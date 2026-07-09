# Campanhas operacionais — coluna e modal com segmento

## Pedido
Exibir **segmento** do assinante na tabela de campanhas e no modal de detalhes do operacional.

## Alterações
- API `OperacionalCampaignListItem`: `subscriberSegment`, `subscriberSegmentLabel` (Bets / Outros).
- `index.html`: coluna **Segmento** na tabela (após Plano); campo no modal após ID do assinante.
- Colspans da tabela ajustados (8 operacional / 9 master).

## Arquivos
- `src/admin/waba-operacional-campanhas.service.ts`
- `index.html`

## Validar
Recarregar Admin → Campanhas no V02; abrir modal **Ver detalhes** — segmento visível.

## Palavras-chave
`campanhas segmento`, `subscriberSegmentLabel`, `admin-campanhas-tbody`
