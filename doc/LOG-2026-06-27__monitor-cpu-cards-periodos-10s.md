# LOG — Monitor CPU cards + períodos + refresh 10s

**Data:** 2026-06-27  
**Contexto:** Refino da UI antes da instalação do coletor no VPS.

## Pedido

- Cards no topo estilo painel Hostinger: **CPU**, **Memória**, **Disco**
- Cores distintas alinhadas ao gráfico
- Períodos: **Todo o tempo**, **Últimas 24 hrs**, **Última hora** (padrão)
- Atualização automática a cada **10 segundos**

## Implementado

### Coletor (`collect-vps-cpu-metrics-for-waba.sh` v2)
- Memória: `free -b` → `hostMemPct`, bytes used/total
- Disco: `df -B1 /` → `hostDiskPct`, bytes used/total
- Load 1m/5m/15m
- Timer install: **10s** (`install-vps-monitor.sh`)

### Backend
- Query `?range=1h|24h|all` (default `1h`)
- Gráfico com 3 séries: CPU, memória, disco
- Downsample até 120 pontos
- `config.uiRefreshSec: 10`

### Frontend
- Cards horizontais coloridos (#38bdf8 CPU, #a78bfa mem, #34d399 disco)
- Seletor de período + badge "Atualização automática a cada 10s"
- Polling 10s fixo na aba Monitor CPU

## Validar

`npm run build` OK.

## Pendência

- Commit + deploy FTP
- Instalação coletor no VPS (passo a passo SSH)
