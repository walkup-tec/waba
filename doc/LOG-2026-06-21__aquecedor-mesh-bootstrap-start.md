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

## Correção mesh falso negativo (2026-06-21 tarde)

**Sintoma:** 3 instâncias conectadas na EVO, validação falha só em `soma→drax`, `soma→walkup`.

**Causa:** envio+findMessages **todos em paralelo** — mesma origem (`soma`) disparava 2 sendText ao mesmo tempo; EVO/WhatsApp e findMessages saturados → falso negativo (HTTP 201 mas «não apareceu no destinatário»).

**Fix:** fases separadas — (1) envio por origem em sequência (900ms gap), origens diferentes em paralelo; (2) pausa 5s; (3) verify em paralelo + 1 retry; números refresh live EVO; alias técnico no sendText.

Marker: `DEPLOY-2026-06-21-aquecedor-mesh-send-verify-phases`

## Validar

1. Deploy produção + marker no `/health`.
2. 5 instâncias conectadas → Iniciar Aquecedor.
3. UI: «Validação inicial entre instâncias» + N×(N−1) envios.
4. Sucesso → log: «Todas as N instâncias estão funcionando perfeitamente bem. Ciclo iniciando.»
5. Falha → log negativo com pares com erro + detalhes (até 3).

## Palavras-chave

`mesh-bootstrap`, `validação inicial`, `simultâneo`, `findMessages`, `aquecedor start`
