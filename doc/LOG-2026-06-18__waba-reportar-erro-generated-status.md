# LOG — Reportar Erro visível em campanha generated

**Data:** 2026-06-18  
**Problema:** Botão "Reportar Erro" não aparecia no modal operacional quando campanha ainda estava aguardando configuração (`generated`), só com status `in_progress`.

## Correção

- `waba-operacional-campanhas.service.ts`:
  - `canReportError`: `generated` **ou** `in_progress`
  - `reportCampaignError`: aceita os dois status

## Validar

1. Operacional → campanha com botão "Campanha Iniciada" visível → Detalhes
2. Três botões inline: Baixar imagem | Baixar leads | **Reportar Erro**

## Marker

`DEPLOY-2026-06-18-waba-reportar-erro-generated`
