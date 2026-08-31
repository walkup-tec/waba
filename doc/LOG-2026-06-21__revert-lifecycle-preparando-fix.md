# LOG — revert lifecycle preparando fix (pedido usuário)

## Pedido
Reverter alterações de `manualActiveOverride` / fix Preparando — voltar código original.

## Ação
- `git revert cd9de58` → commit `a90a466`
- Removidos scripts/docs untracked do hotfix (vps-*, LOG cd9de58)
- `deploy-marker` restaurado: `DEPLOY-2026-06-24-dockerfile-sem-data-v02`

## Estado
Comportamento lifecycle como antes do fix (reconcile no refresh, 6h Preparando para instâncias novas pós-cutoff).

## Push
Revert local em `master`; push para `origin` só se solicitado.
