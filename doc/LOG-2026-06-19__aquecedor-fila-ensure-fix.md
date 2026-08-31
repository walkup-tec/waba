# LOG — Aquecedor fila vazia em produção

**Data:** 2026-06-19  
**Sintoma:** Motor ativo, `0 PENDENTE / 0 PROCESSANDO`, mensagem "Sem mensagem pendente para envio."

## Causa

1. `ensureAquecedorPendingMessage` retornava cedo quando existia `PENDENTE` com `scheduled_at` futuro ou `null`, sem promover para processável.
2. Insert na fila falhava em silêncio (sem log nem `lastResult` descritivo).
3. Após envio, nova mensagem só era enfileirada se `nextPick` existisse.

## Correção

- `ensureAquecedorPendingMessage` retorna `{ ok, reason, pendingId }` e trata erros de Supabase.
- Promove o `PENDENTE` mais antigo (`scheduled_at` null ou futuro) para `now`.
- Semente da fila no início de cada ciclo (`ensure` antes do pick).
- Sempre reabastece fila após envio bem-sucedido.
- Diagnóstico usa `pickAquecedorCombinationAsync` + flag `turnoBloqueado`.

## Marker

`DEPLOY-2026-06-19-aquecedor-fila-ensure-fix`

## Validação

- `npx tsc --noEmit` — OK
