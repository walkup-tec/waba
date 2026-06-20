# LOG — Dashboard Disparos refresh silencioso

**Data:** 2026-06-08  
**Pedido:** Dashboard (assinante e master) atualiza com o sistema sem piscar a tela.

## Implementação

- `loadDisparosDashboard({ silent, force })` — silent não mostra "Carregando…" nem apaga o relatório em erro.
- `buildDisparosDashboardRenderFingerprint` — só re-renderiza DOM se indicadores/créditos mudaram.
- Polling dedicado: 5s com campanhas em andamento, 30s idle.
- `refreshActiveTabData` e `visibilitychange`/`focus` usam `silent: true`.
- Botão Atualizar usa `force: true` (re-busca sem loading visual).

## Validação

- `npm run build` — OK.
