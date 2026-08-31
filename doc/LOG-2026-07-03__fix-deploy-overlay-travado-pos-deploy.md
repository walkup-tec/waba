# Fix overlay deploy travado após estabilizar

## Problema

Usuário ficou na tela «ATUALIZANDO O SISTEMA» / «Finalizando a atualização…» mesmo com deploy concluído; precisou dar refresh manual.

## Causa

1. Após reload pós-deploy (`waba.deployReload`), o gate de auth **mostrava** o overlay mas **não iniciava** o polling nem **fechava** ao restaurar sessão (`unlockWabaApp`).
2. Polling podia não completar se `/ready` oscilasse — streak zerava sem timeout de força.

## Solução

- `unlockWabaApp` / `lockWabaApp` → `dismissWabaDeployOverlay()`.
- Retry pós-deploy chama `startDeployRecovery()` (poll + reload automático).
- `wabaDeployResilience.dismiss` exposto.
- Após 90s estável com sinal de deploy → `completeDeployRecovery()` forçado.

## Arquivos

- `index.html`, `dist/index.html`, `src/deploy-marker.ts`

## Palavras-chave

`waba-deploy-overlay`, `postDeployReload`, `dismissWabaDeployOverlay`
