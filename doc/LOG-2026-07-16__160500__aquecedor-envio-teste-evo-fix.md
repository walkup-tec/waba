# LOG — Aquecedor Envio teste (EVO)

**Data:** 2026-07-16 16:05  
**Marker:** `DEPLOY-2026-07-16-aquecedor-envio-teste-evo-fix`

## Contexto

Botão **Envio teste** no Aquecedor falhava. Pedido: corrigir e só commit/push após validar sendText via EVO.

## Causas

1. Ciclo de teste usava só instâncias `active` — números em **Preparando** (pós-integração) bloqueavam o teste.
2. Se o motor estava `isProcessing`, o teste abortava em silêncio.
3. `POST /aquecedor/run-once` chamava `stopAquecedorOwnerMotorLocal` e a UI forçava `desiredRunning: false`.
4. Timeout UI 90s curto vs sendText+verify; falso negativo de `findMessages` marcava falha mesmo com EVO HTTP 201.
5. Payload: Evolution 2.3.x exige `text` na raiz.

## Correção

- `forceTest` usa instâncias live-open do escopo (inclui Preparando).
- Aguarda ciclo idle antes do teste; retoma motor se `desired=true`.
- Sucesso do teste = EVO aceitou envio (verify é complementar).
- UI: timeout 180s; não zera `desiredRunning`.
- Payload sendText: `{ number, text }`.

## Validação EVO (antes do commit)

| Teste | Resultado |
|-------|-----------|
| `POST …/message/sendText/soma-crm` → walkup | HTTP **201** (~1.5s) |
| `GET /service/evo-integration-probe` | `ok=true`, sendAccepted, receiveOk |

## Arquivos

- `src/index.ts`, `index.html`, `src/services/evo-integration-probe.service.ts`, `src/deploy-marker.ts`

## Keywords

`aquecedor`, `envio teste`, `run-once`, `sendText`, `Evolution 2.3`, `preparando`, `findMessages`
