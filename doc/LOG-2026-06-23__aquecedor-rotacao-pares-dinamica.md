# LOG — Aquecedor: rotação dinâmica de pares A→B

## Pedido

Variar combinações a cada ciclo (ex.: A→B, depois C→A, depois B→C) com cálculo dinâmico conforme instâncias entram/saem.

## Solução

Refino em `scoreCombination` (`loadAquecedorTurnManager`):

- Histórico `recentDirectedEdges` (últimos 32 envios origem→destino).
- Penalidade forte se o mesmo par direcionado foi usado recentemente.
- Penalidade se repetir mesma origem ou mesmo destino do último envio global.
- Bônus para origens há mais tempo sem enviar / arestas nunca usadas.

Regras de turno A↔B no mesmo par mantidas (`canSendDirected`).

## Arquivo

- `src/index.ts`

## Palavras-chave

`pickAquecedorCombination`, `scoreCombination`, `recentDirectedEdges`, rotação pares
