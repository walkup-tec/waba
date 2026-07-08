# LOG — 2026-07-08 — Commit dist Monitor CPU luzes para produção

## Contexto
Deploy anterior `6adfd1d`/`880346e` não versionou `dist/` → UI luzes ausente em produção (Dockerfile só COPY dist).

## Ação
- Em `master`: `npm run build` (tsc + copy index.html)
- Marker: `DEPLOY-2026-07-08-monitor-cpu-luzes-dist`
- Incluído: `dist/index.html` (luzes), `dist/monitoring/uptime-monitor.service.js` (novo), rotas/admin/`dist/index.js`, marker

## Validação pós-redeploy Easypanel
1. GET `/health` → marker `DEPLOY-2026-07-08-monitor-cpu-luzes-dist`
2. Hard refresh; master → Monitor CPU → faixa `#admin-uptime-lights`
3. `GET /admin/infra/uptime-monitor/lights` (sessão master) → `lights[]`

## Palavras-chave
dist commit, monitor cpu luzes, redeploy, deploy-marker
