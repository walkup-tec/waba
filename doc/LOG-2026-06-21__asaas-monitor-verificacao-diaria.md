# LOG — Monitor diário integração Asaas

**Data:** 2026-06-21  
**Pedido:** Rotina com 2 verificações diárias da integração Asaas; alerta WhatsApp (instância 5197462102) + e-mail quando houver necessidade de ajuste em código ou variáveis.

## Solução

### Verificações automáticas (2x/dia — padrão 08:00 e 20:00, America/Sao_Paulo)

1. `ASAAS_API_KEY` configurada
2. `ASAAS_WEBHOOK_ACCESS_TOKEN` em produção
3. URL sandbox em produção
4. `ASAAS_TRANSFER_API_KEY` quando split payout habilitado
5. Sonda API cobrança (`GET /finance/balance`)
6. Sonda permissão transferência PIX (`probeAsaasTransferPermission`)

### Alertas (somente se houver problemas)

- **WhatsApp** via Evolution, instância `5197462102` → `5551999666841`
- **E-mail** → `walkup@walkuptec.com.br` (requer SMTP configurado)
- **Texto WhatsApp:**
  ```
  URGENTE: ASAAS
  É necessário dar atenção para a integração asaas.
  ```
- E-mail inclui lista detalhada dos problemas detectados.

### Arquivos criados

- `src/monitoring/asaas-integration-health.service.ts`
- `src/monitoring/asaas-integration-monitor.service.ts`
- `src/monitoring/evo-text-alert.client.ts`

### Arquivos alterados

- `src/billing/asaas.client.ts` — `probeAsaasPaymentApi`
- `src/index.ts` — inicia scheduler na subida
- `src/admin/waba-admin.routes.ts` — endpoints master de status/execução manual
- `src/deploy-marker.ts` — `DEPLOY-2026-06-21-asaas-monitor-diario`
- `.env`, `.env.v02`, `env.easypanel-producao-asaas.snippet`, `.env.example`, `.env.v02.example`

### Variáveis de ambiente

| Variável | Padrão |
|----------|--------|
| `WABA_ASAAS_MONITOR_ENABLED` | `true` em produção |
| `WABA_ASAAS_MONITOR_SLOTS` | `08:00,20:00` |
| `WABA_ASAAS_MONITOR_ALERT_INSTANCE` | `5197462102` |
| `WABA_ASAAS_MONITOR_ALERT_WHATSAPP` | `5551999666841` |
| `WABA_ASAAS_MONITOR_ALERT_EMAIL` | `walkup@walkuptec.com.br` |

Estado persistido em `data/asaas-integration-monitor-state.json` (dedupe: 1 alerta por horário/dia).

### Endpoints admin (master)

- `GET /admin/financeiro/asaas-monitor/status`
- `POST /admin/financeiro/asaas-monitor/run?forceAlert=1` — teste manual imediato

### Como validar

1. Redeploy Easypanel com marker `DEPLOY-2026-06-21-asaas-monitor-diario`
2. Colar vars do monitor no Environment (snippet atualizado)
3. Log na subida: `[asaas-monitor] verificações diárias às 08:00 e 20:00`
4. Teste: `POST /admin/financeiro/asaas-monitor/run?forceAlert=1` (master logado)

### Observações

- Instância `5197462102` precisa estar conectada na Evolution para WhatsApp.
- SMTP (`SMTP_*`) necessário para e-mail; WhatsApp funciona independente.

## Palavras-chave

`asaas-monitor`, `verificacao-diaria`, `alerta-whatsapp`, `5197462102`, `integracao-asaas`
