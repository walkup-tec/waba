# Relatório unificado (operacional + assinante)

## Pedido

Campanha Jandira 2 (operacional drax) continuava com layout antigo. Refazer push para novo deploy e alterar o relatório para **todos** os usuários e assinantes.

## Causa do “continua igual”

Produção ainda em `DEPLOY-2026-09-03-204500-template-ai-header-route`. O tip no Git já tinha timeline + remoção de `sendIssues`, mas o container EasyPanel não tinha sido Redeployado.

## Mudança neste push

1. Operacional Lab/readonly renderiza **o mesmo HTML** do assinante: `timeline + buildCampaignPerformanceDashboardHtml` num único bloco.
2. Sem bloco “Erros que impactaram o envio” (UI/API).
3. Marker novo: `DEPLOY-2026-09-04-101500-relatorio-unificado-todos`.

## Validar após Redeploy

1. `/health` → marker `…101500-relatorio-unificado-todos`
2. Hard refresh
3. Operacional (ex. drax) → Campanha Jandira 2: linha do tempo + dashboard, sem lista de erros
4. Assinante → mesmo layout de relatório

## Arquivos

- `index.html`
- `src/deploy-marker.ts`
- `src/admin/waba-operacional-campanhas.service.ts` (timeline; sem sendIssues — já no tip anterior)
