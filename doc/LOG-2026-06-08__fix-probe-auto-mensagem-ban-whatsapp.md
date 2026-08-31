# LOG — Fix probe automático causando ban / falso positivo de restrição

**Data:** 2026-06-08  
**Incidente:** Número pessoal banido após conectar QR no modal Registrar instância (mozart v02).

## Causa raiz

1. Após `connectionStatus: open`, o front chamava **automaticamente** `POST /instancias/:name/probe-integracao`.
2. O probe **enviava mensagem real** (`Teste de integração WABA. WABA-PROBE:…`) da instância nova → outra instância de referência (ex. Walkup).
3. Envio automático logo após parear sessão Baileys/Evolution em número pessoal = alto risco de restrição WhatsApp.
4. Qualquer falha (timeout webhook, `WABA_PUBLIC_BASE_URL` ausente em dev, sem instância destino) marcava `restrictionSuspected: true` e exibia *"possível restrição identificada"* — **falso positivo**.

## Correção

### Backend (`instance-integration-probe.ts`)

- Probe **não envia mensagem** sem `allowMessageSend: true` no body.
- Modo passivo: só confirma `status open` na Evolution.
- `restrictionSuspected` **somente** quando Evolution recusa envio com indícios de ban/blocked/forbidden (não em timeout ou falha técnica).
- `INTEGRATION_PROBE_DISABLE_MESSAGE_SEND=1` bloqueia envio mesmo com opt-in.

### Front (`index.html`)

- Removido probe automático ao conectar QR.
- Sucesso: *"Dispositivo conectado com sucesso."* + fecha modal.
- Botão opcional **Testar envio** com `confirm()` e aviso de risco.
- Alerta de restrição só com `restrictionSuspected` real após teste opt-in.

### Deploy marker

- `DEPLOY-2026-06-08-safe-connect-v1`

## Pendências

- Reiniciar `npm run dev:v02` e validar fluxo QR sem probe automático.
- Deploy produção WABA quando aprovado.
- Número pessoal banido: recuperação só via WhatsApp (não há rollback técnico).
