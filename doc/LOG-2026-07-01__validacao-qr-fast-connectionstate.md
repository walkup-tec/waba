# LOG — Validação QR rápida + connectionState fresh

**Data:** 2026-07-01  
**Pedido:** Corrigir demora pós-QR e erros na etapa CONFIRMAR; testar localmente; commit + push.

## Causa raiz

1. **Cache `connectionState` 25s** — `status-conexao` reutilizava estado antigo (`close`) após leitura do QR → polling parecia “travado”.
2. **Ghost-open** — `fetchInstances=open` com `connectionState=connecting` iniciava validação cedo e falhava.
3. **sendText Evolution** — timeout/socket hang up via HTTPS público; validação marcava falha mesmo com recepção OK.

## Solução

- `fetchEvoInstanceLiveState(name, { fresh: true })` em `status-conexao` (sem cache no poll QR).
- TTL cache reduzido para 4s (configurável `EVO_CONNECTION_STATE_CACHE_MS`).
- `waitForEvoInstanceLiveOpen` antes de iniciar validação inbound.
- `findChats` antes de `findMessages` na detecção CONFIRMAR.
- Falha técnica de sendText (HTTP 0/timeout) com recepção OK → libera integração.
- UI: poll QR 500ms, feedback “QR lido, finalizando…”, poll validação 500ms.
- `/instancias?refresh=1` enriquece `connectionStatus` com live state.

## Testes locais

```powershell
cd E:\Waba
npm run build
$env:EVO_API_URL="https://walkup-evo-walkup-api.achpyp.easypanel.host"
$env:EVO_TLS_INSECURE="1"
node scripts/test-validacao-flow.cjs
node scripts/run-evo-integration-probe.cjs
```

- `test-validacao-flow.cjs`: OK (connectionState ~45–123ms, findMessages HTTP 200).
- `run-evo-integration-probe.cjs`: `liveOpenCount=1` (precisa 2 para send/receive); ghost-open `final-6019`/`soma` detectado.

## Marker deploy

`DEPLOY-2026-07-01-validacao-qr-fast-connectionstate`

## Palavras-chave

`validacao-inbound`, `status-conexao`, `connectionState-cache`, `qr-polling`, `ghost-open`, `CONFIRMAR`
