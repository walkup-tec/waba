# LOG — usuário: Monitor CPU não mudou

## Esclarecimento
Monitor CPU foi **mantido igual de propósito**. O novo é o menu **Logs Sistema** ao lado.

## Produção agora
- `/health` → `DEPLOY-2026-07-10-chamados-todos-usuarios` (build antiga)
- HTML público sem `admin-logs-sistema` / "Logs Sistema"
- Git `master` já tem `b9d7fa3` + marker `DEPLOY-2026-07-11-logs-sistema`

## Bloqueio
Easypanel `waba_disparador` não rebuildou a partir do commit novo.
