# LOG — Logs Sistema + Monitor CPU split

## Pedido
Dividir monitor: página atual = Monitor CPU; nova = Logs Sistema com lista, KPIs, gráficos Apps Falhas, filtros e export Excel. Commit + push.

## Implementado
- Menu `admin-logs-sistema` (Suporte)
- API `GET /admin/infra/system-logs/dashboard` e `/export`
- Persistência JSONL `data/.../vps-infra/system-connection-logs.jsonl`
- Uptime monitor grava Conexão/Desconexão com motivo Traefik|Yaml|Docker|Servidor
- UI: filtros (apps, período, Dia/Semana/Mês, mês do ano), Limpar, Exportar XLSX

## Validar
Master → Suporte → Logs Sistema; após próximo ciclo uptime, eventos aparecem.
