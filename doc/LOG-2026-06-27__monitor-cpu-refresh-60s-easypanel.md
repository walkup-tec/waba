# LOG — Monitor CPU refresh 60s (paridade Easypanel/Hostinger)

## Contexto

Pedido: alinhar a taxa de atualização dos indicadores do Monitor CPU WABA com a do Easypanel/Hostinger (~1 minuto, não tempo real).

## Solução

Intervalo unificado em **60 segundos**:

| Camada | Antes | Depois |
|--------|-------|--------|
| Polling aba Monitor CPU | 10s | 60s (`ADMIN_MONITOR_CPU_POLL_MS`) |
| Polling dot alerta header master | 10s | 60s (`MASTER_CPU_ALERT_POLL_MS`) |
| Backend `uiRefreshSec` / `sampleIntervalSec` | 10s | 60s |
| Timer systemd coletor VPS | 10s | 1min (`OnUnitActiveSec=1min`) |

Badge na UI: *"Atualização automática a cada 60s (paridade Easypanel/Hostinger)"*.

Variáveis opcionais (mín. 30s, máx. 300s):

- `WABA_VPS_CPU_UI_REFRESH_SEC`
- `WABA_VPS_CPU_SAMPLE_INTERVAL_SEC`

## Arquivos alterados

- `src/infra/vps-cpu-monitor.service.ts`
- `index.html` (polling + badge)
- `scripts/infra/install-vps-monitor.sh`
- `dist/index.html` (via `npm run build`)

## Validar

1. Abrir **Suporte → Monitor CPU** (master): badge mostra 60s; cards/gráfico atualizam ~1/min.
2. Dot vermelho no header: mesmo intervalo (~60s).
3. Na VPS, após reinstalar coletor: `systemctl status waba-infra-cpu-collector.timer` → `1min`.

## Observações

- Easypanel/Hostinger não é tempo real; documentação Hostinger cita atualização em poucos minutos.
- Coletor v3 (`collectorVersion: v3-procstat`) necessário para CPU/mem/disco corretos vs painel Hostinger.

Palavras-chave: `monitor-cpu`, `60s`, `easypanel`, `uiRefreshSec`, `waba-infra-cpu-collector`
