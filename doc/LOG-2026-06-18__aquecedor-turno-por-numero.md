# LOG — Aquecedor turno por número WhatsApp

**Data:** 2026-06-18  
**Contexto:** Drax enviou 3 mensagens consecutivas para Soma (06:24, 07:01, 07:53) sem resposta da Soma — conversa unilateral proibida.

## Causa raiz

- Alternância de turno usava `logs_envios` / mapa em memória por **nome de instância**, frágil com aliases (`drax` vs `drax-sistemas`) e não refletia o envio real no WhatsApp.
- Rotação por `ciclo_global` podia escolher o mesmo par remetente→destino se o mapa de último remetente estivesse errado ou vazio.

## Correção

- Turno baseado na tabela `aquecedor` (`status=ENVIADO`): último envio direcionado no par usa `instancia` + `numero_destino` mapeado para instância destino.
- `pickAquecedorCombinationAsync` + `canAquecedorOrigemSendDirected`: bloqueia novo `A→B` se o último no par foi `A→B` (exige `B→A` antes).
- `verifyAquecedorConversationTurn` revalida imediatamente antes do envio.
- `hasRecentAquecedorSendBetween` consulta `aquecedor` por instância + número (anti processo duplo, 90s).
- Ciclo normal, test batch e pré-fila da próxima mensagem usam a versão async.

## Arquivos

- `src/index.ts` — funções de turno + `runAquecedorCycle` / `runAquecedorCycleTestBatch`
- `src/deploy-marker.ts` — `DEPLOY-2026-06-18-aquecedor-turno-por-numero`

## Validação

- `npx tsc --noEmit` — OK

## Pendências

- Deploy Easypanel `waba_disparador` + conferir `GET /health` → `deployMarker`
- Garantir **um único** processo com aquecedor ativo (local + produção no mesmo Supabase = risco)
- Conferir números em `controle_instancia` (soma/drax) batem com WhatsApp real
