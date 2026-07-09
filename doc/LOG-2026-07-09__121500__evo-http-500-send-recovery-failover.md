# LOG — EVO HTTP 500 no sendText (aquecedor, operacional, boas-vindas)

## Contexto

Sintoma em produção: `Falha no envio via EVO (HTTP 500) (Internal Server Error). Mensagem voltou para pendente.` — típico do **aquecedor** (`src/index.ts`), mas o mesmo stack EVO alimenta WhatsApp operacional, boas-vindas, uptime monitor e disparos.

Causas frequentes (histórico `doc/LOG-2026-06-30__qrcode-evo-count0-prisma-recovery.md`):
- Erro Prisma/`integrationSession` no PostgreSQL da Evolution
- URL EVO via HTTPS Easypanel instável enquanto `http://172.17.0.1:30181` no mesmo VPS responde
- Instância WhatsApp precisa de `POST /instance/restart/{instance}` (sem logout)

## Solução implementada

### 1. Failover de base URL (`src/evo-api-config.ts`)
- Ordem: `EVO_API_URL` → `EVO_API_FALLBACK_URL` (opcional) → `EVO_DOCKER_HOST_URL` / `http://172.17.0.1:30181` em produção/`waba_disparador`
- `evoHttpRequestWithBaseFailover` — troca host em erros de rede/502–504; **não** faz failover em 500 Prisma (restart resolve)

### 2. Recuperação sendText (`src/services/evo-send-recovery.service.ts`)
- Detecta 500 + `integrationSession` / `prisma` / `Internal Server Error`
- `restartEvoInstanceLight` (restart sem logout) + reenvio único
- Integrado em `callEvoSendTextWithRetry` (aquecedor/disparos) e `sendEvoTextAlert` (operacional, boas-vindas, monitors)

### 3. Monitor uptime
- Novo alvo `Evolution API (fetchInstances)` quando `WABA_UPTIME_MONITOR_CHECK_EVO=true` (padrão)

### Deploy marker
`DEPLOY-2026-07-09-evo-send-recovery-failover`

## Arquivos
- `src/evo-api-config.ts` (novo)
- `src/services/evo-send-recovery.service.ts` (novo)
- `src/index.ts`, `src/monitoring/evo-text-alert.client.ts`, `src/instances/evo-connection-state.service.ts`, `src/monitoring/uptime-monitor.service.ts`
- `.env.example` — `EVO_API_FALLBACK_URL`, `WABA_UPTIME_MONITOR_CHECK_EVO`

## Validar após deploy
1. `GET https://waba.draxsistemas.com.br/health` → `deployMarker: DEPLOY-2026-07-09-evo-send-recovery-failover`
2. `GET /service/evo-integration-probe` (autenticado ou interno) — `liveOpenCount >= 2`, `sendTest.accepted`
3. Aquecedor: mensagem pendente deve sair de erro 500 após restart automático (logs `[evo] restart leve OK`)
4. Se 500 persistir: **Easypanel → reiniciar container Evolution** e conferir PostgreSQL da EVO

## Easypanel (recomendado produção)
```
EVO_API_URL=http://172.17.0.1:30181
EVO_INSTANCES_URL=http://172.17.0.1:30181/instance/fetchInstances
```
Ou manter HTTPS + `EVO_API_FALLBACK_URL=http://172.17.0.1:30181`

## Palavras-chave
`evo 500`, `integrationSession`, `prisma`, `sendText`, `aquecedor pendente`, `failover 30181`, `restart instance`, `operacional whatsapp`
