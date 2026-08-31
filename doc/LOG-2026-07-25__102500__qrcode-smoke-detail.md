# LOG — QR ainda falha com marker novo (smoke + detalhe)

## Contexto
Após deploy `DEPLOY-2026-07-25-qrcode-extract-tombstone`, UI ainda mostra «Erro ao gerar QRCode da instância.»

## Evidência
- `/health` marker novo + `evoApiBase=http://172.17.0.1:30181` OK
- EVO pública: `POST /instance/create` → 201 com `qrcode.base64`
- Probe WABA→EVO: fetchInstances + sendText OK (2 open: walkup, soma-crm)
- Mensagem genérica = catch do job `registrar-qrcode` (não `describeEvoQrFailure`)
- UI engolia `detail` quando `error` era a string genérica

## Solução
1. UI: preferir `detail` / nested array quando mensagem for opaca
2. Job catch: `summarizeEvolutionErrorDetail` + stack em `detail`
3. Endpoint `GET /service/evo-qr-create-smoke` — create→extract→delete (sem sendText)
4. Marker: `DEPLOY-2026-07-25-qrcode-smoke-detail`

## Validar
1. Redeploy Node `waba_disparador`
2. `GET /health` → marker smoke-detail
3. `GET /service/evo-qr-create-smoke` → `ok:true`, `extractOk:true`
4. Se smoke falhar com hang/timeout: restart EVO `walkup_evo-walkup-api` (aprovação infra)
5. Retry wizard QR — mensagem deve mostrar detalhe real se falhar

## Palavras-chave
qrcode, registrar-qrcode catch, evo-qr-create-smoke, detail opaque, extract base64
