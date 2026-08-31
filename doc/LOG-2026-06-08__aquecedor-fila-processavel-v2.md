# LOG — Aquecedor fila processável

**Data:** 2026-06-08  
**Sintoma:** Motor ativo, "Sem mensagem pendente", nenhum envio.

## Causa
1. Após envio (status ENVIADO) não criava nova mensagem PENDENTE.
2. `ensureAquecedorPendingMessage` inseria na fila mas o ciclo **retornava** sem processar na mesma execução.
3. PENDENTE com `scheduled_at` futuro bloqueava (contagem > 0 mas nada processável).

## Correção
- `fetchProcessableAquecedorPending` + re-tentativa após ensure no mesmo ciclo.
- Ensure: libera agendamento futuro ou insere nova mensagem se fila vazia.
- Após envio bem-sucedido: `ensureAquecedorPendingMessage()` para próximo ciclo.
- Intervalo do motor: 60s → 30s; ensure no `start` e no bootstrap.

## Marker
`DEPLOY-2026-06-08-aquecedor-fila-processavel-v2`
