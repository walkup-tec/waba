# LOG — Aquecedor: conversa de pares + sucesso no destino

**Data:** 2026-07-24  
**Marker:** `DEPLOY-2026-07-24-aquecedor-conversa-pares-destino`

## Objetivo

Mensagem **no WhatsApp** e pares **A→B depois B→A**, sem rajada de sendText.

## Correções

1. **Sucesso = tag no DESTINO** (chegou no aparelho/EVO do destinatário). Tag única. Só-origem = falha + cooldown 15 min. Sem exigir origem+destino juntos.
2. **findChats** como fallback de confirmação no destino (@lid).
3. **Pares:** após A→B, a resposta B→A tem prioridade (não excluir o par “anti ping-pong”). Score favorece direção que equilibra o saldo.
4. **Anti-spam mantido:** 1 sendText aceito/ciclo; máx. 2 falhas de formato; sem reenvio por variante após HTTP OK.

## Validar

1. `node scripts/test-aquecedor-delivery-verify.cjs`
2. Redeploy; `/health` com o marker.
3. Observar Envios: sucesso só com entrega; próximo ciclo do mesmo par deve ser o sentido inverso quando o saldo pedir.

## Keywords

aquecedor, A→B, B→A, destino, findChats, conversa, anti-spam
