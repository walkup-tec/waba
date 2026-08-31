# LOG — Monitor CPU (master · Suporte)

**Data:** 2026-06-27  
**Contexto:** Tela master em **Suporte → Monitor CPU** com gráfico de consumo da VPS, alerta de CPU alta sustentada, identificação do container culpado e playbook SSH passo a passo.

## Pedido

- Monitor gráfico de CPU da VPS dentro do WABA.
- Somente usuário **master**, seção **Suporte**, menu **Monitor CPU**.
- Quando CPU permanecer alta por período estável, destacar aplicação causadora e exibir comandos SSH para resolver.

## Solução implementada

### Backend (TypeScript)

- `GET /admin/infra/cpu/dashboard` — master only (`waba-admin.routes.ts`).
- Serviço: `src/infra/vps-cpu-monitor.service.ts` — agrega amostras, gráfico, alerta (default ≥65% por 10 min, intervalo 60s).
- Playbooks por serviço: `src/infra/vps-cpu-playbooks.ts` (Traefik, Typebot, Easypanel, n8n, Chatwoot, dockerd, WABA, genérico).
- Persistência: `data/vps-infra/cpu-samples.jsonl` via `vps-cpu-monitor.repository.ts`.

### Coletor no VPS

- `scripts/infra/collect-vps-cpu-metrics-for-waba.sh` — grava JSONL no volume do container WABA.
- `scripts/infra/install-vps-monitor.sh` — timer `waba-infra-cpu-collector.timer` (1 min).

### Frontend (`index.html`)

- Menu desktop/mobile **Monitor CPU** (classe `admin-master-only`).
- Painel `#tab-admin-monitor-cpu`: KPIs, gráfico SVG (`renderAdminDashboardSvgLineChart`), alerta, tabela top containers, playbook com **Copiar comando**.
- JS: `loadAdminMonitorCpu`, polling ~60s, hooks em `setActiveTab`, `isSuporteTab`, `isTabBlockedByMenuPolicy`.
- Registry: `admin-monitor-cpu` em `waba-menu-registry.ts`.

### Env vars (opcionais)

- `WABA_VPS_CPU_ALERT_THRESHOLD_PCT` (default 65)
- `WABA_VPS_CPU_SUSTAINED_MINUTES` (default 10)
- `WABA_VPS_CPU_SAMPLE_INTERVAL_SEC` (default 60)
- `WABA_VPS_CPU_MONITOR_ENABLED` — auto on em production

## Arquivos alterados/criados

- `index.html` — UI + JS completo
- `src/infra/vps-cpu-monitor.*.ts`
- `src/infra/vps-cpu-playbooks.ts`
- `src/admin/waba-admin.routes.ts`
- `src/menus/waba-menu-registry.ts`
- `scripts/infra/collect-vps-cpu-metrics-for-waba.sh`
- `scripts/infra/install-vps-monitor.sh`

## Como validar

1. `npm run build` — OK (tsc + copy index).
2. Login como **master** → **Suporte → Monitor CPU**.
3. Sem coletor: mensagem de setup com passos SSH.
4. Com amostras em `data/vps-infra/cpu-samples.jsonl`: gráfico + KPIs + tabela.
5. CPU sustentada acima do limite: alerta vermelho + playbook com passos copiáveis.

### VPS (após deploy)

```bash
curl -fsSL https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/install-vps-monitor.sh -o /tmp/install-vps-monitor.sh
sed -i 's/\r$//' /tmp/install-vps-monitor.sh && chmod +x /tmp/install-vps-monitor.sh
/tmp/install-vps-monitor.sh install
systemctl status waba-infra-cpu-collector.timer
```

## Segurança

- Endpoint restrito a master; sem exposição de credenciais SSH.
- Playbooks são comandos genéricos documentados; execução manual no VPS.

## Palavras-chave

`monitor-cpu`, `admin-monitor-cpu`, `vps-cpu-dashboard`, `cpu-samples.jsonl`, `waba-infra-cpu-collector`, `playbook-ssh`
