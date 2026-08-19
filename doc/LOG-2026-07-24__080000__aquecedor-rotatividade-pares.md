# Aquecedor — rotatividade inteligente de pares (RelationshipManager)

## Contexto

O motor por saldo já equilibrava A→B vs B→A, mas um par balanceado podia monopolizar o ciclo (ping-pong). Objetivo: equilibrar também o **volume entre todos os pares** da rede.

## Solução

- Novo módulo `src/aquecedor/relationship-manager.service.ts`
- Score: saldo + déficit de volume vs média + cobertura + participação − penalidade de repetição do mesmo par
- Soft filter: exclui o último `pairKey` se houver alternativa
- Persistência: `usageToday`, `lastSelectedPairKey`, `selectionHistory` (motivo + breakdown)
- Dashboard: matriz NxN, pares mais/menos usados, spread/desvio, cobertura, histórico de picks

## Marker

`DEPLOY-2026-07-24-aquecedor-rotatividade-pares`

## Validação

1. Redeploy Node + marker em `/health`
2. `node scripts/simulate-aquecedor-pick.cjs` — projeção 12 envios deve alternar pares
3. Aba Aquecedor → Saúde da rede: matriz uniforme ao longo do tempo

## Palavras-chave

aquecedor, rotatividade, relationship-manager, matriz, cobertura, anti-ping-pong
