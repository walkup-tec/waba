# LOG — Proxy off no offline + botão + Instâncias

## Contexto

Pedido: ao desconectar um número, desligar a Proxy; mostrar «+ Instâncias»; ao adicionar, ligar Proxy na nova.

## Causa

- «+ Instâncias» só aparecia com `needsMoreInstancesForMinimum` (mínimo=1) — com 1 online + 1 offline (ratio 50%) o botão sumia.
- Pausa por saúde/sessão não desligava Proxy do offline.

## Solução

1. Ao pausar por saúde ou sessão: `queueDisableProxyBrasilForDisconnectedCampaignInstances`.
2. UI: `showAddInstances` se mínimo OU ratio OU `disconnectedCount > 0`.
3. Auto-add: `computeCampaignInstancesToAdd` (cura ratio ≥50% + mínimo).
4. Add já chamava `queueProxyBrasilPrepareForCampaignInstances(incoming)` — mantido; mensagem confirma Proxy nos novos.
5. Marker: `DEPLOY-2026-08-12-proxy-offline-add-instancias`.

## Arquivos

- `src/index.ts`, `index.html`, `src/deploy-marker.ts`, `dist/*`, `doc/memoria.md`

## Validar

Redeploy + com `drax-oficial` offline: tag vermelha, Proxy off, botão «+ Instâncias», add liga Proxy no novo.

## Palavras-chave

proxy offline, + Instâncias, computeCampaignInstancesToAdd, queueDisableProxyBrasil
