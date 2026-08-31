# LOG — 2026-07-07 15:05 — Monitor de uptime (15min) com alerta WhatsApp + e-mail

## Solicitação
Criar um monitor "de verdade" (o atual é falho). A cada 15 minutos verificar:
- Webhook Asaas ativo e conectado
- `https://draxsistemas.com.br/` online
- `https://bet.waba.info/` online
- `https://wabadisparos.com.br/` online
- `https://waba.draxsistemas.com.br/` no ar

Se algo não responder positivo → notificar WhatsApp `51999666841` e e-mail `walkup@walkuptec.com.br`.
Enviar via instância `51981077770`; se não conectada, usar `51997462102`.

## Por que o monitor antigo era falho
- `scripts/infra/vps-health-audit.sh` + timer systemd: **só logam** (`/var/log/...`), sem WhatsApp/e-mail. Alertas engolidos com `|| true`.
- Monitor Asaas (`asaas-integration-monitor.service.ts`): alerta WhatsApp+e-mail, mas roda **2x/dia** (08:00/20:00), não cobre sites/app nem intervalo de 15min.
- Nenhum pipeline unificado 15min com notificação outbound.

## Solução implementada (reaproveitando blocos testados)
Novo serviço unificado `src/monitoring/uptime-monitor.service.ts`:
- **Checagem HTTP** via `fetch` + `AbortController` (timeout 15s), **3 tentativas** com backoff curto (cobre o flapping de Traefik: 200/404/timeout observado hoje). Online = status 200–399.
- **Asaas** via `evaluateAsaasIntegrationHealth()` (token webhook + reachability da API Asaas). É o melhor sinal disponível no código para "webhook ativo e conectado" (o painel Asaas não é consultado por API — ver observação).
- **Alerta WhatsApp** via `sendEvoTextAlert()`; instância resolvida por `resolveConnectedEvoInstanceByPhoneHint(primária)` e validada com `fetchEvoInstanceLiveState` (evita "ghost open"); fallback para telefone secundário; último recurso literal.
- **Alerta e-mail** via `wabaMailService.send()` (SMTP nodemailer).
- **Dedup/anti-spam:** estado em `data/uptime-monitor-state.json`. Alerta ao cair (transição up→down), reenvia enquanto continuar fora do ar no máximo a cada `REALERT_MINUTES` (padrão 60), e envia aviso de recuperação (down→up).
- **Scheduler:** `setInterval` no intervalo configurado (padrão 15min) + 1 execução no boot. Habilitado só em produção/v01 (não dispara em dev).

### Endpoints admin (somente master)
- `GET  /admin/infra/uptime-monitor/status`
- `POST /admin/infra/uptime-monitor/run?forceAlert=1`
- `POST /admin/infra/uptime-monitor/test-alert`

## Arquivos criados/alterados
- `src/monitoring/uptime-monitor.service.ts` (novo)
- `src/admin/waba-admin.routes.ts` (import + 3 rotas)
- `src/index.ts` (import + `startUptimeMonitorScheduler()` no boot)
- `.env.example` (bloco `WABA_UPTIME_MONITOR_*`)

## Variáveis .env (padrões já embutidos)
```
WABA_UPTIME_MONITOR_ENABLED=true
WABA_UPTIME_MONITOR_INTERVAL_MINUTES=15
WABA_UPTIME_MONITOR_REALERT_MINUTES=60
WABA_UPTIME_MONITOR_HTTP_TIMEOUT_MS=15000
WABA_UPTIME_MONITOR_CHECK_ASAAS=true
WABA_UPTIME_MONITOR_PRIMARY_PHONE=51981077770
WABA_UPTIME_MONITOR_FALLBACK_PHONE=51997462102
WABA_UPTIME_MONITOR_ALERT_WHATSAPP=5551999666841
WABA_UPTIME_MONITOR_ALERT_EMAIL=walkup@walkuptec.com.br
# WABA_UPTIME_MONITOR_TARGETS= (opcional, sobrescreve URLs)
```

## Validação
- `npm run build` → OK (exit 0).
- Check local (dev, sem alertas): 4 alvos → todos **HTTP 200** (`ok=true`).
- Teste de falha (alvos inválidos): detectados como `down`; fluxo de alerta acionado (WhatsApp/e-mail falharam **localmente** só porque não há instância EVO conectada nem SMTP no dev — em produção estão configurados).

## Observações de segurança
- Sem segredos no código; usa `EVO_API_KEY`, SMTP e `ASAAS_*` já existentes no ambiente.
- Alertas não expõem tokens; mensagens seguras.

## Pendências / retomada
- Deploy produção (subir para o servidor) para o monitor entrar em atividade real.
- Após deploy: validar `POST /admin/infra/uptime-monitor/test-alert` (chega WhatsApp + e-mail).
- **Webhook Asaas "de verdade":** hoje inferimos por token+reachability. Se quiser checagem real de registro do webhook, precisa de endpoint da API Asaas (GET /webhooks) — não implementado.
- Palavras-chave: uptime monitor, 15min, whatsapp alerta, email alerta, draxsistemas, bet.waba.info, wabadisparos, waba.draxsistemas, asaas webhook, evo instance fallback.
