# LOG — Motivo real da pausa + tags vermelhas por connectionState

## Contexto do pedido

- UI mostrava «pausada manualmente» sem o usuário ter pausado.
- Instância offline (`drax-oficial` em `connecting`) aparecia **verde**.
- Pedido: exibir motivo correto da pausa; número desconectado em vermelho.

## Causa raiz (evidência)

1. `pauseCampaignDueToProxyPrepareFailure` pausava sem gravar `pauseReason` → fallback «Campanha pausada manualmente.»
2. Tags usavam `fetchInstances.connectionStatus` (ex.: `open` falso); a verdade é `/instance/connectionState` (`connecting`).

## Solução

1. Enrich de tags com `fetchEvoInstanceLiveState` / `isEvoLiveStateOpen`.
2. Gravar `pauseReason` em pausas proxy/sessão.
3. Fallback sem motivo ≠ «manual»; detalhe de saúde lista nomes offline.
4. Marker: `DEPLOY-2026-08-12-pausa-motivo-tags-live`.

## Arquivos

- `src/index.ts`
- `index.html` (tooltip das tags)
- `src/deploy-marker.ts`
- `dist/*` (build)
- `doc/memoria.md`

## Como validar

1. Push `master` + Redeploy `waba_disparador`.
2. `/health` com marker `DEPLOY-2026-08-12-pausa-motivo-tags-live`.
3. Com `drax-oficial` em connecting: tag **vermelha**; motivo «Pausa automática… offline: drax-oficial».

## Palavras-chave

pauseReason, connectionState, fetchInstances, tag vermelha, drax-oficial, pausa manual falsa
