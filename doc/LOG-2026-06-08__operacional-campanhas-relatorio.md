# LOG — Operacional Campanhas: iniciar + relatório

**Data:** 2026-06-08  
**Deploy marker:** `DEPLOY-2026-06-08-operacional-campanhas-relatorio-v1`

## Solicitação

- Copiar textos das opções no modal de detalhes
- Botão **Campanha Iniciada** fecha modal e muda status
- Botão **Relatório** na coluna Ações (após iniciar) para preencher métricas: Total de Leads, Enviados, Entregues, Lidos, Falhados

## Alterações

- `waba-campaign-intake.repository.ts` — `performanceReport`, `startedAt`, `updateById`
- `waba-operacional-campanhas.service.ts` — iniciar, get/save relatório
- `waba-operacional-campanhas.routes.ts` — POST iniciar, GET/PUT relatorio
- `waba-campaign-intake.routes.ts` — relatório do assinante com métricas salvas
- `index.html` — UI copiar, Campanha Iniciada, modal relatório, ações na tabela

## Fluxo

1. `generated` → Ver detalhes → Campanha Iniciada → `in_progress`
2. `in_progress` → Relatório → preencher campos → Salvar → `completed`
3. Assinante vê relatório quando `completed`

## Validação

- `npm run build` OK
- Servidor dev:v02 reiniciado
