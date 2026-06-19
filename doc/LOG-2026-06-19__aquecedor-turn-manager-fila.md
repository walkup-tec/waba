# LOG — Aquecedor turn manager (fila bidirecional)

**Data:** 2026-06-19  
**Marker:** `DEPLOY-2026-06-19-aquecedor-turn-manager-fila`

## Contexto / pedido

Instâncias do aquecedor enviavam 7–8 mensagens seguidas sem receber resposta (ex.: Drax → Soma repetido). Regra desejada:

- A → B, depois B deve responder antes de novo A → B
- Por instância: quem enviou não envia de novo (para ninguém) até receber pelo menos uma mensagem de volta

A lógica anterior só alternava **por par**; com N instâncias, A podia enviar para B, C, D em pares diferentes sem nunca “receber”.

## Alterações

**Arquivo:** `src/index.ts`

- `loadAquecedorExchangeEvents` — histórico unificado de `aquecedor` (ENVIADO) + `logs_envios`
- `loadAquecedorTurnManager` — stats por instância (`lastSentAt`, `lastReceivedAt`, contadores) + último remetente por par
- Regra global: origem só envia se `lastReceivedAt >= lastSentAt` (ou nunca enviou)
- Regra por par: último no par não pode ser mesmo `origem→destino`
- `pickAquecedorCombinationAsync` — filtra elegíveis + prioriza quem deve responder + fairness
- `verifyAquecedorConversationTurn` — usa o mesmo manager
- Removidas funções obsoletas: `getLastAquecedorDirectedExchange`, `pickAquecedorCombination`, `canAquecedorOrigemSendOnPair`

**Arquivo:** `src/deploy-marker.ts` → `DEPLOY-2026-06-19-aquecedor-turn-manager-fila`

## Validação local

```bash
cd D:\Waba && npx tsc --noEmit
```

Exit 0.

## Pendências

1. Deploy Easypanel (`npm run easypanel:commit` ou equivalente no repo Waba) + push
2. Validar em produção par Drax/Soma e 3+ instâncias — ninguém envia 2+ vezes sem receber
3. Confirmar mapeamento `numero_destino` ↔ instância em `controle_instancia`

## Chats abertos

- Fila aquecedor bidirecional / gerenciador de turnos
