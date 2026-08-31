# LOG — probe duplo pós-integração (findMessages + webhook)

**Data:** 2026-06-09  
**Pedido:** Após QR conectar, testar envio com duas validações antes de fechar modal.

## Implementado

### Backend (`src/instance-integration-probe.ts`)

- `POST /instancias/:name/probe-integracao` — envia mensagem marcada da instância nova → outra instância `open` de referência.
- `GET /instancias/probe-integracao/:probeId` — status dos dois testes (polling).
- `POST /webhooks/evolution` — recebe `MESSAGES_UPSERT` e confirma teste 2.
- Teste 1 (API): polling `POST /chat/findMessages/{destino}` na Evolution.
- Teste 2 (webhook): evento `MESSAGES_UPSERT` no destino com texto `WABA-PROBE:…`.
- Ao falhar qualquer teste: `restrictionSuspected: true` + `useAquecedor/useDisparador: false` na instância origem.
- Registra webhook no destino via `POST /webhook/set/{instance}` (requer `WABA_PUBLIC_BASE_URL`).

### Front (`index.html`)

- Painel **Teste de conexão:** com duas linhas:
  - Teste de conexão API → Sucesso / Falha
  - Teste de mensagem recebida no destino → Sucesso / Falha
- Alerta vermelho se qualquer falha: *"Confira o número antes de prosseguir, possível restrição identificada"*
- Modal **não fecha** automaticamente em caso de falha.
- Fluxo: polling `open` → inicia probe → polling status até `finished`.

### Env

- `WABA_PUBLIC_BASE_URL` — URL pública para webhook Evolution (ex. `https://waba.draxsistemas.com.br`).

## Deploy marker

- `WABA_DEPLOY_MARKER` = `DEPLOY-2026-06-09-probe-integracao-duplo-v1`
- Validar: `GET /health` → campo `deployMarker`
- UI modal: badge `DEPLOY-2026-06-09-probe-integracao-duplo-v1` no painel Teste de conexão
- Commit master: `cbcf674`

## Validação produção (09/06 — OK)

- Redeploy `master` `cbcf674` concluído
- `GET /health` → `deployMarker: DEPLOY-2026-06-09-probe-integracao-duplo-v1`
- Teste manual no modal: **retornou conforme esperado** (usuário confirmou)
- `WABA_PUBLIC_BASE_URL` em uso no Easypanel

## Validação local (pré-deploy)

- `npm run build` OK
