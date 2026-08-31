# LOG — Dashboard Disparos gate assinante novo

**Data:** 2026-06-18

## Pedido
Empty state do Dashboard Disparos para assinante sem dados: preview blur + CTA contratar créditos (como aquecedor).

## Implementação
- `.disparos-dashboard-shell.is-gated` — blur no relatório de prévia
- Preview com métricas fictícias via `buildDisparosDashboardPreviewHtml()`
- Overlay `disparos-dashboard-gate` + botão **Contratar créditos** → `goToDisparosAddCredits()`
- Só para `scope: owner` e `withReport < 1`; master mantém mensagem simples

## Validar
Login assinante.teste@walkup.com → Disparos → Dashboard → prévia borrada + botão.
