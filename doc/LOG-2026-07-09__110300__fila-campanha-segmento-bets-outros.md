# LOG — Fila campanha: regra segmento Bets × Outros

**Data:** 2026-07-09

## Regra de negócio

| Operador | Pode atender campanhas de assinante |
|----------|-------------------------------------|
| **Bets** | Bets e Outros |
| **Outros** | Apenas Outros (nunca Bets) |

Escalonamento: campanha **Outros** não atendida por operador Outros (prazo 30h, BM inoperante, etc.) pode ir para operador **Bets**. O inverso é proibido.

## Implementação

- `src/services/waba-campaign-operacional-segment-rules.ts` — `operacionalCanServeSubscriberCampaign`
- `waba-campaign-supplier-assignment.service.ts` — fila candidatos Outros = fornecedores Outros + Bets (ordem); validação em `pickNextSupplier` e `assignToSupplier`
- `waba-operacional-campanhas.service.ts` — visibilidade da fila para operacional
- `waba-system-user.service.ts` — `listOperacionalUsersForCampaign`

## Deploy marker

`DEPLOY-2026-07-09-fila-campanha-segmento-bets-outros`

## Validar

1. Campanha assinante **Bets** → só operador Bets na fila
2. Campanha assinante **Outros** → primeiro operador Outros; após timeout/BM, pode ir para Bets
3. Operador Outros não vê campanhas Bets na lista

## Palavras-chave

`fila campanha`, `segmento bets outros`, `supplier assignment`, `operacionalCanServeSubscriberCampaign`
