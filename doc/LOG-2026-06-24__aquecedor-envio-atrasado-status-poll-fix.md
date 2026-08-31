# LOG — Aquecedor: previsão passou sem envio

**Data:** 2026-06-24  
**Sintoma:** Previsão `próximo: 23:34:14`, às 23:36 sem envio; countdown ~383s; `walkup → 5182006011` preso em «Em Fila» desde 22:46.

## Causa raiz

1. **GET `/aquecedor/status` (poll 3s)** chamava `applyPersistedSnapshotToLocal()` e **revertia** `nextAllowedAt` / `lastResult` do worker com snapshot antigo do disco.
2. **`syncAquecedorWorkerLeadership` (12s)** fazia o mesmo no processo líder.
3. **Ciclo fixo 30s** — após `nextAllowedAt` vencer, até 30s de atraso antes de tentar envio.
4. **PROCESSANDO preso** — linhas com `processing_at` nulo não eram liberadas; bloqueavam fila/UI.

## Correção

- Status **somente leitura**: `buildLiveAquecedorStatusPayload()` expõe memória do worker líder.
- Líder **não** reaplica snapshot do disco enquanto motor já está rodando.
- **Agendador adaptativo**: próximo tick entre 5s (vencido) e 30s (aguardando).
- `releaseStuckAquecedorQueueRows()` — libera PROCESSANDO >3min (incl. `processing_at` null).
- Retries de turno: 30s; limite diário: 5min (não `waitMax` 480s).
- Removida sobrescrita de `lastResult` para «Aguardando intervalo aleatório».

## Arquivos

- `src/index.ts`, `src/deploy-marker.ts`, `dist/`

## Marker

`DEPLOY-2026-06-24-aquecedor-cycle-scheduler-fix`

## Validar

1. Após `próximo` vencer, envio em até ~5–10s (não 30s+).
2. Status mostra motivo real (turno, limite, etc.), não só intervalo genérico.
3. «Em Fila» >3min some ou vira envio/retry.
4. `/health` com marker acima.

## Palavras-chave

`aquecedor`, `nextAllowedAt`, `status poll`, `PROCESSANDO`, `runtime-intent`, `scheduleAquecedorCycleTick`
