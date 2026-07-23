# LOG — Atualizar/QRCode: connect-first (sem logout prévio)

## Contexto

Botões **Atualizar** e **QRCode** na lista de instâncias geravam erros EVO: «Failed to fetch» / «Erro de conexão com o servidor».

## Causa raiz

1. Antes de `GET /instance/connect/{instance}` (doc oficial EVO — já devolve QR em `close`/`connecting`), o backend fazia **logout + restart** (`prepareEvoInstanceForQrConnect`). Isso travava/timeout e destruía sessão `connecting` válida.
2. Evidência: `connect/1261` direto → HTTP 200 + `base64` em ~0,1s; `connectionState` = `connecting`.
3. UI bloqueava Atualizar/QR em **Restrição** (`actionsLocked`), e **Atualizar** só abria o modal sem gerar QR.
4. «Failed to fetch» era exibido cru no toast.

Doc: https://doc.evolution-api.com/v2/api-reference/instance-controller/instance-connect

## Solução

- `fetchInstanceQrCodeFromEvo`: `prepareSession` só se `=== true` (não mais default).
- `runRegistrarQrcode` + `POST .../qrcode`: connect direto → se falhar, aí logout+restart.
- UI: Atualizar/QR liberados em Restrição; ambos geram QR; mensagem amigável para Failed to fetch.
- Marker: `DEPLOY-2026-07-23-qrcode-connect-first-no-logout`

## Arquivos

- `src/index.ts`, `dist/index.js`
- `src/deploy-marker.ts`, `dist/deploy-marker.js`
- `index.html`, `dist/index.html`

## Como validar

1. Redeploy `waba_disparador` (código Node) + FTP (HTML).
2. Confirmar `/health` → marker novo.
3. Instância desconectada/connecting → Atualizar ou QRCode → imagem QR sem timeout.

## Palavras-chave

qrcode, atualizar, prepareSession, logout restart, Failed to fetch, connect-first, 1261
