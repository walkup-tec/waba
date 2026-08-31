# LOG — Aquecedor produção: isolamento cross-tenant + pares A→B regressão

**Data:** 2026-07-09  
**Contexto:** Produção — `mozart.pmo@gmail.com` recebia mensagens do aquecedor de instâncias de `walku@walkuptec.com.br`. Alternância de pares (envia → recebe → envia) parou de funcionar.

## Causa raiz

1. **Escopo master global** (`listAquecedorScopedInstanceNames`): master via **todas** as instâncias EVO conectadas no ciclo, não só as de `instance-owners.json`. O motor do walkup enviava para números de outros assinantes.
2. **Fila Supabase compartilhada**: `fetchProcessableAquecedorPending` pegava qualquer `PENDENTE` global (sem `instancia`); `ensureAquecedorPendingMessage()` sem par criava linhas órfãs; `releaseStuck` zerava `instancia`.
3. **`controle_ciclo.ciclo_global` único**: motores paralelos (walkup + mozart) disputavam o mesmo índice de rotação.
4. **Histórico de turnos global**: `loadAquecedorExchangeEvents` lia últimos ENVIADOS/logs sem filtrar por instâncias do escopo na query — envios do walkup entre instâncias do Mozart poluíam o turn manager do Mozart.

## Correção

### `src/index.ts`
- Escopo do aquecedor **sempre por ownership** (+ ativações Alternativa); master só reconcilia órfãs, não inclui instâncias de terceiros.
- Fila: `ensure`/`fetch` pendentes **por `instancia` origem** do par; removido `ensureAquecedorPendingMessage()` global no start/ciclo.
- `releaseStuckAquecedorQueueRows` não limpa mais `instancia`/`numero_destino`.
- `cicloGlobal` **por proprietário** em `runtime-intent.json` (motor snapshot), sem upsert em `controle_ciclo` no ciclo normal.
- Queries de turno com `.in("instancia", …)` / `.in("instancia_origem/destino", …)`.
- Checagem defensiva: par escolhido deve estar no escopo do `ownerEmail`.
- Dashboard/envios/command-logs: master também filtrado por instâncias próprias.

### `src/services/aquecedor-owner-runtime.registry.ts`
- Campo `cicloGlobal` no snapshot persistido por owner.
- `getAquecedorOwnerCicloGlobal` / `setAquecedorOwnerCicloGlobal`.

### Marker
`DEPLOY-2026-07-09-aquecedor-isolamento-pares-fix`

## Validar em produção

1. `GET /health` → marker novo.
2. Walkup: iniciar aquecedor — só pares entre instâncias **dele** (painel envios / WhatsApp).
3. Mozart: iniciar aquecedor — sem mensagens de números walkup; alternância A→B→A visível nos envios.
4. Dois motores ligados ao mesmo tempo não interferem.

## Palavras-chave

`aquecedor`, `isolamento`, `cross-tenant`, `pares`, `turn manager`, `listAquecedorScopedInstanceNames`, `cicloGlobal`, `mozart`, `walkup`
