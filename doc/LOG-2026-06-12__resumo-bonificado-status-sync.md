# LOG — Resumo sincronizado com status + Créditos bonificados no relatório

**Data:** 2026-06-12

## Alterações
- `loadDisparosTemplates`: quando fingerprint de campanhas muda (ex.: status → Finalizado), chama `loadDisparosCredits()` para atualizar Resumo lateral (card Créditos bonificados).
- Relatório (`buildCampaignPerformanceDashboardHtml`): textos **Saldo bonificado** → **Créditos bonificados**.

## Arquivo
- `index.html` (+ `dist/index.html` via copy)

## Pendência
- F5 ou reiniciar `dev:v02` para ver no browser.
