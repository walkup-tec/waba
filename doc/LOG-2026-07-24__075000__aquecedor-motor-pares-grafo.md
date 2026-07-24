# Motor aquecedor orientado a pares (grafo)

## Contexto

Refatoração completa do pick do aquecedor: saldo por par, anti-duplicata, distribuição diária, persistência JSON e dashboard «Saúde da rede».

## Solução

### Módulos

- `src/aquecedor/conversation-pair.types.ts`
- `src/aquecedor/conversation-graph.service.ts` — JSON `aquecedor-conversation-graph.json`, bootstrap de envios, `recordDirectedSend`
- `src/aquecedor/pair-orchestrator.service.ts` — filtros duros + score (saldo / participação / histórico)
- `src/aquecedor/network-health.service.ts` — relatório

### Integração

- `pickAquecedorCombinationAsync` usa o orchestrator (não mais LRU como primário)
- Após `ENVIADO` confirmado → `recordDirectedSend`
- `GET /aquecedor/network-health`
- UI: seção colapsável na aba Aquecedor
- `scripts/simulate-aquecedor-pick.cjs` espelha o novo algoritmo

### Marker

`DEPLOY-2026-07-24-aquecedor-motor-pares-grafo`

## Validação

1. Redeploy Node; `/health` com o marker.
2. `node scripts/simulate-aquecedor-pick.cjs <env>` — projeção sem A→B duplicado.
3. Aba Aquecedor → Saúde da rede: reciprocidade e ranking de saldo.

## Palavras-chave

aquecedor, pares, saldo, grafo, network-health, anti-duplicata, reciprocidade
