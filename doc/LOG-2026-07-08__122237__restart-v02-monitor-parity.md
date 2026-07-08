# LOG — 2026-07-08 12:22 — Restart V02 local com paridade monitor

## Pedido
Reiniciar servidor local V02 para carregar atualizações.

## Ação
- Encerrado processo antigo na :3012 (PID 7100 / npm 19360)
- `npm run dev:v02` iniciado
- Health OK com marker `DEPLOY-2026-07-08-v02-monitor-parity-prod`
- UI root `/version-02/` → 200

## Nota
`[uptime-monitor] desativado` em dev é esperado (`WABA_UPTIME_MONITOR_ENABLED` / ambiente development). Luzes via `GET /lights` e rotas admin seguem disponíveis; scheduler de alertas WA/e-mail só em prod/v01.

## URL
http://localhost:3012/version-02/
