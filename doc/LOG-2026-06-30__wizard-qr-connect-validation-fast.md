# LOG — Wizard conexão: QR, pós-scan e CONFIRMAR mais rápidos

## Contexto

Usuário reportou lentidão em três etapas do wizard «Conectar instância WhatsApp»:
1. Exibir QR Code
2. Avançar após leitura do QR
3. Reconhecer «CONFIRMAR» na validação inbound

## Causas

| Etapa | Gargalo |
|-------|---------|
| QR | 6 rodadas com sleeps de até 6,5s + prepare 4s (recovery) |
| Pós-QR | Poll `/instancias?refresh=1` a cada 3s (fetchInstances completo, timeout 50s) |
| CONFIRMAR | Poll backend 3s + poll UI 2,5s + reply delay 4s |

## Solução

### QR (`src/index.ts`)
- Caminho rápido: 5 tentativas (~700ms–2,2s entre elas); prepare session 2,5s
- Caminho `extended` só no recovery após reset

### Pós-QR
- Novo `GET /instancias/:name/status-conexao` → Evolution `connectionState` (~8s timeout)
- UI poll **1s** + primeira consulta imediata (antes 3s + fetchInstances)

### CONFIRMAR (`instance-inbound-validation.service.ts` + UI)
- Poll backend default **1,2s** (env `INBOUND_VALIDATION_POLL_MS`)
- Reply delay **1,2s** (env `INBOUND_VALIDATION_REPLY_DELAY_MS`)
- Webhook dispara `scheduleValidationFollowUp` sem esperar próximo poll
- `findMessages` com fallback sem `requireTimestamp`
- UI validação poll **1s** imediato

## Marker

`DEPLOY-2026-06-30-wizard-qr-connect-validation-fast`

## Validar

1. Redeploy Easypanel
2. `GET /health` → marker acima
3. Registrar QR: imagem em poucos segundos (EVO saudável)
4. Após scan: passo 3 em ~1–3s
5. Enviar CONFIRMAR: recepção em ~1–3s (webhook) ou ~2–4s (só poll)

## Palavras-chave

`wizard-lento`, `status-conexao`, `connectionState`, `INBOUND_VALIDATION_POLL_MS`, `poll 1s`
