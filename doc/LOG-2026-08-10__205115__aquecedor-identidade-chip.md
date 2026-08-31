# LOG — Aquecedor: identidade por número do chip

## Contexto do pedido

O aquecedor (e a lógica de envio) deve sempre considerar o **número do chip**, não o nome técnico da instância. Renomes (`1261` → `1261-01`, `2477` → `proxy-2477`) fragmentavam grafo, turnos e stats da UI.

## Solução implementada

1. Módulo `src/aquecedor/aquecedor-chip-identity.ts` — chave canônica via `canonicalizeBrazilWhatsAppNumber`; índice chip ↔ instância atual.
2. Grafo (`OwnerConversationGraph.identityMode = "chip"`) — bootstrap/migração força reindex por chips; `recordDirectedSend` grava chips.
3. Pick (`pickAquecedorCombinationAsync`) — elegíveis = chips; match de volta para combinação por instância atual.
4. Turn manager — eventos e `canSendDirected` / equity resolvem origem/destino para chip (antes: inconsistência nome vs chip).
5. Stats UI (`aquecedor-instance-message-stats.service.ts`) — agrega `logs_envios` / log local por chip; replica volume em todas as linhas que mapeiam ao mesmo chip.
6. Network-health — calcula em chips; labels exibem nome atual da instância.
7. Marker: `DEPLOY-2026-08-10-aquecedor-identidade-chip`.

## Arquivos criados/alterados

- `src/aquecedor/aquecedor-chip-identity.ts` (novo)
- `src/aquecedor/conversation-pair.types.ts`
- `src/aquecedor/conversation-graph.service.ts`
- `src/aquecedor/network-health.service.ts` (labels)
- `src/services/aquecedor-instance-message-stats.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts`
- `dist/**` (build)

## Como validar

1. `npm run build` em `Waba-master-push` (ok).
2. Unidade local: `1261` + `1261-01` com/sem 9º dígito → mesmo chip.
3. Após deploy EasyPanel: `/health` com marker `DEPLOY-2026-08-10-aquecedor-identidade-chip`.
4. Mozart — aba Mensagens: volumes unificados por número; saúde da rede sem par quente artificial por rename.
5. Funcional em produção: ciclo do aquecedor balanceando pelos 7 chips integrados (não validado nesta sessão).

## Segurança

Sem exposição de tokens; apenas mapeamento instância↔número já conhecido no backend.

## Palavras-chave

aquecedor, chip, identidade, canonicalizeBrazilWhatsAppNumber, conversation-graph, turn-manager, message-stats, rename instância
