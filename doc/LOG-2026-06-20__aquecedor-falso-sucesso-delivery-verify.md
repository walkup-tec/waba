# LOG — Aquecedor falso «Envio com Sucesso»

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-aquecedor-delivery-verify`

## Sintoma

Painel mostrava `soma → drax` às 10:25:16 com «Envio com Sucesso», mas a mensagem **não chegou** no WhatsApp do Drax.

## Causa raiz

1. EVO `sendText` retornava **HTTP 200** e o motor gravava `logs_envios` + `aquecedor ENVIADO`.
2. A mensagem ficava só no chat da **origem** (Soma); `findMessages` no **destino** (Drax) não encontrava o texto (`hjtyby`).
3. Falso positivo: sucesso = resposta HTTP, não entrega real.

## Correção

- `verifyAquecedorMessageDelivered`: após sendText, consulta `findMessages` na instância **destino** (chat com número da origem) até achar o marcador do texto.
- Só então grava `logs_envios` / «Envio com Sucesso».
- Se não confirmar: reverte fila para `PENDENTE`, **não** insere log de sucesso.
- `isEvoSendTextAccepted`: rejeita corpo JSON com `error` mesmo com HTTP 2xx.

## Limpeza dados (dev Supabase)

- Removido `logs_envios.id=271` (falso positivo 10:25).
- `aquecedor.id=268` revertido para `PENDENTE`.

## Validar

1. Reiniciar V02 (`npm run dev:v02`).
2. Iniciar aquecedor; aguardar ciclo Soma→Drax.
3. Só deve aparecer «Envio com Sucesso» se a mensagem existir no chat do Drax (EVO findMessages).
