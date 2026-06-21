# LOG — Aquecedor validação mesh no start

**Data:** 2026-06-21  
**Marker:** `DEPLOY-2026-06-21-aquecedor-mesh-bootstrap-start`

## Pedido

Ao **iniciar** o aquecedor, todas as instâncias devem enviar mensagens para **todas** as outras **simultaneamente**, confirmando EVO envio+receção; só então o ciclo normal começa.

## Implementação

**Arquivo:** `src/index.ts`

- `runAquecedorStartupMeshValidation` — para N instâncias, dispara N×(N−1) pares em **paralelo** (`Promise.all`).
- Cada par: `sendText` + `verifyAquecedorMessageDelivered` (findMessages no destino).
- **Não** grava `logs_envios`/Supabase (evita poluir turn manager); só `recordAquecedorEnvio` local em sucesso.
- Estados: `meshBootstrap.phase` = `idle` | `running` | `passed` | `failed`.
- `runAquecedorCycle`: se `phase !== passed`, executa mesh antes do ciclo; se `failed`, bloqueia até novo start.
- Reset mesh em `start` / `stop`.

**UI:** `index.html` — hero e barra de progresso durante validação mesh.

## Validar

1. Deploy produção + marker no `/health`.
2. 5 instâncias conectadas → Iniciar Aquecedor.
3. UI: «Validação inicial entre instâncias» + N×(N−1) envios.
4. Sucesso → log: «Todas as N instâncias estão funcionando perfeitamente bem. Ciclo iniciando.»
5. Falha → log negativo com pares com erro + detalhes (até 3).

## Palavras-chave

`mesh-bootstrap`, `validação inicial`, `simultâneo`, `findMessages`, `aquecedor start`
