# LOG — Aquecedor: Em Fila some + outbound MessageUpdate=ERROR

## Contexto do pedido

Usuário reportou: envio `1321 → 5551997462102` (walkup) em **Em Fila**, depois sumiu; status «só na origem»; walkup conectado e recebendo normalmente. Pediu investigação da doc EVO vs nosso código, **um teste (sem rajada)** antes de dizer que resolveu.

## Ações / comandos

1. Consulta doc EVO `findMessages` / `sendText` + issues GitHub (#1632 remoteJid, #2633/#2597 PENDING→ERROR).
2. **1×** `sendText` controlado: `1321 → walkup` texto `Teste unico WABA walkup u4o1aj` (script `scripts/tmp-one-test-1321-walkup.cjs`).
3. Probes **somente leitura** (sem novo send): findMessages/findChats/findStatusMessage + taxa ERROR outbound.

## Evidência do teste único

| Checagem | Resultado |
|----------|-----------|
| connectionState 1321 / walkup | ambos `open` |
| sendText HTTP | **201**, `status: PENDING` |
| tag na origem (1321) | **sim** |
| tag no destino (walkup) findMessages/findChats | **não** (5 páginas) |
| `MessageUpdate` / `findStatusMessage` | **`ERROR`** |
| walkup outbound amostra | SERVER_ACK / DELIVERY_ACK / READ (saudável) |
| 1321 outbound amostra | **20/20 ERROR** |

Conclusão: **não é falso negativo do findMessages no walkup**. A EVO aceita HTTP 201, grava a mensagem na origem, e o WhatsApp/Baileys marca **ERROR** — a mensagem **não sai** da sessão `1321`. Walkup receber “normalmente” de outras pessoas/instâncias é compatível (ex.: `soma → walkup` com `DELIVERY_ACK`).

### Por que «Em Fila» some

Ciclo: claim PENDENTE → sendText 201 → verify falha → `revert` para PENDENTE sem `numero_destino` + cooldown do par + (antes) restrição 6h na origem. A UI de Envios deixa de mostrar aquela linha «Em Fila» com destino.

### Taxa outbound ERROR (amostra fromMe, só leitura)

Quebradas (100% ERROR): `6011`, `1321`, `1261`, `6635`  
Saudáveis: `walkup`, `1321-01`, `soma`, `soma-crm`, `digital-corban-2477`, `8927`

Nota: existe **`1321-01` saudável** vs **`1321` quebrada**.

## Solução implementada (código)

1. Extrair / classificar `MessageUpdate` / `findStatusMessage` (`delivery-verify.helpers.ts`).
2. Após sendText: poll ACK; se `ERROR`, falhar rápido com mensagem clara (culpa a **origem**, não o destino).
3. Filtrar do ciclo instâncias com amostra outbound `broken` (`filterAquecedorConnectedByOutboundHealth`).
4. `markAquecedorInstanceRestricted` **só** quando ACK=ERROR (não em todo «só origem»).
5. Marker: `DEPLOY-2026-07-24-aquecedor-outbound-ack-error`

## Arquivos

- `src/aquecedor/delivery-verify.helpers.ts`
- `src/aquecedor/outbound-ack-health.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts`
- `scripts/test-aquecedor-delivery-verify.cjs`

## Como validar

```bash
node scripts/test-aquecedor-delivery-verify.cjs
# Após deploy + Redeploy Node:
# /health → deployMarker ...outbound-ack-error
# Painel: instâncias 1321/1261/6011/6635 fora do ciclo até reconectar QR
```

## O que NÃO está «resolvido» sem ação humana

Reconectar **QR** na Evolution das instâncias com outbound ERROR (`1321`, `1261`, `6011`, `6635`). Sem isso, esses números continuam incapazes de entregar — o aquecedor só evita usá-los e deixa o status honesto.

## Docs oficiais / referências

- https://doc.evolution-api.com/v2/api-reference/message-controller/send-text (201 + status PENDING ≠ entregue)
- https://doc.evolution-api.com/v2/api-reference/chat-controller/find-messages
- https://github.com/EvolutionAPI/evolution-api/issues/2633 (PENDING → MessageUpdate ERROR)
- https://github.com/EvolutionAPI/evolution-api/issues/1440 (SERVER_ACK = 1 tick)

## Segurança

- Sem rajada: exatamente 1 sendText no diagnóstico.
- Sem segredos no LOG.
- Scripts tmp de probe podem ser removidos após análise.

## Palavras-chave

aquecedor, MessageUpdate ERROR, findStatusMessage, outbound quebrado, Em Fila desaparece, 1321, walkup, PENDING, anti-spam, Evolution API
