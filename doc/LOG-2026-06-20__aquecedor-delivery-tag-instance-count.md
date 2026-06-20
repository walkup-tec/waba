# LOG — Aquecedor tag entrega + contagem instâncias UI

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-aquecedor-delivery-tag-instance-count`

## Sintomas (prints)
- `Envio soma → drax não confirmado no destinatário` com HTTP 201
- UI: `Motor: ativo | atualizando status… (tempo esgotado)`

## Correções
1. **Tag única por envio** (`buildAquecedorDeliveryTag`) anexada ao texto → findMessages localiza mensagem nova (evita falso negativo em histórico repetido).
2. **verifyAquecedorMessageDelivered**: espera inicial 2,5s, 8 tentativas, múltiplos `remoteJid`, corpo `{}` no findMessages.
3. **Status API**: `connectedInstanceCount` / `connectedInstances` atualizados a cada ciclo.
4. **UI**: texto discreto ao lado do título — «N instâncias no ciclo»; timeout status 18s.

## Validar
- `/health` marker
- Aquecedor ativo → hero mostra «5 instâncias no ciclo» (exemplo)
- Envio soma→drax: sucesso só se tag aparecer no Drax; se falhar de novo, problema real de entrega WhatsApp (não falso positivo)
